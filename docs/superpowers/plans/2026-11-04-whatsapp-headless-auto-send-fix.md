# Correção do Envio Automático Headless do WhatsApp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer com que o envio de mensagens agendadas e automáticas seja 100% autônomo em segundo plano via Playwright headless (sem abrir janelas de navegador no sistema operacional e sem exigir confirmação ou tecla Enter do usuário), persistindo o estado da sessão no banco de dados e restaurando a conexão automaticamente.

**Architecture:** 
1. Persistência de conexão em SQLite (`settings` com `whatsapp_session_connected = 'true'` e `auto_send_whatsapp = 'true'`) e singleton em `globalThis` para sobreviver a recargas de rotas e workers do Next.js.
2. Inicialização lazy/automática do contexto Playwright no envio headless (`executeSend` e `isAutoSendEligible` ativam a sessão persistida existente em `.whatsapp-session` se o contexto estiver inativo em memória).
3. Seletores robustos de composer e botão de envio no WhatsApp Web com foco explícito no campo de texto e verificação de confirmação de envio.
4. Sincronização automática na UI de configurações (`/settings`) e no modal de WhatsApp (`WhatsAppModal.tsx`).

**Tech Stack:** Next.js 15 App Router, Playwright, SQLite / Drizzle ORM, Vitest, TypeScript.

**Spec:** Baseado no diagnóstico dos 4 fatores de falha observados: desconexão de estado em memória entre rotas do Next.js, aborto prematuro em `executeSend` antes do `start()`, ausência de auto-ativação da flag `auto_send_whatsapp`, e falta de foco no composer do WhatsApp Web.

## Global Constraints

- Manter compatibilidade total com os testes existentes do CRM (14 arquivos, 51 testes) e do Scraper (4 arquivos, 20 testes).
- Preservar o fallback via sistema operacional (`activeUrlLauncher`) apenas quando o envio headless realmente falhar ou o WhatsApp não estiver configurado.
- Seguir o padrão de singleton global do Next.js (`globalThis`) para manter o driver ativo entre rotas de API.
- Preservar integridade dos comentários e tipagem TypeScript estrita sem `@ts-ignore`.

## Review Focus

1. **Reinício do servidor ou nova requisição de rota:** O driver deve reconectar com o perfil em `.whatsapp-session` sem exigir novo escaneamento de QR Code.
2. **Envio de mensagem para número válido:** O robô deve aguardar o carregamento da conversa, focar no composer ou clicar no botão Enviar e confirmar a transmissão.
3. **Número sem WhatsApp:** O robô deve detectar o popup de erro do WhatsApp e retornar erro amigável sem travar em loop.
4. **Agendamento disparado pelo Worker:** O worker de agendamento deve verificar `isAutoSendEligible()` com base tanto na sessão em memória quanto no banco SQLite, disparando headless sem invocar o launcher do sistema operacional.
5. **Logout explícito:** O comando de desconectar nas configurações deve limpar `.whatsapp-session`, fechar o contexto e atualizar o banco para `whatsapp_session_connected = 'false'`.

---

### Task 1: Singleton Global e Persistência de Conexão no Banco SQLite

**Files:**
- Modify: `crm/src/lib/whatsapp-headless.ts:20-60, 250-320`
- Test: `crm/tests/whatsapp-headless.test.ts`

**Interfaces:**
- Consumes: `settings` schema from `crm/src/db/schema.ts`, `getDatabase` / `initDatabase` from `crm/src/db`.
- Produces: `isAutoSendEligible(): Promise<boolean>`, `getWhatsAppSessionStatus()`, persistência de `whatsapp_session_connected` e ativação automática de `auto_send_whatsapp`.

- [ ] **Step 1: Escrever teste unitário para persistência de conexão e recuperação via DB**
  Adicionar testes em `crm/tests/whatsapp-headless.test.ts` verificando que:
  - Quando a sessão conecta, `whatsapp_session_connected` é salvo como `'true'` no banco.
  - `isAutoSendEligible()` reconhece a conexão tanto pela memória quanto pela chave persistida no banco SQLite.
  - Ao desconectar via `logoutWhatsAppSession()`, `whatsapp_session_connected` e `auto_send_whatsapp` são atualizados para `'false'`.

