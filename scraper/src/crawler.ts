import { chromium } from 'playwright';
import { normalizePhone } from './normalizer.js';
import type { ScrapedLead } from './types.js';

export interface CrawlerOptions {
  headless?: boolean;
  nicho?: string;
  onProgress?: (current: number, total: number, leadName: string) => void;
  maxWaitTimeMs?: number;
}

/**
 * Crawls Google Maps listings for the given query up to the specified limit.
 */
export async function crawlGoogleMaps(
  query: string,
  limit: number = 20,
  options?: CrawlerOptions
): Promise<ScrapedLead[]> {
  const isHeadless = options?.headless ?? true;
  const browser = await chromium.launch({
    headless: isHeadless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--lang=pt-BR',
    ],
  });

  const context = await browser.newContext({
    locale: 'pt-BR',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
  });

  const page = await context.newPage();
  const leads: ScrapedLead[] = [];
  const seenUrls = new Set<string>();

  try {
    const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}?hl=pt-BR`;
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });

    // Handle Google Consent / Cookie prompt if shown
    try {
      const consentBtn = page
        .locator('button:has-text("Aceitar tudo"), button:has-text("Concordo"), form[action*="consent"] button')
        .first();
      if (await consentBtn.isVisible({ timeout: 2500 }).catch(() => false)) {
        await consentBtn.click();
        await page.waitForTimeout(1000);
      }
    } catch {
      // Ignored: No consent modal
    }

    // Wait for the feed or listings
    const feedLocator = page.locator('div[role="feed"]');
    const hasFeed = await feedLocator
      .first()
      .waitFor({ state: 'visible', timeout: 10000 })
      .then(() => true)
      .catch(() => false);

    if (!hasFeed) {
      // Check if Google navigated directly to a single place page
      if (page.url().includes('/maps/place/')) {
        const lead = await extractDetailsFromCurrentPanel(page, page.url(), options?.nicho || query);
        if (lead) {
          leads.push(lead);
          options?.onProgress?.(1, 1, lead.name);
        }
      }
      return leads;
    }

    let consecutiveNoNewItems = 0;
    let currentIndex = 0;

    while (leads.length < limit && consecutiveNoNewItems < 5) {
      const listingLocator = page.locator('div[role="feed"] a.hfpxzc');
      const count = await listingLocator.count();

      if (currentIndex >= count) {
        // Need to scroll down to load more items
        const prevCount = count;
        await feedLocator.first().evaluate((el) => {
          el.scrollTop = el.scrollHeight;
        });
        await page.waitForTimeout(1800);

        const newCount = await listingLocator.count();
        if (newCount <= prevCount) {
          consecutiveNoNewItems++;
          // Check if end of results indicator is visible
          const endOfList = await page
            .locator('div.HlvSq, :has-text("Você chegou ao fim da lista")')
            .isVisible()
            .catch(() => false);
          if (endOfList) {
            break;
          }
        } else {
          consecutiveNoNewItems = 0;
        }
        continue;
      }

      const item = listingLocator.nth(currentIndex);
      currentIndex++;

      const url = await item.getAttribute('href').catch(() => null);
      if (url && seenUrls.has(url)) {
        continue;
      }
      if (url) {
        seenUrls.add(url);
      }

      const listingName = (await item.getAttribute('aria-label').catch(() => '')) || '';

      // Scroll listing into view and click to open side details panel
      try {
        await item.scrollIntoViewIfNeeded({ timeout: 3000 });
        await item.click({ timeout: 4000 });
        await page.waitForTimeout(1200);
      } catch {
        continue;
      }

      const lead = await extractDetailsFromCurrentPanel(page, url || page.url(), options?.nicho || query, listingName);
      leads.push(lead);

      options?.onProgress?.(leads.length, limit, lead.name);

      if (leads.length >= limit) {
        break;
      }
    }
  } finally {
    await browser.close().catch(() => {});
  }

  return leads;
}

async function extractDetailsFromCurrentPanel(
  page: any,
  googleMapsUrl: string,
  fallbackNicho: string,
  fallbackName?: string
): Promise<ScrapedLead> {
  // Title / Name
  let name = fallbackName || '';
  if (!name) {
    name = (await page.locator('h1').first().textContent().catch(() => '')) || '';
  }
  name = name.trim();

  // Phone
  let phone = '';
  try {
    const phoneBtn = page
      .locator('button[data-item-id^="phone:"], button[aria-label*="Telefone:"]')
      .first();
    if (await phoneBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      const rawAttr = await phoneBtn.getAttribute('aria-label').catch(() => '');
      if (rawAttr && rawAttr.includes(':')) {
        phone = rawAttr.split(':')[1].trim();
      } else {
        const text = await phoneBtn.textContent().catch(() => '');
        phone = (text || '').trim();
      }
    }
  } catch {
    phone = '';
  }

  const { normalized, formatted, isValid } = normalizePhone(phone);
  const normalizedPhone = isValid ? normalized : (phone.replace(/\D/g, '') || '');
  const displayPhone = isValid ? formatted : phone;

  // Website
  let website: string | undefined = undefined;
  let hasWebsite = false;
  try {
    const websiteLink = page
      .locator('a[data-item-id="authority"], a[aria-label*="website" i]')
      .first();
    if (await websiteLink.isVisible({ timeout: 800 }).catch(() => false)) {
      const href = await websiteLink.getAttribute('href').catch(() => null);
      if (href && href.startsWith('http')) {
        website = href;
        hasWebsite = true;
      }
    }
  } catch {
    website = undefined;
    hasWebsite = false;
  }

  // Location / Address
  let location: string | undefined = undefined;
  try {
    const addressBtn = page
      .locator('button[data-item-id="address"], button[aria-label*="Endereço:"]')
      .first();
    if (await addressBtn.isVisible({ timeout: 800 }).catch(() => false)) {
      const rawAttr = await addressBtn.getAttribute('aria-label').catch(() => '');
      if (rawAttr && rawAttr.includes(':')) {
        location = rawAttr.split(':')[1].trim();
      } else {
        const text = await addressBtn.textContent().catch(() => '');
        location = (text || '').trim();
      }
    }
  } catch {
    location = undefined;
  }

  // Rating & Reviews Count
  let rating: number | undefined = undefined;
  let reviewsCount: number | undefined = undefined;
  try {
    const ratingEl = page.locator('div.F7nice span[aria-hidden="true"]').first();
    if (await ratingEl.isVisible({ timeout: 800 }).catch(() => false)) {
      const rText = await ratingEl.textContent().catch(() => '');
      if (rText) {
        const parsed = parseFloat(rText.replace(',', '.'));
        if (!isNaN(parsed)) {
          rating = parsed;
        }
      }
    }

    const reviewsEl = page.locator('div.F7nice span[aria-label*="avaliaç"]').first();
    if (await reviewsEl.isVisible({ timeout: 500 }).catch(() => false)) {
      const revText = await reviewsEl.getAttribute('aria-label').catch(() => '');
      const match = (revText || '').match(/([\d.]+)\s*avaliaç/i);
      if (match) {
        reviewsCount = parseInt(match[1].replace(/\./g, ''), 10);
      }
    }
  } catch {
    // optional fields
  }

  // Nicho / Category
  let nicho = fallbackNicho;
  try {
    const categoryBtn = page
      .locator('button[jsaction*="category"], button.DkEaL')
      .first();
    if (await categoryBtn.isVisible({ timeout: 500 }).catch(() => false)) {
      const catText = await categoryBtn.textContent().catch(() => '');
      if (catText && catText.trim()) {
        nicho = catText.trim();
      }
    }
  } catch {
    // keep fallbackNicho
  }

  return {
    name,
    phone: displayPhone,
    normalizedPhone,
    nicho,
    hasWebsite,
    website,
    location,
    rating,
    reviewsCount,
    googleMapsUrl,
  };
}
