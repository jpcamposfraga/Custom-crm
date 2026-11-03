# Direct Scraper-to-CRM Pipeline & CSV Import Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow the scraper to send extracted leads directly to the CRM without requiring the user to manually create/export a CSV and upload it, while also fixing the CSV parser delimiter auto-detection so manual imports remain 100% reliable.

**Architecture:** 
1. Enhance the CRM import endpoint (`POST /api/leads/import`) and deduplicator (`crm/src/lib/deduplicator.ts`) to accept direct arrays of scraped leads (`ScrapedLead[]` or `ParsedLead[]`), perform automatic deduplication against phone numbers in SQLite, and insert new leads and Kanban cards into the default board.
2. Fix `parseCsv` in `crm/src/lib/csv-parser.ts` to explicitly detect delimiter (`;` vs `,`) from the first line, preventing Papa Parse auto-detection failures when quotes contain commas.
3. In `scraper/src/crm-client.ts` and `scraper/src/cli.ts`, automatically post scraped leads to the CRM API upon scraping completion, displaying real-time feedback (inserted count, duplicates skipped, cards created), while gracefully falling back to local CSV export if the CRM server is offline.

**Tech Stack:** Next.js 15, Drizzle ORM, LibSQL/SQLite, Commander.js, PapaParse, Vitest.

**Spec:** Direct pipeline specification requested by user:
- Directly ingest scraper leads into CRM.
- Skip manual CSV upload step.
- Preserve deduplication logic (reject duplicate phones).
- Auto-generate Kanban cards.
- Offline CRM fallback (keep CSV backup).
- Fix existing CSV parser issue in CRM.

## Global Constraints

- Monorepo directory: `C:\Users\João\custom-crm`.
- Workspace CRM: `C:\Users\João\custom-crm\crm`.
- Workspace Scraper: `C:\Users\João\custom-crm\scraper`.
- Keep code minimal and clean (Ponytail style).
- Zero breaking changes for existing manual CSV import.
- All tests must pass in Vitest for both `scraper` and `crm`.

## Review Focus

1. Semicolon-delimited CSV with commas inside quoted fields (addresses, Google Maps URLs) correctly identified as `;` delimiter without failing Papa Parse.
2. Scraper lead format (camelCase `normalizedPhone`, `hasWebsite`, `reviewsCount`, `googleMapsUrl`) cleanly mapped to CRM schema.
3. CRM deduplication skips leads with existing normalized phones (>= 8 digits) and does not crash on leads without phone numbers.
4. Scraper CLI handles CRM offline (`ECONNREFUSED` or timeout) gracefully without crashing, printing a helpful message and preserving the CSV backup.
5. Kanban cards are automatically created in the first column of the default board for newly ingested leads.

---

### Task 1: Fix CSV Parsing Delimiter & Robust Deduplication in CRM

**Files:**
- Modify: `crm/src/lib/csv-parser.ts`
- Modify: `crm/src/lib/deduplicator.ts`
- Test: `crm/tests/csv-parser.test.ts`
- Test: `crm/tests/deduplicator.test.ts`

**Interfaces:**
- Consumes: Raw CSV string from user upload or test files.
- Produces: `parseCsv(csvContent: string): ParsedLead[]` with explicit delimiter detection.

- [ ] **Step 1: Write failing test in `crm/tests/csv-parser.test.ts` for CSV with semicolon delimiter and commas inside quoted addresses/URLs**

```typescript
it('parses semicolon-delimited CSV with multiple commas inside quotes and URLs without delimiter confusion', () => {
  const csv =
    'name;phone;normalized_phone;nicho;has_website;website;location;rating;reviews_count;google_maps_url\r\n' +
    '"Equilibrium - Psicologia, Consultoria Ltda.";(47) 3435-4455;4734354455;Psicólogo;false;;"R. Ricardo Landmann, 85/97 - Santo Antônio, Joinville - SC, 89218-200";5;4;"https://www.google.com/maps/place/data=!4m7!3m6!1s0x94deafe82fe6ce93,19sChIJk87mL"\r\n' +
    'Clínica Amanda;;;Psicólogo;false;;;;;https://maps.google.com/amanda';

  const leads = parseCsv(csv);
  expect(leads).toHaveLength(2);
  expect(leads[0].name).toBe('Equilibrium - Psicologia, Consultoria Ltda.');
  expect(leads[0].phone).toBe('(47) 3435-4455');
  expect(leads[0].normalized_phone).toBe('4734354455');
  expect(leads[0].location).toContain('R. Ricardo Landmann, 85/97');
  expect(leads[1].name).toBe('Clínica Amanda');
  expect(leads[1].phone).toBe('');
});
```