- [ ] **Step 2: Executar teste para verificar a falha inicial**
  Run: `cd crm && npx vitest run tests/whatsapp-headless.test.ts`

- [ ] **Step 3: Implementar singleton em `globalThis` e persistência no banco**
  - No topo de `crm/src/lib/whatsapp-headless.ts`, vincular a instância ativa a `globalThis`:
    ```ts
    const globalForWhatsApp = globalThis as unknown as {
      whatsappDriver?: WhatsAppAutomationDriver;
    };
    export const activeDriver = globalForWhatsApp.whatsappDriver ?? new PlaywrightWhatsAppDriver();
    globalForWhatsApp.whatsappDriver = activeDriver;
    ```
  - Em `startLoginWatcher()`, quando detectar `div[id="pane-side"]`, persistir imediatamente no SQLite:
    `key: 'whatsapp_session_connected'`, `value: 'true'`, e garantir `key: 'auto_send_whatsapp'`, `value: 'true'`.
  - Em `logout()`, persistir `whatsapp_session_connected = 'false'` e `auto_send_whatsapp = 'false'`.

- [ ] **Step 4: Executar testes unitários**
  Run: `cd crm && npx vitest run tests/whatsapp-headless.test.ts`
  Expected: PASS

- [ ] **Step 5: Commit das alterações do Task 1**
  `git add crm/src/lib/whatsapp-headless.ts crm/tests/whatsapp-headless.test.ts`
  `git commit -m "feat(whatsapp): persist connection state in sqlite and use global singleton"`

---

### Task 2: Inicialização Lazy e Correção do Fluxo em `executeSend` e `getStatus`

**Files:**
- Modify: `crm/src/lib/whatsapp-headless.ts:25-60, 240-275`
- Test: `crm/tests/whatsapp-headless.test.ts`

**Interfaces:**
- Consumes: `fs.existsSync(SESSION_DIR)`
- Produces: `executeSend` que inicializa o contexto headless sob demanda quando há perfil salvo, em vez de falhar prematuramente.

- [ ] **Step 1: Escrever teste unitário para inicialização lazy em `executeSend`**
  Testar que se o driver está sem contexto ativo, mas com perfil persistido, `send()` tenta iniciar o contexto e enviar a mensagem em vez de rejeitar de imediato.

- [ ] **Step 2: Executar teste para verificar falha**
  Run: `cd crm && npx vitest run tests/whatsapp-headless.test.ts`

- [ ] **Step 3: Reordenar e aprimorar `executeSend` e `getStatus`**
  - Em `executeSend()`:
    Inverter a ordem de verificação: Se `!this.context || !this.activePage || this.activePage.isClosed()`, executar `await this.start()` primeiro para reconectar com a sessão existente em disco.
    Apenas se o status final ainda não for `'connected'`, retornar erro.
  - Em `getStatus()`:
    Se `!this.context`, verificar se `SESSION_DIR` existe e o banco indica `whatsapp_session_connected === 'true'`. Se sim, refletir que a sessão persistente está conectada.

- [ ] **Step 4: Executar testes unitários**
  Run: `cd crm && npx vitest run tests/whatsapp-headless.test.ts`
  Expected: PASS

- [ ] **Step 5: Commit das alterações do Task 2**
  `git add crm/src/lib/whatsapp-headless.ts crm/tests/whatsapp-headless.test.ts`
  `git commit -m "fix(whatsapp): lazy initialize session in executeSend without premature abort"`

---

### Task 3: Automação Confiável de Envio e Foco no Composer do WhatsApp Web

**Files:**
- Modify: `crm/src/lib/whatsapp-headless.ts:270-325`
- Test: `crm/tests/whatsapp-headless.test.ts`

**Interfaces:**
- Consumes: Playwright Page API (`waitForSelector`, `locator`, `focus`, `keyboard.press`)
- Produces: `executeSend(phone: string, message: string): Promise<{ success: boolean; error?: string }>`

- [ ] **Step 1: Escrever teste para tratamento de envio, número inválido e confirmação**
  Verificar no mock/driver que os seletores de envio cobrem botão de envio, foco no composer antes do Enter, e retorno de erro caso o número não exista.

