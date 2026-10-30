# CRM Novas Funcionalidades: Configurações WhatsApp, Exclusão de Kanbans, Agendamento e Formatação de Contato

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar (1) suporte a links diretos para WhatsApp Web (`web.whatsapp.com/send`) e WhatsApp Desktop App (`whatsapp://send`), (2) tela de Configurações para definir a preferência padrão, (3) exibição obrigatória do telefone abaixo do nome do lead com tratamento de "Telefone não encontrado" e remoção do botão de mensagem, (4) agendamento de mensagens com data/hora e tela de gestão de agendamentos, e (5) exclusão de quadros Kanban com confirmação e exclusão em cascata.

**Architecture:** Atualização fullstack no workspace `/crm`:
- Atualização de `template-interpolator.ts` para gerar links diretos para Web e App com mensagem já preenchida no campo de texto.
- Criação das tabelas `settings` e `scheduled_messages` no schema SQLite (Drizzle ORM) com inicialização automática em `initDatabase()`.
- API endpoints: `/api/settings`, `/api/scheduled-messages`, e inclusão do método `DELETE` em `/api/boards`.
- Componentes de UI: Página `/settings`, página `/scheduled`, atualização do `WhatsAppModal` com aba de agendamento e seletor Web/App, atualização de `LeadsTable` e `KanbanCard` para telefone/botão condicional, e botão de excluir quadro no `BoardSelector`.

**Tech Stack:** Next.js 15 (App Router, React 19), TypeScript, Tailwind CSS, Lucide React, Drizzle ORM, @libsql/client (SQLite), Vitest.

**Spec:** `docs/superpowers/specs/2026-10-29-google-maps-scraper-crm-design.md`

---

## Global Constraints

- **Padrão Ponytail**: Código enxuto, sem dependências externas de cron pesadas; o agendamento é registrado no banco SQLite local com gestão visual e ação de disparo/conclusão na interface.
- **Link WhatsApp 100% Direto**: Abertura direta sem passar por `wa.me`, injetando a mensagem no campo de digitação do WhatsApp Web (`web.whatsapp.com/send?phone=...&text=...`) ou WhatsApp Desktop App (`whatsapp://send?phone=...&text=...`).
- **Tratamento de Leads sem Telefone**: Se o lead não possui telefone cadastrado, o texto "Telefone não encontrado" deve aparecer em cinza/itálico e o botão do WhatsApp deve ser ocultado em todas as telas (tabela e kanban).
- **Proteção do Funil**: A exclusão de um Kanban deve pedir confirmação do usuário e garantir limpeza limpa de cards e colunas associadas, selecionando outro quadro ativo.
- **TDD**: Testes unitários para as novas APIs, geração de links e persistência de agendamento/configurações.

---

## Review Focus

1. **Geração de URLs WhatsApp**: Formatação correta para Web (`https://web.whatsapp.com/send?phone=55...&text=...`) e App (`whatsapp://send?phone=55...&text=...`) com `encodeURIComponent` preservando emojis e quebras de linha.
2. **Condição de Telefone Vazio**: Garantir que leads com `phone = ''`, `null`, `undefined` ou strings vazias não exibam o botão de WhatsApp e mostrem o texto "Telefone não encontrado".
3. **Persistência de Configurações**: Leitura e gravação de `whatsapp_platform` (`web` | `app`) com fallback padrão para `web`.
4. **Agendamento de Mensagens**: Validação de data/hora futura e integridade de chave estrangeira ao deletar um lead.
5. **Exclusão de Quadro**: Ao deletar um quadro, redirecionar o usuário para o primeiro quadro restante ou recriar o padrão se todos forem excluídos.

---

### Task 1: Geração de Link Direto do WhatsApp (Web e App) & Tabela `settings`

**Files:**
- Modify: `crm/src/lib/template-interpolator.ts`
- Modify: `crm/src/db/schema.ts`
- Modify: `crm/src/db/index.ts`
- Create: `crm/src/app/api/settings/route.ts`
- Modify: `crm/tests/template-interpolator.test.ts`
- Create: `crm/tests/settings.test.ts`