- [ ] **Step 2: Run test to verify it fails or exposes edge cases**

Run: `cd "C:\Users\João\custom-crm\crm"; npx vitest run tests/csv-parser.test.ts`
Expected: FAIL or verify delimiter parsing.

- [ ] **Step 3: Update `parseCsv` in `crm/src/lib/csv-parser.ts` with explicit delimiter detection**

Detect delimiter by analyzing the header row (`firstLine.includes(';') ? ';' : ','`), and pass `delimiter` option explicitly to `Papa.parse`. Also ensure phone and normalized_phone always default to empty string if missing.

- [ ] **Step 4: Update `parseAndAnalyzeCsv` in `crm/src/lib/deduplicator.ts`**

Ensure that leads without phones are treated safely without colliding with each other or crashing database queries.

- [ ] **Step 5: Run tests and verify all pass**

Run: `cd "C:\Users\João\custom-crm\crm"; npx vitest run tests/csv-parser.test.ts tests/deduplicator.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add crm/src/lib/csv-parser.ts crm/src/lib/deduplicator.ts crm/tests/csv-parser.test.ts crm/tests/deduplicator.test.ts
git commit -m "fix(crm): improve csv delimiter detection and empty phone handling"
```

---

### Task 2: Direct Intake API Endpoint & Deduplication in CRM

**Files:**
- Create: `crm/tests/direct-import.test.ts`
- Modify: `crm/src/lib/deduplicator.ts`
- Modify: `crm/src/app/api/leads/import/route.ts`

**Interfaces:**
- Consumes: `{ leads: Array<Record<string, any>>, options?: ImportOptions }` via `POST /api/leads/import`.
- Produces: `{ success: true, summary: { totalReceived: number, insertedCount: number, duplicatesCount: number, cardsCreated: number } }`.

- [ ] **Step 1: Write failing test in `crm/tests/direct-import.test.ts`**

Test importing raw lead objects directly (both camelCase and snake_case fields), verifying deduplication against existing database leads, and verifying Kanban card creation.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "C:\Users\João\custom-crm\crm"; npx vitest run tests/direct-import.test.ts`
Expected: FAIL (missing direct ingest support in import route/deduplicator)

- [ ] **Step 3: Implement `ingestRawLeads(rawLeads, options)` in `crm/src/lib/deduplicator.ts`**

Map incoming lead fields:
- `name`: string
- `phone`: string
- `normalized_phone`: `lead.normalized_phone || lead.normalizedPhone || normalizePhone(lead.phone)`
- `has_website`: `lead.has_website !== undefined ? (lead.has_website ? 1 : 0) : (lead.hasWebsite ? 1 : 0)`
- `website`: `lead.website || null`
- `nicho`: `lead.nicho || 'Geral'`
- `location`: `lead.location || null`
- `rating`: `lead.rating ?? null`
- `reviews_count`: `lead.reviews_count ?? lead.reviewsCount ?? null`
- `google_maps_url`: `lead.google_maps_url ?? lead.googleMapsUrl ?? null`

Deduplicate against existing `normalized_phone` in DB. Insert new leads, create Kanban cards in default column, and return `{ totalReceived, insertedCount, duplicatesCount, cardsCreated }`.

- [ ] **Step 4: Update `POST /api/leads/import` in `crm/src/app/api/leads/import/route.ts`**

Accept `body.leads` or `body.leadsToInsert` or `body.csvContent`. When `body.leads` is supplied, invoke `ingestRawLeads`. Return `{ success: true, summary }`.

- [ ] **Step 5: Run tests and verify all pass**

Run: `cd "C:\Users\João\custom-crm\crm"; npx vitest run tests/direct-import.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add crm/src/lib/deduplicator.ts crm/src/app/api/leads/import/route.ts crm/tests/direct-import.test.ts
git commit -m "feat(crm): support direct leads ingestion with automatic deduplication"
```

---

### Task 3: Scraper Direct Sync Client & CLI Integration

**Files:**
- Create: `scraper/src/crm-client.ts`
- Create: `scraper/tests/crm-client.test.ts`
- Modify: `scraper/src/cli.ts`

**Interfaces:**
- Consumes: `leads: ScrapedLead[]` from crawler.
- Produces: `syncLeadsToCrm(leads: ScrapedLead[], options?: SyncOptions): Promise<SyncResult>`
- CLI Flags:
  - `--no-crm`: skip direct CRM sync (only save CSV).
  - `--crm-url <url>`: custom CRM URL (defaults to `http://localhost:3000`).

