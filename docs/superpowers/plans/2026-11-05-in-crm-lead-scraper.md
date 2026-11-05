# In-CRM Lead Scraper & Automatic Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an in-CRM Lead Extraction interface (`/scraper`) powered by Playwright and Google Maps with real-time SSE progress streaming, allowing users to select nicho, região, quantidade, and prioritize/filter exclusively businesses without a proprietary website (treating Instagram/WhatsApp/Linktree as "sem site próprio"), and automatically ingesting deduplicated leads and Kanban cards into SQLite.

**Architecture:** Next.js Route Handler (`POST /api/scraper/extract`) streams real-time extraction progress via Server-Sent Events (SSE). A Playwright crawler (`crm/src/lib/maps-crawler.ts`) scrapes Google Maps listings in headless mode. A website classifier (`crm/src/lib/website-detector.ts`) identifies whether a site is a real proprietary domain vs social/biolink (Instagram, WhatsApp, Facebook, Linktree), avoiding the false-positive trap. If `onlyWithoutWebsite` is checked (default), businesses with real websites are skipped until the requested quota of no-website prospects is met. Discovered leads are fed into `ingestRawLeads` in `crm/src/lib/deduplicator.ts` to deduplicate by phone/nicho and create cards in the Kanban board. A polished Next.js 15 Tailwind UI (`crm/src/app/scraper/page.tsx`) provides quick-select nicho badges, filter toggles, live progress bars, real-time activity logs, and metric summary cards.

**Tech Stack:** Next.js 15 (App Router), Playwright (`^1.49.0`), React 19, Lucide React, Drizzle ORM, LibSQL SQLite, Tailwind CSS, Vitest.

**Spec:** In-CRM Lead Extractor with Website Classifier and Automatic Kanban Pipeline (`crm/src/app/scraper/page.tsx`, `crm/src/lib/maps-crawler.ts`, `crm/src/lib/website-detector.ts`, `crm/src/app/api/scraper/extract/route.ts`).

## Global Constraints

- **Single Execution Environment:** Crawler must run cleanly inside `crm` workspace without cross-workspace ESM relative import failures.
- **Real-Time UX:** Long-running scraping operations (20s-90s) must stream progress to the frontend using Server-Sent Events (SSE) so users never see a frozen interface or HTTP timeout.
- **Social Media / Biolink Trap Avoidance:** Many local businesses put their Instagram, WhatsApp, Facebook, or Linktree URL as their website on Google Maps. The crawler MUST NOT treat these as proprietary websites; they must be classified as `has_website: 0` (`hasWebsite: false`) and their social link captured in `notes` or metadata.
- **No-Website Filter / Quota Guarantee:** When `onlyWithoutWebsite` is active (default), the crawler must skip businesses with real proprietary websites and continue scrolling/scraping until the target quota of leads without websites is satisfied.
- **Zero-Manual Data Ingestion:** Scraped leads must automatically be saved to `leads` table and Kanban `cards` table via `ingestRawLeads`, respecting deduplication rules.
- **Phone Normalization:** All Brazilian numbers must be validated and normalized (DDD, mobile 9th digit, standard `(DD) 9XXXX-XXXX` formatting).
- **Graceful Error Handling:** Browser crashes, Google consent prompts, or empty results must be handled gracefully without crashing the Next.js process.

## Review Focus

1. **Social Media & Biolink Domain Detection:** URLs matching `instagram.com`, `instagr.am`, `wa.me`, `whatsapp.com`, `facebook.com`, `fb.com`, `linktr.ee`, `beacons.ai`, `bio.site`, `taplink.cc`, etc. must return `isProprietary: false` and `hasWebsite: false`, preserving the link in `socialUrl` and CRM `notes`.
2. **Quota Fulfillment with `onlyWithoutWebsite`:** When the user requests 20 leads with the filter active, scraping 15 businesses with websites must NOT leave the user with only 5 leads; the crawler must continue scanning until 20 leads *without* proprietary websites are gathered (or no more listings exist).
3. **Google Maps DOM Variations:** Google Maps may display a feed of listings or navigate directly to a single business page when the query matches an exact establishment. The crawler must handle both structures.
4. **SSE Connection Abort & Resource Cleanup:** When the user closes the page or cancels extraction, the browser and Playwright context must be terminated cleanly to prevent orphaned Chromium processes.
5. **Database Deduplication:** Repeated scrapes in the same city/nicho must not insert duplicate leads or cards into SQLite; duplicate metrics must be tracked and shown to the user.

---