**Interfaces:**
- Produces:
  - `generateWhatsAppUrl(phone: string, text: string, platform?: 'web' | 'app' | 'wame'): string`
  - Drizzle table `settings`: `key` (pk), `value`, `updated_at`.
  - GET & POST `/api/settings`: `{ key, value }`.

- [ ] **Step 1: Escrever testes unitários para os novos links de WhatsApp e persistência de settings**
  - Testar `generateWhatsAppUrl` com `platform: 'web'` gerando `https://web.whatsapp.com/send?phone=5519987654321&text=...`.
  - Testar `generateWhatsAppUrl` com `platform: 'app'` gerando `whatsapp://send?phone=5519987654321&text=...`.

- [ ] **Step 2: Executar testes para verificar que falham**
  - Run: `npm --workspace=crm test`

- [ ] **Step 3: Implementar `generateWhatsAppUrl`, schema `settings` e `/api/settings`**
  - Atualizar `template-interpolator.ts`.
  - Adicionar tabela `settings` no SQLite e seed com `whatsapp_platform: 'web'`.

- [ ] **Step 4: Executar testes para verificar que passam**
  - Run: `npm --workspace=crm test`
  - Expected: PASS

- [ ] **Step 5: Commit atômico**
  - `git commit -m "feat(crm): support direct WhatsApp Web/App URLs and settings schema"`

---

### Task 2: Exibição Obrigatória de Telefone e Ocultação Condicional do Botão WhatsApp

**Files:**
- Modify: `crm/src/components/leads/LeadsTable.tsx`
- Modify: `crm/src/components/kanban/KanbanCard.tsx`
- Test: `crm/tests/leads-phone-display.test.ts` (ou teste visual/unitário)

**Interfaces:**
- Consumes: `lead.phone`
- Produces:
  - Se `lead.phone` existe: exibe número formatado abaixo do nome e renderiza botão verde do WhatsApp.
  - Se `lead.phone` está ausente: exibe `"Telefone não encontrado"` em itálico cinza e **não renderiza** o botão de envio de mensagem.

- [ ] **Step 1: Escrever teste de verificação da lógica de presença de telefone**
  - Testar seletor condicional para renderização de telefone e botão de WhatsApp.

- [ ] **Step 2: Implementar exibição no `LeadsTable.tsx` e `KanbanCard.tsx`**
  - Atualizar a célula de Empresa/Contato na tabela para sempre exibir o telefone abaixo do nome.
  - Atualizar o card do Kanban para exibir o telefone abaixo do título.
  - Aplicar fallback `"Telefone não encontrado"` e ocultar botão de WhatsApp quando ausente.

- [ ] **Step 3: Executar testes**
  - Run: `npm --workspace=crm test`
  - Expected: PASS

- [ ] **Step 4: Commit atômico**
  - `git commit -m "feat(crm): display phone under lead name and conditionally hide WhatsApp button if missing"`

---

### Task 3: Exclusão de Quadros Kanban (API & Interface)

**Files:**
- Modify: `crm/src/app/api/boards/route.ts`
- Modify: `crm/src/components/kanban/BoardSelector.tsx`
- Modify: `crm/src/components/kanban/KanbanBoard.tsx`
- Test: `crm/tests/kanban-delete.test.ts`

**Interfaces:**
- Produces:
  - `DELETE /api/boards?id=...`: Exclui o quadro, suas colunas e cards associados.
  - `BoardSelector.tsx`: Botão de exclusão (lixeira) ao lado do título do quadro ou no seletor com diálogo de confirmação.
  - Ao excluir o quadro ativo, troca automaticamente para outro quadro existente ou recria o padrão.

- [ ] **Step 1: Escrever teste falhando para exclusão de quadros em cascata**
  - Criar board com colunas e cards, deletar via endpoint e verificar que não existem registros órfãos.