- [ ] **Step 1: Write failing test in `scraper/tests/crm-client.test.ts`**

Test `syncLeadsToCrm`:
1. Successfully sends leads payload to CRM endpoint and returns parsed summary.
2. Handles CRM offline (`ECONNREFUSED` or fetch rejection) without throwing an uncaught exception, returning `{ success: false, offline: true }`.
3. Handles non-200 responses with error details.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "C:\Users\João\custom-crm\scraper"; npx vitest run tests/crm-client.test.ts`
Expected: FAIL (`crm-client.ts` not found)

- [ ] **Step 3: Implement `scraper/src/crm-client.ts`**

Implement `syncLeadsToCrm(leads: ScrapedLead[], options?: { crmUrl?: string, timeoutMs?: number })`:
- Format URL: `${crmUrl}/api/leads/import`
- POST JSON payload `{ leads }` with a 5000ms timeout using `AbortSignal.timeout(5000)`.
- Catch network connection errors (`ECONNREFUSED`, fetch failed) and return `{ success: false, offline: true, error: string }`.
- On success (200), return `{ success: true, offline: false, summary: res.summary }`.

- [ ] **Step 4: Update `scraper/src/cli.ts`**

Add `--no-crm` and `--crm-url <url>` options.
After crawling and saving the backup CSV file:
```typescript
if (opts.crm !== false) {
  const crmUrl = opts.crmUrl || process.env.CRM_URL || 'http://localhost:3000';
  console.log(`\n📡 Sincronizando leads diretamente com o CRM (${crmUrl})...`);
  const result = await syncLeadsToCrm(leads, { crmUrl });
  if (result.success && result.summary) {
    console.log(`✅ ${result.summary.insertedCount} novos leads importados diretamente para o CRM!`);
    console.log(`📋 ${result.summary.cardsCreated} cards criados no Kanban.`);
    if (result.summary.duplicatesCount > 0) {
      console.log(`⚠️ ${result.summary.duplicatesCount} lead(s) duplicados foram ignorados.`);
    }
  } else if (result.offline) {
    console.log(`ℹ️ CRM offline (${crmUrl}). O arquivo CSV foi salvo e pode ser importado quando o CRM for iniciado.`);
  } else {
    console.warn(`⚠️ Não foi possível sincronizar com o CRM: ${result.error}`);
  }
}
```

- [ ] **Step 5: Run scraper tests and verify all pass**

Run: `cd "C:\Users\João\custom-crm\scraper"; npm test`
Expected: PASS (all tests green)

- [ ] **Step 6: Commit**

```bash
git add scraper/src/crm-client.ts scraper/src/cli.ts scraper/tests/crm-client.test.ts
git commit -m "feat(scraper): add direct crm synchronization with offline fallback"
```

---

### Task 4: Full Verification & Build Validation

**Files:**
- None (verification phase)

- [ ] **Step 1: Run complete CRM test suite**

Run: `cd "C:\Users\João\custom-crm\crm"; npm test`
Expected: All tests pass.

- [ ] **Step 2: Run complete Scraper test suite**

Run: `cd "C:\Users\João\custom-crm\scraper"; npm test`
Expected: All tests pass.

- [ ] **Step 3: Run production builds on both workspaces**

Run: `cd "C:\Users\João\custom-crm"; npm run scraper:build && npm run crm:build`
Expected: Clean build with zero TypeScript or Next.js compilation errors.

- [ ] **Step 4: End-to-end integration test with live CRM and mock scraper run**

Verify that executing direct ingest registers leads in DB and Kanban cards, and manual CSV upload also works seamlessly.
