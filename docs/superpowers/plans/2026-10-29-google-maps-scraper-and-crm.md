# Google Maps Scraper & Personal CRM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an integrated, decoupled toolset containing (1) a standalone TypeScript/Playwright Google Maps scraper CLI that exports structured CSVs of local businesses and (2) a personal fullstack Next.js web CRM with intelligent phone deduplication, multiple customizable Kanbans (for leads and tasks), advanced filtering/sorting, and dynamic WhatsApp Click-to-Chat integration.

**Architecture:** Monorepo with two decoupled workspaces: `scraper/` (CLI tool using Playwright for headless web crawling, CLI flags via commander, interactive prompts via inquirer/prompts, and CSV writing) and `crm/` (Next.js 15 App Router, Tailwind CSS, Shadcn UI components, SQLite local database via Drizzle ORM with WAL mode, and server actions/route handlers for data mutations and CSV import).

**Tech Stack:** TypeScript, Node.js (v24), Playwright, Next.js (App Router), Tailwind CSS, Lucide React, Drizzle ORM, better-sqlite3 / @libsql/client, PapaParse, Zod, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-29-google-maps-scraper-crm-design.md`

## Global Constraints

- **Language & Runtime:** TypeScript only across both subsystems, running on Node.js v24 (no Python runtime required).
- **Database:** Local SQLite file (`crm.db`) via Drizzle ORM with zero external database server requirements.
- **Cost & Dependencies:** 100% free; zero external paid APIs (no Google Cloud API keys, no Twilio, no paid WhatsApp bots).
- **Messaging Safety:** WhatsApp Click-to-Chat via `wa.me/55...` and `whatsapp://` URL protocol with URL-encoded dynamic parameters; zero unofficial bot libraries (Baileys/Evolution) that risk number ban.
- **Code Style (Ponytail):** Smallest code footprint that completely satisfies each requirement. No redundant wrapper classes or unnecessary abstractions.

## Review Focus

1. **Brazilian Phone Number Normalization:** Handle raw formats `(11) 98765-4321`, `+55 11 98765-4321`, `011987654321`, `11 3234-5678`, and missing/empty phones without false collisions.
2. **Google Maps DOM & Infinite Scroll Fallbacks:** Handles listings without website, without rating, or without phone without selector crash, and halts gracefully when end of list is reached.
3. **CSV Parsing with UTF-8 BOM and Missing Columns:** Handles files exported from different OS/Excel tools containing BOM characters or extra whitespace.
4. **Intra-batch & Inter-database Duplicate Detection:** Accurately groups duplicates within the uploaded CSV file itself as well as matches against existing leads in SQLite.
5. **URL Encoding in WhatsApp Message Templates:** Line breaks (`\n`), emojis, and special characters (`&`, `?`, `%`) must encode cleanly via `encodeURIComponent` so WhatsApp Web receives the exact message text.

---

### Task 1: Monorepo Scaffolding & Root Configuration

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Modify: `.gitignore`

**Interfaces:**
- Produces: Monorepo workspace configuration (`workspaces: ["scraper", "crm"]`) and shared NPM scripts (`npm run scrape`, `npm run crm:dev`).

- [ ] **Step 1: Write root `package.json` and base TypeScript configuration**

Define `workspaces: ["scraper", "crm"]`, dev dependencies (`typescript`), and top-level scripts:
`"scrape": "npm run start --workspace=scraper"`
`"crm:dev": "npm run dev --workspace=crm"`

- [ ] **Step 2: Verify npm workspaces setup**

Run: `npm install`
Expected: Success, clean npm lockfile generated.

- [ ] **Step 3: Commit**

```bash
git add package.json tsconfig.base.json .gitignore
git commit -m "chore: scaffold monorepo workspaces and root configuration"
```

---

### Task 2: Scraper Core — Phone Normalization & CSV Exporter

**Files:**
- Create: `scraper/package.json`
- Create: `scraper/tsconfig.json`
- Create: `scraper/src/types.ts`
- Create: `scraper/src/normalizer.ts`
- Create: `scraper/src/csv-exporter.ts`
- Test: `scraper/tests/normalizer.test.ts`
- Test: `scraper/tests/csv-exporter.test.ts`

