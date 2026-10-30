# Plano de Correção: Formatação de Saída CSV para Excel (Colunas & Células Únicas)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir a exportação CSV do Scraper para que planilhas abram nativamente no Microsoft Excel (Windows/Brasil) com colunas perfeitamente divididas (A, B, C, D...) e cada lead em uma única linha legível, sem agrupar todo o conteúdo em uma única célula ou coluna.

**Architecture:** Atualizar o `csv-exporter.ts` no Scraper para sanitizar quebras de linha internas em endereços/textos, adotar o delimitador padrão ponto e vírgula (`;`) com `\r\n` (CRLF) e suporte à diretiva `sep=;`, e atualizar o `csv-parser.ts` no CRM para reconhecer de forma resiliente tanto arquivos novos (`;`) quanto antigos (`,`).

**Tech Stack:** TypeScript, Node.js, PapaParse, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-29-google-maps-scraper-crm-design.md`

---

## 🔍 Análise de Causa Raiz

1. **Incompatibilidade de Delimitador Regional (Vírgula vs Ponto e Vírgula)**:
   - No Windows em português do Brasil (pt-BR), a vírgula `,` é o separador decimal oficial (ex: `R$ 10,50`). Por padrão, o Excel no Brasil não usa vírgula como separador de colunas em arquivos CSV; ele espera **ponto e vírgula (`;`)**.
   - Ao abrir um CSV com vírgulas no Excel com duplo clique, o Excel coloca **toda a linha dentro da Coluna A**.
2. **Quebras de Linha Ocultas em Endereços (`\n` dentro do campo)**:
   - O Google Maps frequentemente retorna endereços formatados com quebras de linha (`\n` ou `\r\n`).
   - Quando um campo com `\n` é envelopado entre aspas (RFC 4180), e o arquivo já está condensado na Coluna A pela falta do `;`, o Excel interpreta o conteúdo como uma **célula gigante com múltiplas linhas empilhadas**, gerando o efeito relatado de "várias linhas em uma única célula".
3. **Final de Linha Unix (LF `\n` vs Windows CRLF `\r\n`)**:
   - O exporter atual concatenava as linhas com `\n`. O Excel para Windows requer estritamente `\r\n` para renderização consistente.

---

## Global Constraints

- **Compatibilidade Bidirecional**: O CRM Web precisa continuar importando perfeitamente tanto arquivos CSV novos (separados por `;`) quanto arquivos legados (separados por `,`).
- **Padrão Ponytail**: Solução mais enxuta e robusta possível, sem introduzir bibliotecas pesadas adicionais de Excel (ex: xlsx / exceljs) se o CSV formatado com RFC 4180 + `;` resolver 100% nativamente.
- **TDD**: Todos os novos comportamentos (sanitização de quebra de linha, delimitador `;` e CRLF) devem ser cobertos por testes unitários no Scraper e no CRM.

---

## Review Focus

1. **Sanitização de Quebras de Linha**: Endereços com `\n`, `\r` ou tabs devem ser convertidos em espaços únicos ou `" - "` (ex: `"Rua A\nBairro B"` -> `"Rua A - Bairro B"`).
2. **Escape de Caracteres Especiais**: Campos com aspas duplas (`"`), ponto e vírgula (`;`) ou vírgulas (`,`) devem ter aspas duplicadas e escape correto.
3. **Diretiva de Reconhecimento Automático do Excel**: Opcional/Suporte à linha de metadados `sep=;` para forçar o Excel internacional a abrir em colunas automaticamente.
4. **Compatibilidade com PapaParse no CRM**: O parser do CRM deve ignorar a linha `sep=;` se presente e detectar o delimitador `;` sem quebrar.
5. **Zero Perda de Dados**: Todos os 10 campos (`name`, `phone`, `normalized_phone`, `nicho`, `has_website`, `website`, `location`, `rating`, `reviews_count`, `google_maps_url`) devem permanecer intactos.

---

### Task 1: Scraper — Sanitização de Campos e Exportador CSV com Ponto e Vírgula (`;`) e CRLF

**Files:**
- Modify: `scraper/src/csv-exporter.ts`
- Modify: `scraper/src/cli.ts`
- Modify: `scraper/tests/csv-exporter.test.ts`

**Interfaces:**
- Produces:
  - `exportLeadsToCsv(leads: ScrapedLead[], outputPath?: string, options?: CsvExportOptions): Promise<string>`
  - `CsvExportOptions`: `{ delimiter?: ';' | ','; includeSepHeader?: boolean }` (default delimiter: `';'`)
  - Sanitização automática de strings: remove `\r\n`, `\n` e `\r` substituindo por `" - "`.
  - Quebra de linhas do arquivo em `\r\n` (CRLF).