### Task 1: Phone Normalizer, Website Classifier & Google Maps Crawler Service

**Files:**
- Create: `crm/src/lib/phone-normalizer.ts`
- Create: `crm/src/lib/website-detector.ts`
- Create: `crm/src/lib/maps-crawler.ts`
- Test: `crm/tests/maps-crawler.test.ts`

**Interfaces:**
- Consumes: `playwright` (`chromium`), Brazilian DDD sets, social domain regexes.
- Produces:
  - `normalizePhone(rawPhone: string | undefined | null): PhoneNormalizationResult`
  - `detectWebsiteType(rawUrl: string | undefined | null): WebsiteDetectionResult`:
    ```typescript
    export interface WebsiteDetectionResult {
      isProprietary: boolean;
      hasWebsite: boolean;
      url: string | null;
      socialType?: 'instagram' | 'whatsapp' | 'facebook' | 'biolink' | 'other_social';
      socialUrl?: string;
    }
    ```
  - `buildSearchQuery(options: { nicho?: string; regiao?: string; busca?: string }): string`
  - `crawlGoogleMaps(query: string, limit: number, options?: CrawlerOptions): Promise<ScrapedLead[]>`
  - Types: `ScrapedLead`, `CrawlerOptions`, `PhoneNormalizationResult`, `WebsiteDetectionResult`.

- [ ] **Step 1: Write the failing unit tests for Phone Normalizer, Website Detector and Query Builder**

Create `crm/tests/maps-crawler.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { normalizePhone } from '../src/lib/phone-normalizer';
import { detectWebsiteType } from '../src/lib/website-detector';
import { buildSearchQuery } from '../src/lib/maps-crawler';

describe('Phone Normalizer', () => {
  it('normalizes valid 11-digit Brazilian mobile numbers with DDD', () => {
    const res = normalizePhone('(19) 98765-4321');
    expect(res.isValid).toBe(true);
    expect(res.normalized).toBe('19987654321');
    expect(res.formatted).toBe('(19) 98765-4321');
  });

  it('normalizes valid 10-digit Brazilian landline numbers', () => {
    const res = normalizePhone('+55 11 3456-7890');
    expect(res.isValid).toBe(true);
    expect(res.normalized).toBe('1134567890');
    expect(res.formatted).toBe('(11) 3456-7890');
  });

  it('handles invalid phone numbers gracefully', () => {
    const res = normalizePhone('1234');
    expect(res.isValid).toBe(false);
  });
});

describe('Website Classifier (Social / Biolink vs Proprietary Website)', () => {
  it('identifies Instagram links as NOT proprietary websites', () => {
    const res = detectWebsiteType('https://www.instagram.com/dra.psicologa');
    expect(res.isProprietary).toBe(false);
    expect(res.hasWebsite).toBe(false);
    expect(res.socialType).toBe('instagram');
    expect(res.socialUrl).toBe('https://www.instagram.com/dra.psicologa');
  });

  it('identifies WhatsApp links (wa.me) as NOT proprietary websites', () => {
    const res = detectWebsiteType('https://wa.me/5519999999999');
    expect(res.isProprietary).toBe(false);
    expect(res.hasWebsite).toBe(false);
    expect(res.socialType).toBe('whatsapp');
  });

  it('identifies Linktree / Beacons biolinks as NOT proprietary websites', () => {
    const res1 = detectWebsiteType('https://linktr.ee/clinicaviver');
    expect(res1.isProprietary).toBe(false);
    expect(res1.hasWebsite).toBe(false);
    expect(res1.socialType).toBe('biolink');

    const res2 = detectWebsiteType('https://beacons.ai/dra_maria');
    expect(res2.isProprietary).toBe(false);
    expect(res2.hasWebsite).toBe(false);
    expect(res2.socialType).toBe('biolink');
  });

  it('identifies real domain websites as proprietary', () => {
    const res = detectWebsiteType('https://clinicabemviver.com.br');
    expect(res.isProprietary).toBe(true);
    expect(res.hasWebsite).toBe(true);
    expect(res.url).toBe('https://clinicabemviver.com.br');
    expect(res.socialType).toBeUndefined();
  });

  it('handles empty or null website values', () => {
    const res = detectWebsiteType(null);
    expect(res.isProprietary).toBe(false);
    expect(res.hasWebsite).toBe(false);
    expect(res.url).toBeNull();
  });
});

describe('Search Query Builder', () => {
  it('builds query combining nicho and regiao with "em"', () => {
    const query = buildSearchQuery({ nicho: 'Psicólogas', regiao: 'Campinas SP' });
    expect(query).toBe('Psicólogas em Campinas SP');
  });

  it('handles empty regiao or nicho without extra spaces', () => {
    expect(buildSearchQuery({ nicho: 'Dentistas', regiao: '' })).toBe('Dentistas');
    expect(buildSearchQuery({ nicho: '', regiao: 'São Paulo' })).toBe('São Paulo');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --prefix crm tests/maps-crawler.test.ts`