**Interfaces:**
- Produces:
  - `normalizePhone(rawPhone: string | undefined | null): { normalized: string; formatted: string; isValid: boolean }`
  - `exportLeadsToCsv(leads: ScrapedLead[], outputPath: string): Promise<string>`
  - Type `ScrapedLead`: `{ name: string; phone: string; normalizedPhone: string; niche: string; hasWebsite: boolean; website?: string; location?: string; rating?: number; reviewsCount?: number; googleMapsUrl?: string }`

- [ ] **Step 1: Write the failing tests for phone normalization & CSV export**

Test `normalizePhone` handling:
- `(11) 98765-4321` -> normalized: `11987654321`
- `+55 (19) 3234-5678` -> normalized: `1932345678`
- `""` or `undefined` -> isValid: false, normalized: `""`
Test `exportLeadsToCsv` creating a file with proper UTF-8 headers and escaped quotes.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace=scraper test`
Expected: FAIL (modules not found)

- [ ] **Step 3: Implement `normalizer.ts` and `csv-exporter.ts`**

Implement pure phone regex sanitization and CSV generation using standard CSV formatting.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --workspace=scraper test`
Expected: PASS (all tests green)

- [ ] **Step 5: Commit**

```bash
git add scraper/
git commit -m "feat(scraper): implement phone normalizer and csv exporter with tests"
```

---

### Task 3: Scraper CLI & Google Maps Playwright Crawler

**Files:**
- Create: `scraper/src/crawler.ts`
- Create: `scraper/src/cli.ts`
- Modify: `scraper/package.json` (add dependencies: `playwright`, `commander`, `prompts`)

**Interfaces:**
- Consumes: `ScrapedLead`, `normalizePhone`, `exportLeadsToCsv` from Task 2.
- Produces:
  - `crawlGoogleMaps(query: string, limit: number, options?: CrawlerOptions): Promise<ScrapedLead[]>`
  - CLI binary in `scraper/src/cli.ts` handling flags `--nicho`, `--regiao`, `--busca`, `--limite`, `--saida` and interactive fallback.

- [ ] **Step 1: Write unit test for CLI argument parser and search query builder**

Test: `scraper/tests/cli-query.test.ts`
Verify that `buildSearchQuery({ nicho: 'dentistas', regiao: 'Campinas, SP' })` produces `"dentistas em Campinas, SP"`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace=scraper test`
Expected: FAIL

- [ ] **Step 3: Implement crawler logic and CLI wrapper**

- In `crawler.ts`: Launch Playwright Chromium headless, navigate to `https://www.google.com/maps/search/<query>`, accept cookies banner if present, scroll the `div[role="feed"]` panel until desired count is found, and extract listings with robust selector fallbacks.
- In `cli.ts`: Parse CLI args via `commander`. If no args provided, prompt via `prompts`. Execute crawl, call `exportLeadsToCsv`, and print summary with lead count and output file path.

- [ ] **Step 4: Run crawler unit & smoke test**

Run: `npm --workspace=scraper test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scraper/
git commit -m "feat(scraper): implement Google Maps crawler and interactive CLI"
```

---

### Task 4: CRM Next.js Scaffolding & Database Schema (Drizzle + SQLite)

**Files:**
- Create: `crm/package.json`
- Create: `crm/drizzle.config.ts`
- Create: `crm/src/db/schema.ts`
- Create: `crm/src/db/index.ts`
- Create: `crm/src/types/index.ts`
- Test: `crm/tests/schema.test.ts`

**Interfaces:**
- Produces:
  - Drizzle tables: `leads`, `boards`, `columns`, `cards`, `messageTemplates`
  - Database instance `db` connected to SQLite with WAL enabled.
  - Helper `initDatabase(): Promise<void>` applying schema migrations or initial seed (default board "Geral", default columns: "Novo Lead", "Contato Feito", "Proposta", "Convertido", "Perdido").

- [ ] **Step 1: Write failing test for database initialization and schema constraints**

Test creating a board, columns, a lead with normalized phone, and verifying foreign key relationships.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace=crm test`
Expected: FAIL

- [ ] **Step 3: Implement `schema.ts`, `db/index.ts`, and initial default seed**

Define SQLite tables with Drizzle (`sqliteTable`), relations, and `initDatabase`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --workspace=crm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add crm/
git commit -m "feat(crm): scaffold Next.js app and Drizzle SQLite schema"
```

---

### Task 5: CRM CSV Import Engine & Smart Deduplication