- [ ] **Step 1: Escrever testes unitários falhando em `scraper/tests/csv-exporter.test.ts`**
  - Testar que endereço com quebras de linha (`"Rua A\nCampinas - SP"`) é sanitizado para `"Rua A - Campinas - SP"`.
  - Testar que o delimitador gerado por padrão é `;`.
  - Testar que as quebras de linha do arquivo usam `\r\n`.

- [ ] **Step 2: Executar teste para verificar que falha**
  - Run: `npm --workspace=scraper test`
  - Expected: FAIL

- [ ] **Step 3: Implementar a sanitização e o delimitador `;` em `scraper/src/csv-exporter.ts`**
  - Adicionar função `sanitizeString(val: string): string` que substitui `[\r\n\t]+` por `" - "` e remove espaços duplicados.
  - Atualizar `escapeCsvField` para considerar `;`, `"`, `,` e envolver entre aspas duplicando as existentes.
  - Usar `rows.map(r => r.join(';')).join('\r\n') + '\r\n'` com UTF-8 BOM.
  - Adicionar flag opcional `--delimitador` no CLI (`scraper/src/cli.ts`).

- [ ] **Step 4: Executar testes para verificar que passam**
  - Run: `npm --workspace=scraper test`
  - Expected: PASS

- [ ] **Step 5: Commit atômico**
  - `git commit -m "fix(scraper): export CSV with semicolon delimiter, CRLF and sanitized multiline fields for Excel compatibility"`

---

### Task 2: CRM — Suporte a Delimitadores Dinâmicos e Cabeçalho `sep=` no PapaParse

**Files:**
- Modify: `crm/src/lib/csv-parser.ts`
- Modify: `crm/tests/csv-parser.test.ts` (ou criar)
- Modify: `crm/tests/deduplicator.test.ts`

**Interfaces:**
- Consumes: CSV gerado pelo Scraper tanto com `;` quanto com `,`.
- Produces: `parseCsv(csvContent: string): ParsedLead[]` suportando arquivos com ou sem `sep=;` e auto-detectando `;` ou `,`.

- [ ] **Step 1: Escrever testes para parser com `;` e com `sep=;`**
  - Testar parsing de CSV com ponto e vírgula.
  - Testar parsing de CSV legado com vírgula.
  - Testar remoção limpa do prefixo `sep=;`.

- [ ] **Step 2: Executar testes para verificar falha/comportamento**
  - Run: `npm --workspace=crm test`

- [ ] **Step 3: Implementar tratamento em `crm/src/lib/csv-parser.ts`**
  - Remover qualquer linha inicial que case com `/^sep=[;,]\r?\n/i`.
  - Configurar PapaParse para detecção automática inteligente ou respeitar delimitador `;`/`,`.

- [ ] **Step 4: Executar testes para verificar aprovação**
  - Run: `npm --workspace=crm test`
  - Expected: PASS

- [ ] **Step 5: Commit atômico**
  - `git commit -m "fix(crm): enhance CSV parser to seamlessly support semicolon delimiter and sep directive"`

---

### Task 3: Verificação Integrada Ponta a Ponta (E2E) & Validação no Excel

**Files:**
- Modify: `scripts/test-e2e-pipeline.ts`

**Interfaces:**
- Produces: Validação ponta a ponta do pipeline com a nova formatação.

- [ ] **Step 1: Atualizar `scripts/test-e2e-pipeline.ts` para testar CSV com `;` e multiline**
  - Incluir lead com endereço multiline (`"Av. Paulista, 1000\nBela Vista\nSão Paulo - SP"`).
  - Validar que o CSV é gerado com `;`, sem quebras internas de linha, e que o CRM importa corretamente.

- [ ] **Step 2: Executar o teste E2E**
  - Run: `npm run test:e2e`
  - Expected: ALL 8 PIPELINE VERIFICATION STEPS PASSED SUCCESSFULLY!

- [ ] **Step 3: Gerar arquivo de teste real e validar formato**
  - Run: `npm run scrape -- --nicho="farmacias" --regiao="Campinas, SP" --limite=3`
  - Validar que o arquivo gerado abre perfeitamente dividido em colunas no Excel.

- [ ] **Step 4: Commit atômico final**
  - `git commit -m "test: update e2e pipeline test with semicolon CSV and sanitized fields"`