- [ ] **Step 2: Implementar método `DELETE` em `/api/boards/route.ts` e UI no `BoardSelector`**
  - Adicionar exclusão no backend com transação/deleção de cards e columns.
  - Adicionar botão de lixeira no seletor de quadros com confirmação `window.confirm`.

- [ ] **Step 3: Executar testes**
  - Run: `npm --workspace=crm test`
  - Expected: PASS

- [ ] **Step 4: Commit atômico**
  - `git commit -m "feat(crm): implement board deletion with cascade cleanup and UI confirmation"`

---

### Task 4: Agendamento de Mensagens (Schema, API & Interface)

**Files:**
- Modify: `crm/src/db/schema.ts`
- Modify: `crm/src/db/index.ts`
- Create: `crm/src/app/api/scheduled-messages/route.ts`
- Modify: `crm/src/components/whatsapp/WhatsAppModal.tsx`
- Create: `crm/src/app/scheduled/page.tsx`
- Modify: `crm/src/components/layout/Navbar.tsx`
- Test: `crm/tests/scheduled-messages.test.ts`

**Interfaces:**
- Produces:
  - Drizzle table `scheduled_messages`: `id`, `lead_id`, `message`, `scheduled_for`, `status`, `platform`, `created_at`.
  - API `/api/scheduled-messages` (GET, POST, PATCH para marcar enviado/cancelado, DELETE).
  - Modal `WhatsAppModal`: Opção de alternar entre "Enviar Agora" e "Agendar para depois" com seletor de data/hora.
  - Página `/scheduled`: Lista de mensagens agendadas com filtros (Pendentes, Enviadas, Canceladas) e botão para abrir e disparar no WhatsApp no momento desejado.

- [ ] **Step 1: Escrever teste falhando para criação e listagem de mensagens agendadas**
  - Testar criação de agendamento vinculado a um lead e consulta de agendamentos pendentes.

- [ ] **Step 2: Implementar schema, API `/api/scheduled-messages` e opções no `WhatsAppModal`**
  - Criar tabela no SQLite via Drizzle e rota API.
  - Adicionar aba/toggle no modal para agendamento com `datetime-local`.
  - Criar página visual `/scheduled`.

- [ ] **Step 3: Executar testes**
  - Run: `npm --workspace=crm test`
  - Expected: PASS

- [ ] **Step 4: Commit atômico**
  - `git commit -m "feat(crm): implement message scheduling with database persistence and management UI"`

---

### Task 5: Tela de Configurações (`/settings`) & Integração Geral

**Files:**
- Create: `crm/src/app/settings/page.tsx`
- Modify: `crm/src/components/layout/Navbar.tsx`
- Modify: `crm/src/components/whatsapp/WhatsAppModal.tsx`
- Modify: `scripts/test-e2e-pipeline.ts`

**Interfaces:**
- Produces:
  - Tela `/settings`: Opções visuais para escolher a plataforma padrão do WhatsApp (WhatsApp Web no Navegador vs WhatsApp Desktop App do Windows).
  - Modal do WhatsApp carrega a preferência do usuário automaticamente.
  - Link de navegação para "Configurações" na `Navbar`.

- [ ] **Step 1: Implementar a página `/settings` e sincronização no `Navbar` e `WhatsAppModal`**
  - Criar página com cards de seleção de plataforma e botão de salvar.
  - Conectar no `WhatsAppModal` para disparar na plataforma preferida.

- [ ] **Step 2: Atualizar o teste integrado ponta a ponta (`test-e2e-pipeline.ts`)**
  - Validar geração de link direto para Web e App, agendamento de mensagem e exclusão de board.

- [ ] **Step 3: Executar testes integrados e build de produção**
  - Run: `npm test`
  - Run: `npm run test:e2e`
  - Run: `npm run crm:build`

- [ ] **Step 4: Commit atômico final**
  - `git commit -m "feat(crm): add settings page for WhatsApp platform preference and finalize integration"`