**Files:**
- Create: `crm/src/lib/csv-parser.ts`
- Create: `crm/src/lib/deduplicator.ts`
- Create: `crm/src/app/api/leads/import/route.ts`
- Test: `crm/tests/csv-parser.test.ts`
- Test: `crm/tests/deduplicator.test.ts`

**Interfaces:**
- Consumes: `db`, `leads` table from Task 4.
- Produces:
  - `parseAndAnalyzeCsv(csvContent: string): Promise<ImportAnalysisResult>`
    Returns: `{ totalRows: number, newLeads: ParsedLead[], duplicateLeads: { lead: ParsedLead, existingLeadId: string }[] }`
  - `executeImport(leadsToInsert: ParsedLead[], options: ImportOptions): Promise<ImportSummary>`

- [ ] **Step 1: Write failing tests for duplicate detection**

Test analyzing a CSV containing 3 items:
- Item 1: brand new phone -> marked as `newLeads`
- Item 2: phone already in database -> marked as `duplicateLeads`
- Item 3: phone that repeats Item 1 inside the same file -> marked as intra-file duplicate

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace=crm test`
Expected: FAIL

- [ ] **Step 3: Implement `csv-parser.ts` and `deduplicator.ts`**

Use clean stream or buffered parsing, normalize phones, query existing phones in DB via single `IN (...)` or Set lookup, and generate preview metrics.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --workspace=crm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add crm/src/lib/ crm/tests/
git commit -m "feat(crm): implement CSV import analyzer and smart deduplicator"
```

---

### Task 6: CRM UI — CSV Import Modal & Quick Phone Lookup

**Files:**
- Create: `crm/src/components/import/CsvImportModal.tsx`
- Create: `crm/src/components/import/ImportPreview.tsx`
- Create: `crm/src/components/search/PhoneChecker.tsx`
- Modify: `crm/src/app/page.tsx`
- Create: `crm/src/app/api/leads/check-phone/route.ts`

**Interfaces:**
- Consumes: `/api/leads/import`, `deduplicator` from Task 5.
- Produces:
  - Header with `PhoneChecker` (instant lookup indicating if phone is registered, lead name, and current stage).
  - Modal `CsvImportModal` with drag-and-drop file upload, preview breakdown (Total, Novos, Já cadastrados), options ("Importar apenas novos" vs "Atualizar existentes"), target Kanban board selector, and submit action.

- [ ] **Step 1: Write unit tests for PhoneChecker API and preview calculations**

Test `/api/leads/check-phone?phone=11987654321` returns `{ exists: true, lead: { ... } }` or `{ exists: false }`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace=crm test`
Expected: FAIL

- [ ] **Step 3: Implement components and check-phone endpoint**

Build reactive search input with debouncing and import preview modal with status chips.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --workspace=crm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add crm/src/components/ crm/src/app/
git commit -m "feat(crm): add CSV import modal with preview and quick phone checker"
```

---

### Task 7: CRM UI — Leads Table with Advanced Sorting & Filters

**Files:**
- Create: `crm/src/components/leads/LeadsTable.tsx`
- Create: `crm/src/components/leads/LeadFilters.tsx`
- Create: `crm/src/app/leads/page.tsx`
- Create: `crm/src/app/api/leads/route.ts`
- Test: `crm/tests/leads-query.test.ts`

**Interfaces:**
- Consumes: `db.select().from(leads)`
- Produces:
  - Table showing: Name, Phone, Niche, Has Website (badge with external link if present), Location, Status (Novo, Em Contato, Convertido, Perdido), Date Added.
  - Sorting controls: by Niche (A-Z), Date (newest/oldest), Name (A-Z).
  - Filters: by Niche, Status, and Website existence.
  - Conversion toggle: direct button to toggle lead status between active and 'convertido'.

- [ ] **Step 1: Write failing test for leads query sorting and filtering**

Test ordering by `created_at desc`, `nicho asc`, and filtering by `has_website = 1`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace=crm test`
Expected: FAIL

- [ ] **Step 3: Implement LeadsTable and query builder**

Implement dynamic server query and responsive UI table with status badges and sorting buttons.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --workspace=crm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add crm/src/components/leads/ crm/src/app/leads/ crm/tests/
git commit -m "feat(crm): implement leads table with sorting, filtering, and status toggle"
```

---

### Task 8: CRM UI — Multiple Kanbans (Leads & Tasks)

