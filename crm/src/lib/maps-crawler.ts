import { chromium } from 'playwright';
import { normalizePhone } from './phone-normalizer';
import { detectWebsiteType } from './website-detector';

export interface ScrapedLead {
  name: string;
  phone: string;
  normalizedPhone: string;
  nicho: string;
  hasWebsite: boolean;
  website?: string | null;
  isProprietaryWebsite?: boolean;
  socialType?: string;
  socialUrl?: string;
  notes?: string;
  location?: string;
  rating?: number;
  reviewsCount?: number;
  googleMapsUrl?: string;
}

export interface CrawlerOptions {
  headless?: boolean;
  nicho?: string;
  onlyWithoutWebsite?: boolean;
  onProgress?: (current: number, total: number, leadName: string, lead?: ScrapedLead) => void;
}

export function buildSearchQuery(options: {
  nicho?: string;
  regiao?: string;
  busca?: string;
}): string {
  if (options.busca && options.busca.trim()) {
    return options.busca.trim();
  }

  const nicho = (options.nicho || '').trim();
  const regiao = (options.regiao || '').trim();

  if (nicho && regiao) return `${nicho} em ${regiao}`;
  if (nicho) return nicho;
  if (regiao) return regiao;
  return '';
}

/**
 * Crawls Google Maps listings in headless Chromium with optional no-website filter.
 */