- [ ] **Step 2: Executar teste para verificar**
  Run: `cd crm && npx vitest run tests/whatsapp-headless.test.ts`

- [ ] **Step 3: Implementar sequência de envio robusta**
  - Aguardar até 30s por:
    - Botão de envio: `button[data-testid="compose-btn-send"], button[aria-label="Enviar"], [data-testid="send"], footer button:has(span[data-icon="send"])`
    - Campo de digitação: `footer div[contenteditable="true"], div[data-testid="conversation-compose-box-input"]`
    - Popup de erro: `div[data-testid="popup-contents"], div[data-animate-modal-popup="true"]`
  - Se popup de erro detectado: retornar `{ success: false, error: 'O número de telefone não possui conta no WhatsApp.' }`.
  - Se botão de envio estiver visível: clicar no botão.
  - Se botão não for clicável diretamente, mas o campo de texto existir: dar `.focus()` no `footer div[contenteditable="true"]` e enviar com `page.keyboard.press('Enter')`.
  - Aguardar confirmação de despacho (verificar esvaziamento do composer ou transição do botão para ícone de áudio) com pausa de 2.5s para transmissão websocket.

- [ ] **Step 4: Executar testes unitários**
  Run: `cd crm && npx vitest run tests/whatsapp-headless.test.ts`
  Expected: PASS

- [ ] **Step 5: Commit das alterações do Task 3**
  `git add crm/src/lib/whatsapp-headless.ts`
  `git commit -m "fix(whatsapp): ensure robust composer focus, send button click, and transmission confirmation"`

---

### Task 4: Sincronização Automática na UI (`/settings` e `WhatsAppModal`)

**Files:**
- Modify: `crm/src/app/settings/page.tsx:40-65, 135-155`
- Modify: `crm/src/components/whatsapp/WhatsAppModal.tsx:80-105`
- Test: `crm/tests/settings.test.ts`

**Interfaces:**
- Consumes: `GET /api/whatsapp/status`, `POST /api/whatsapp/connect`
- Produces: Estado sincronizado na interface sem exigir que o usuário adivinhe a necessidade de ativar uma chave secundária manualmente.

- [ ] **Step 1: Atualizar teste de configurações para validar persistência de auto-send**
  Garantir que a rota `/api/settings` e `/api/whatsapp/status` retornam `autoSendEnabled: true` quando conectado.

- [ ] **Step 2: Executar teste**
  Run: `cd crm && npx vitest run tests/settings.test.ts`

- [ ] **Step 3: Ajustar `settings/page.tsx` e `WhatsAppModal.tsx`**
  - Em `settings/page.tsx`:
    Quando o polling de status detectar `status === 'connected'`, atualizar automaticamente `autoSendEnabled` para `true` caso ainda não esteja.
  - Em `WhatsAppModal.tsx`:
    Ao buscar status em `fetchSettings()`, definir `setAutoSendConfigured(true)` se `statusData.status === 'connected'` ou `statusData.autoSendEnabled`.

- [ ] **Step 4: Executar testes unitários**
  Run: `cd crm && npx vitest run tests/settings.test.ts`
  Expected: PASS

- [ ] **Step 5: Commit das alterações do Task 4**
  `git add crm/src/app/settings/page.tsx crm/src/components/whatsapp/WhatsAppModal.tsx`
  `git commit -m "feat(ui): auto-enable and sync headless status in settings and modal"`

---

### Task 5: Verificação Completa de Ponta a Ponta

**Files:**
- Verify: Todas as suítes de testes (`crm`, `scraper`) e build de produção.

- [ ] **Step 1: Executar todos os testes do CRM**
  Run: `cd crm && npm test`
  Expected: 14 test files passed, 51+ tests passed.

- [ ] **Step 2: Executar todos os testes do Scraper**
  Run: `cd scraper && npm test`
  Expected: 4 test files passed, 20 tests passed.

- [ ] **Step 3: Executar build de produção do CRM**
  Run: `cd crm && npm run build`
  Expected: Build concluído com código 0 sem erros de TypeScript ou Next.js.