Expected: FAIL with "Cannot find module '../src/lib/phone-normalizer'".

- [ ] **Step 3: Implement `phone-normalizer.ts`, `website-detector.ts` and `maps-crawler.ts`**

Create `crm/src/lib/phone-normalizer.ts`:
- Full validation for Brazilian DDDs (11-99), mobile 9-digit prefix, +55 prefix removal, leading 0 removal.
- Return `{ normalized: string, formatted: string, isValid: boolean }`.

Create `crm/src/lib/website-detector.ts`:
- Define list/regex of non-proprietary domains:
  - Instagram: `instagram.com`, `instagr.am`
  - WhatsApp: `wa.me`, `api.whatsapp.com`, `whatsapp.com`, `chat.whatsapp.com`
  - Facebook: `facebook.com`, `fb.com`, `m.facebook.com`
  - Biolinks: `linktr.ee`, `beacons.ai`, `bio.site`, `taplink.cc`, `campsite.bio`, `instabio.cc`, `linkr.bio`, `direct.me`
  - Other social: `tiktok.com`, `youtube.com`, `linkedin.com`
- Return `WebsiteDetectionResult`.

Create `crm/src/lib/maps-crawler.ts`:
- Export `buildSearchQuery(options: { nicho?: string; regiao?: string; busca?: string }): string`.
- Define interface `ScrapedLead`:
  ```typescript
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
  ```
- Export `crawlGoogleMaps(query: string, limit: number, options?: CrawlerOptions): Promise<ScrapedLead[]>`:
  - Options include `onlyWithoutWebsite?: boolean` (defaults to `true`).
  - Launches Chromium headless with anti-bot and pt-BR locale options (`--no-sandbox`, `--lang=pt-BR`).
  - Navigates to `https://www.google.com/maps/search/${encodeURIComponent(query)}?hl=pt-BR`.
  - Automatically clicks cookie consent modals if present (`Aceitar tudo`, `Concordo`).
  - Feed scrolling loop with `consecutiveNoNewItems` detection.
  - Detail extraction uses `detectWebsiteType` on `a[data-item-id="authority"]`.
  - **No-website filter check:** If `options?.onlyWithoutWebsite` is `true` and `detection.isProprietary` is `true`, notify progress (`"Ignorado (já tem site próprio): " + lead.name`) and **do not increment `leads.length`**, continuing to the next listing!
  - If social URL detected (e.g. Instagram or WhatsApp), include in `lead.socialUrl` and append `"[Instagram]: url"` to `lead.notes`.
  - Fires `options.onProgress(current, total, leadName, leadData)` on each accepted lead.
  - Ensures `browser.close()` in `finally` block.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test --prefix crm tests/maps-crawler.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add crm/src/lib/phone-normalizer.ts crm/src/lib/website-detector.ts crm/src/lib/maps-crawler.ts crm/tests/maps-crawler.test.ts
git commit -m "feat(crm): add phone normalizer, website classifier and maps crawler with no-website filter"
```

---

### Task 2: Streaming Lead Extraction API Route (SSE)

**Files:**
- Create: `crm/src/app/api/scraper/extract/route.ts`
- Test: `crm/tests/scraper-extract-api.test.ts`

**Interfaces:**
- Consumes:
  - `crm/src/lib/maps-crawler.ts`: `buildSearchQuery`, `crawlGoogleMaps`
  - `crm/src/lib/deduplicator.ts`: `ingestRawLeads`
- Produces:
  - `POST /api/scraper/extract` responding with `text/event-stream`.
  - Stream events (JSON lines):
    - `type: 'start'`: `{ totalRequested: number, query: string, onlyWithoutWebsite: boolean }`
    - `type: 'progress'`: `{ current: number, total: number, lead: ScrapedLead }`
    - `type: 'ingesting'`: `{ totalFound: number }`
    - `type: 'complete'`: `{ summary: IngestionSummary, leads: ScrapedLead[] }`
    - `type: 'error'`: `{ message: string }`

- [ ] **Step 1: Write integration test for the extraction API logic**

Create `crm/tests/scraper-extract-api.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as mapsCrawler from '../src/lib/maps-crawler';
import * as deduplicator from '../src/lib/deduplicator';