export async function crawlGoogleMaps(
  query: string,
  limit: number = 20,
  options?: CrawlerOptions
): Promise<ScrapedLead[]> {
  const isHeadless = options?.headless ?? true;
  const onlyWithoutWebsite = options?.onlyWithoutWebsite ?? true;

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

    // Handle cookie consent modal if shown
    try {
      const consentBtn = page
        .locator('button:has-text("Aceitar tudo"), button:has-text("Concordo"), form[action*="consent"] button')
        .first();
      if (await consentBtn.isVisible({ timeout: 2500 }).catch(() => false)) {
        await consentBtn.click();
        await page.waitForTimeout(1000);
      }
    } catch {
      // Ignored
    }

    const feedLocator = page.locator('div[role="feed"]');
    const hasFeed = await feedLocator
      .first()
      .waitFor({ state: 'visible', timeout: 10000 })
      .then(() => true)
      .catch(() => false);

    if (!hasFeed) {
      if (page.url().includes('/maps/place/')) {
        const lead = await extractDetailsFromCurrentPanel(page, page.url(), options?.nicho || query);
        if (lead) {
          if (!onlyWithoutWebsite || !lead.isProprietaryWebsite) {
            leads.push(lead);
            options?.onProgress?.(1, 1, lead.name, lead);
          }
        }
      }
      return leads;
    }

    let consecutiveNoNewItems = 0;
    let currentIndex = 0;

    while (leads.length < limit && consecutiveNoNewItems < 6) {
      const listingLocator = page.locator('div[role="feed"] a.hfpxzc');
      const count = await listingLocator.count();

      if (currentIndex >= count) {
        const prevCount = count;
        await feedLocator.first().evaluate((el) => {
          el.scrollTop = el.scrollHeight;
        });
        await page.waitForTimeout(1800);

        const newCount = await listingLocator.count();
        if (newCount <= prevCount) {
          consecutiveNoNewItems++;
          const endOfList = await page
            .locator('div.HlvSq, :has-text("Você chegou ao fim da lista")')
            .isVisible()
            .catch(() => false);
          if (endOfList) break;
        } else {
          consecutiveNoNewItems = 0;
        }
        continue;
      }

      const item = listingLocator.nth(currentIndex);
      currentIndex++;

      const url = await item.getAttribute('href').catch(() => null);
      if (url && seenUrls.has(url)) continue;
      if (url) seenUrls.add(url);

      const listingName = (await item.getAttribute('aria-label').catch(() => '')) || '';

      try {
        await item.scrollIntoViewIfNeeded({ timeout: 2500 });
        await item.click({ timeout: 3500 });
        await page.waitForTimeout(1000);
      } catch {
        continue;
      }

      const lead = await extractDetailsFromCurrentPanel(page, url || page.url(), options?.nicho || query, listingName);

      // If user requested only leads without a proprietary website, skip businesses with real websites
      if (onlyWithoutWebsite && lead.isProprietaryWebsite) {
        options?.onProgress?.(leads.length, limit, `Pulei (já possui site próprio): ${lead.name}`);
        continue;
      }

      leads.push(lead);
      options?.onProgress?.(leads.length, limit, lead.name, lead);

      if (leads.length >= limit) break;
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
  let name = fallbackName || '';
  if (!name) {
    name = (await page.locator('h1').first().textContent().catch(() => '')) || '';
  }
  name = name.trim();

  let phone = '';
  try {
    const phoneBtn = page
      .locator('button[data-item-id^="phone:"], button[aria-label*="Telefone:"]')
      .first();
    if (await phoneBtn.isVisible({ timeout: 800 }).catch(() => false)) {
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

  const phoneRes = normalizePhone(phone);
  const normalizedPhone = phoneRes.isValid ? phoneRes.normalized : (phone.replace(/\D/g, '') || '');
  const displayPhone = phoneRes.isValid ? phoneRes.formatted : phone;

  let rawWebsite: string | null = null;
  try {
    const websiteLink = page
      .locator('a[data-item-id="authority"], a[aria-label*="website" i]')
      .first();
    if (await websiteLink.isVisible({ timeout: 600 }).catch(() => false)) {
      const href = await websiteLink.getAttribute('href').catch(() => null);
      if (href && href.startsWith('http')) {
        rawWebsite = href;
      }
    }
  } catch {
    rawWebsite = null;
  }

  const webDetection = detectWebsiteType(rawWebsite);

  let location: string | undefined = undefined;
  try {
    const addressBtn = page
      .locator('button[data-item-id="address"], button[aria-label*="Endereço:"]')
      .first();
    if (await addressBtn.isVisible({ timeout: 600 }).catch(() => false)) {
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

  let rating: number | undefined = undefined;
  let reviewsCount: number | undefined = undefined;
  try {
    const starsLocator = page.locator('div[role="main"] span[aria-label*="estrelas"]').first();
    if (await starsLocator.isVisible({ timeout: 500 }).catch(() => false)) {
      const ariaText = await starsLocator.getAttribute('aria-label').catch(() => '');
      const match = ariaText.match(/([\d,\.]+)\s*estrelas/i);
      if (match) {
        rating = parseFloat(match[1].replace(',', '.'));
      }
    }

    const reviewsLocator = page.locator('button[aria-label*="avaliações"], span[aria-label*="avaliações"]').first();
    if (await reviewsLocator.isVisible({ timeout: 500 }).catch(() => false)) {
      const ariaText = await reviewsLocator.getAttribute('aria-label').catch(() => '');
      const match = ariaText.match(/([\d\.]+)\s*avalia/i);
      if (match) {
        reviewsCount = parseInt(match[1].replace(/\./g, ''), 10);
      }
    }
  } catch {
    // Optional metrics
  }

  const notesParts: string[] = [];
  if (webDetection.socialType && webDetection.socialUrl) {
    notesParts.push(`[${webDetection.socialType.toUpperCase()}]: ${webDetection.socialUrl}`);
  }

  return {
    name,
    phone: displayPhone,
    normalizedPhone,
    nicho: fallbackNicho,
    hasWebsite: webDetection.hasWebsite,
    website: webDetection.url,
    isProprietaryWebsite: webDetection.isProprietary,
    socialType: webDetection.socialType,
    socialUrl: webDetection.socialUrl,
    notes: notesParts.length > 0 ? notesParts.join(' | ') : undefined,
    location,
    rating,
    reviewsCount,
    googleMapsUrl,
  };
}