**Files:**
- Create: `crm/src/components/kanban/KanbanBoard.tsx`
- Create: `crm/src/components/kanban/KanbanColumn.tsx`
- Create: `crm/src/components/kanban/KanbanCard.tsx`
- Create: `crm/src/components/kanban/BoardSelector.tsx`
- Create: `crm/src/app/kanban/page.tsx`
- Create: `crm/src/app/api/boards/route.ts`
- Create: `crm/src/app/api/cards/route.ts`
- Test: `crm/tests/kanban.test.ts`

**Interfaces:**
- Consumes: `boards`, `columns`, `cards`, `leads` tables.
- Produces:
  - Board manager: Create new Kanban board, switch active board, rename/delete board.
  - Column manager: Add custom column/stage, reorder columns, mark column as "Convertido" or "Perdido".
  - Cards: Cards can be Lead cards (showing company name, phone, niche, website badge) or Task cards (freestyle title, description, due date).
  - Move card between columns: updates card's `column_id` and automatically updates lead `status` if column is a converted/lost stage.

- [ ] **Step 1: Write failing test for card move and automatic status update**

Test moving a card to a column with `is_converted_stage = 1` updates the associated lead's `status` to `'convertido'`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace=crm test`
Expected: FAIL

- [ ] **Step 3: Implement Kanban UI and card move endpoints**

Create drag-and-drop or column selection dropdown, card rendering, and stage syncing.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --workspace=crm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add crm/src/components/kanban/ crm/src/app/kanban/ crm/tests/
git commit -m "feat(crm): implement multi-board kanban with custom stages for leads and tasks"
```

---

### Task 9: CRM WhatsApp Click-to-Chat & Message Templates Modal

**Files:**
- Create: `crm/src/components/whatsapp/WhatsAppModal.tsx`
- Create: `crm/src/lib/template-interpolator.ts`
- Create: `crm/src/app/api/templates/route.ts`
- Test: `crm/tests/template-interpolator.test.ts`

**Interfaces:**
- Consumes: `lead` object (`name`, `normalized_phone`, `nicho`, `location`), `messageTemplates` table.
- Produces:
  - `interpolateTemplate(template: string, vars: Record<string, string>): string`
  - `generateWhatsAppUrl(phone: string, text: string): string`
    Generates: `https://wa.me/55${phone}?text=${encodeURIComponent(text)}`
  - Component `WhatsAppModal`: template dropdown selector, live editable preview of message, and "Abrir no WhatsApp" button that triggers click-to-chat.

- [ ] **Step 1: Write failing test for template interpolation and WhatsApp URL generation**

Test:
- Template `"Olá {nome}, vi sua clínica de {nicho} em {cidade}!"` with variables `{ nome: "Dr. João", nicho: "Odontologia", cidade: "Campinas" }`
- URL generation handling spaces, line breaks, and emojis cleanly without double encoding.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace=crm test`
Expected: FAIL

- [ ] **Step 3: Implement template interpolator and WhatsAppModal component**

Connect WhatsApp action button to each lead row in table and Kanban card.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --workspace=crm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add crm/src/components/whatsapp/ crm/src/lib/ crm/tests/
git commit -m "feat(crm): implement WhatsApp Click-to-Chat modal with dynamic templates"
```

---

### Task 10: End-to-End Pipeline Verification & Polish

**Files:**
- Create: `scripts/test-e2e-pipeline.ts`
- Create: `README.md`
- Modify: `package.json`

**Interfaces:**
- Produces:
  - Synthetic end-to-end integration test: generates sample scraped leads, exports to CSV, feeds into CRM import engine, checks duplicate detection, verifies Kanban card creation, and tests WhatsApp URL generation.
  - Complete documentation in `README.md` explaining how to run the scraper (`npm run scrape`), start the CRM (`npm run crm:dev`), and use the full pipeline.

- [ ] **Step 1: Write E2E pipeline script**

Automates the complete workflow using SQLite in-memory / test database.

- [ ] **Step 2: Run E2E test**

Run: `npx tsx scripts/test-e2e-pipeline.ts`
Expected: All steps pass with green output.

- [ ] **Step 3: Write comprehensive `README.md`**

Document prerequisites (Node.js), installation (`npm install`), Playwright browser install (`npx playwright install chromium`), and daily usage instructions.

- [ ] **Step 4: Commit**

```bash
git add README.md scripts/ package.json
git commit -m "docs: add comprehensive README and end-to-end pipeline verification test"
```