describe('Scraper Extract API Logic', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('validates required fields nicho or regiao', () => {
    const query = mapsCrawler.buildSearchQuery({ nicho: '', regiao: '' });
    expect(query).toBe('');
  });

  it('calls ingestRawLeads with scraped leads without proprietary websites and returns ingestion summary', async () => {
    const mockLeads: mapsCrawler.ScrapedLead[] = [
      {
        name: 'Clínica Bem Viver',
        phone: '(19) 99876-5432',
        normalizedPhone: '19998765432',
        nicho: 'Psicologia',
        hasWebsite: false,
        isProprietaryWebsite: false,
        socialType: 'instagram',
        socialUrl: 'https://instagram.com/clinicabemviver',
        notes: 'Instagram: https://instagram.com/clinicabemviver',
        location: 'Campinas SP',
        rating: 4.9,
        reviewsCount: 18,
      },
    ];

    vi.spyOn(deduplicator, 'ingestRawLeads').mockResolvedValueOnce({
      totalReceived: 1,
      insertedCount: 1,
      duplicatesCount: 0,
      cardsCreated: 1,
    });

    const summary = await deduplicator.ingestRawLeads(mockLeads);
    expect(summary.insertedCount).toBe(1);
    expect(summary.cardsCreated).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify baseline**

Run: `npm test --prefix crm tests/scraper-extract-api.test.ts`
Expected: PASS

- [ ] **Step 3: Implement `crm/src/app/api/scraper/extract/route.ts`**

Implement `POST /api/scraper/extract` supporting Server-Sent Events (SSE):
- Read JSON body: `{ nicho: string, regiao: string, limite?: number, onlyWithoutWebsite?: boolean, boardId?: string, columnId?: string }`.
- Default `onlyWithoutWebsite` to `true` if not specified.
- Validate `nicho` and `regiao` (at least one must be provided); validate `limite` (integer between 1 and 100, default 20).
- Initialize database via `initDatabase()`.
- Return a `Response` with a `ReadableStream` and headers:
  ```typescript
  {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
  }
  ```
- In the stream runner:
  - Helper `sendEvent(data: Record<string, any>)` writes `data: ${JSON.stringify(data)}\n\n` encoded as UTF-8.
  - Send event `type: 'start'`.
  - Call `crawlGoogleMaps(query, limit, { nicho, onlyWithoutWebsite, onProgress: (cur, tot, name, lead) => { sendEvent({ type: 'progress', current: cur, total: tot, leadName: name, lead }); } })`.
  - Once crawl completes, send event `type: 'ingesting'`.
  - Call `ingestRawLeads(leads, { boardId, columnId })`.
  - Send event `type: 'complete'`, payload: `{ summary, leads }`.
  - Close stream writer.
  - Handle exceptions with `sendEvent({ type: 'error', message })` and close stream writer.

- [ ] **Step 4: Verify test suite passes**

Run: `npm test --prefix crm tests/scraper-extract-api.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add crm/src/app/api/scraper/extract/route.ts crm/tests/scraper-extract-api.test.ts
git commit -m "feat(crm): implement SSE streaming lead extraction API route with no-website filtering"
```

---

### Task 3: In-CRM Lead Extractor UI Page

**Files:**
- Create: `crm/src/app/scraper/page.tsx`

**Interfaces:**
- Consumes:
  - `POST /api/scraper/extract` via `fetch` and `ReadableStreamDefaultReader`.
  - `/api/boards` to list available Kanban boards (optional custom target).
- Produces:
  - Full React UI at `/scraper` with form controls, website filter toggle, animated progress bar, live logs feed, metric counters, and results preview table.

- [ ] **Step 1: Implement `crm/src/app/scraper/page.tsx`**

Features to implement:
1. **Extraction Configuration Form:**
   - Input for `Nicho` (e.g. "Psicólogas") with quick-selection pills:
     - "Psicólogas", "Dentistas", "Nutricionistas", "Clínicas de Estética", "Advogados", "Academias".
   - Input for `Região / Cidade` (e.g. "Campinas SP", "Moema São Paulo").
   - Selector for `Quantidade` (10, 20, 50, 100).
   - **Filter Toggle Checkbox (Checked by default):**
     - `[x] Filtrar apenas negócios sem site próprio (ignora quem já tem site; Instagram/WhatsApp contam como sem site)`
     - Small helper text explaining: *"Perfeito para quem vende sites: se o negócio colocou Instagram ou WhatsApp no Google Maps em vez de um domínio próprio, ele será capturado!"*
   - "Iniciar Extração" button with loading spinner (`Loader2`), disabled when input is missing or extraction is in progress.
   - "Cancelar" button to abort current stream via `AbortController`.
2. **Live Extraction Progress Display:**
   - Visual progress bar with animated transition: `[current / total] (percentage%)`.
   - Badge showing currently scraped lead name.
   - Terminal/Console log window showing live stream of discovered businesses with timestamp and contact status (e.g. `[12:30:15] ✅ Encontrado: Clínica Viva Bem (Possui Instagram, sem site próprio)`).
3. **Extraction Results Summary Cards:**
   - Total Encontrados (e.g. 20)
   - Novos Inseridos no CRM (e.g. 18)
   - Duplicados Ignorados (e.g. 2)
   - **Sem Website Próprio** (e.g. 20) — Highlighted in emerald/green or amber with fire/target icon (*Oportunidades de Venda de Site*).
4. **Interactive Discovered Leads Table:**
   - Columns: Nome, Telefone (formatado), Website / Canal Social (ex: badge *"Sem site (Instagram)"*, *"Sem site (WhatsApp)"*, *"Sem site"*, ou link externo se tiver site), Avaliação (estrelas + contagem), Cidade/Endereço, Status no CRM (*"Cadastrado"* / *"Duplicado"*).
5. **Direct Navigation Actions:**
   - "Ver no Kanban Funil" (links to `/kanban`)
   - "Ver na Tabela de Leads" (links to `/leads`)
   - "Nova Extração" (resets state for next search)

- [ ] **Step 2: Run Next.js build to verify no syntax or type errors in the page**

Run: `npm run build --prefix crm`
Expected: Build succeeds, compiling `/scraper` as a valid App Router route.

- [ ] **Step 3: Commit**

```bash
git add crm/src/app/scraper/page.tsx
git commit -m "feat(crm): create in-CRM lead extractor UI with no-website prioritization"
```

---

### Task 4: Navigation Integration (Navbar)

**Files:**
- Modify: `crm/src/components/layout/Navbar.tsx`

**Interfaces:**
- Consumes: `lucide-react` (`Compass` icon).
- Produces: Adds `/scraper` item to main navigation header.

- [ ] **Step 1: Update `crm/src/components/layout/Navbar.tsx`**

Add `Compass` from `lucide-react` and insert `{ label: 'Extrair Leads', href: '/scraper', icon: Compass }` into `navItems`:
```typescript
const navItems = [
  { label: 'Tabela de Leads', href: '/leads', icon: Table },
  { label: 'Kanban Funil', href: '/kanban', icon: LayoutGrid },
  { label: 'Extrair Leads', href: '/scraper', icon: Compass },
  { label: 'Agendamentos', href: '/scheduled', icon: Calendar },
  { label: 'Configurações', href: '/settings', icon: Settings },
];
```

- [ ] **Step 2: Run tests in `crm` to ensure layout components render without breaking**

Run: `npm test --prefix crm`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add crm/src/components/layout/Navbar.tsx
git commit -m "feat(crm): add Extrair Leads navigation item to Navbar"
```

---

### Task 5: End-to-End Verification & Production Build

**Files:**
- Verify: Full CRM workspace test suite and build output.

- [ ] **Step 1: Execute complete Vitest suite in `crm`**

Run: `npm test --prefix crm`
Expected: All 16+ test files and 60+ tests passing.

- [ ] **Step 2: Execute Next.js production build**

Run: `npm run build --prefix crm`
Expected: Clean Next.js compilation with static & dynamic routes generated (`/leads`, `/kanban`, `/scraper`, `/scheduled`, `/settings`, `/api/scraper/extract`).

- [ ] **Step 3: Verify direct database ingestion flow**

Ensure database schema migrations, boards, cards, and leads are properly synced when sample leads are extracted.

---

## Execution Handoff

Please review the plan. Which execution approach would you prefer?

- **Subagent-driven** - A fresh subagent implements each task and a fresh reviewer checks it before the next one starts, then a whole-branch review at the end. Most thorough; costs a fresh context per task and per review.
- **Native (Recomendado)** - I implement every task myself in this session, the way this harness runs work, then one fresh reviewer on the most capable model checks the whole branch. Cheapest and fastest; no independent review until the end.

Does the updated plan capture what you want, and which approach should we use?
