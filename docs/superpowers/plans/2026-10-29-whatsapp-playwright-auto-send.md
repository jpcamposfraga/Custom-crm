# Envio Automático de Mensagens WhatsApp via Playwright (Headless) - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o envio 100% automático de mensagens do WhatsApp sem necessidade de pressionar Enter manualmente, utilizando o Playwright em modo headless com sessão persistente conectada via QR Code na tela de Configurações, ativado exclusivamente sob demanda (em mensagens agendadas ou quando selecionado no modal de envio).

**Architecture:**
- **Gerenciador de Sessão Playwright (`crm/src/lib/whatsapp-headless.ts`)**: Mantém um contexto persistente do navegador (`userDataDir: crm/.whatsapp-session/`), captura o QR Code em base64 na primeira conexão e detecta transição de status (`desconectado`, `aguardando_qr`, `conectado`).
- **Endpoints de Autenticação e Disparo (`/api/whatsapp/*`)**:
  - `GET /api/whatsapp/status`: Retorna estado da conexão e QR Code ativo se pendente.
  - `POST /api/whatsapp/connect`: Inicia o Chromium e aguarda renderização do QR Code.
  - `POST /api/whatsapp/disconnect`: Encerra o navegador e limpa os arquivos de sessão.
  - `POST /api/whatsapp/send`: Envia uma mensagem de forma headless aguardando o carregamento da conversa e disparando o clique de envio.
- **Integração no Agendador (`crm/src/lib/scheduler-worker.ts`)**: No momento de disparar a mensagem agendada, verifica se `auto_send_whatsapp = 'true'` e se a sessão está conectada. Se sim, envia de forma headless sem abrir abas; se não, mantém o fallback seguro abrindo a URL no sistema operacional.
- **Interface de Configuração (`crm/src/app/settings/page.tsx`)**: Card de conexão com o WhatsApp exibindo status em tempo real, switch de ativação (desligado por padrão), leitor de QR Code integrado e botão de desconectar.
- **Modal de Envio Imediato (`crm/src/components/whatsapp/WhatsAppModal.tsx`)**: Quando a integração estiver ativa, oferece um checkbox opcional para o usuário escolher se quer enviar direto em segundo plano ou abrir a aba do WhatsApp.

**Tech Stack:** Next.js 15, Playwright (Chromium), TypeScript, Drizzle ORM, SQLite via LibSQL, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-29-google-maps-scraper-crm-design.md`

---

## Global Constraints

- **Desativado por Padrão**: O envio automático deve vir desativado (`auto_send_whatsapp = 'false'`). Nenhuma mensagem deve ser enviada sem o usuário explicitamente habilitar a funcionalidade e conectar o QR Code.
- **Critério Rígido de Disparo**: Mensagens só disparam sozinhas se:
  1. A configuração estiver ativa E a sessão do WhatsApp estiver conectada;
  2. E a mensagem for um agendamento vencido OU o usuário tiver marcado a opção de envio headless no modal de preview.
- **Fallback Transparente**: Se a sessão estiver desconectada ou a configuração desativada, o sistema continua funcionando exatamente como hoje (abrindo a URL no WhatsApp Web ou Desktop para o usuário dar o Enter).
- **Isolamento de Credenciais**: O diretório de sessão `.whatsapp-session/` deve constar no `.gitignore` e nunca ser enviado ao repositório git.
- **Cadência Humana & Prevenção de Bloqueio**: Mensagens enviadas em fila devem respeitar um intervalo mínimo de segurança entre cada envio.

---

## Review Focus

1. **Persistência de Sessão**: Ao reiniciar o servidor ou fechar o navegador, a sessão salva em `.whatsapp-session` deve ser reutilizada sem pedir QR Code novamente.
2. **Timeout e Tratamento de Número Inválido**: Se o lead tiver um telefone que não possui WhatsApp, o Playwright deve identificar o modal de erro do WhatsApp Web, registrar a falha e fechar a página sem travar o worker.
3. **Detecção do Botão de Envio**: O seletor de envio deve suportar tanto o clique no botão `[data-testid="compose-btn-send"]` quanto a tecla `Enter` no editor `footer div[contenteditable="true"]`.
4. **Isolamento de Concorrência**: Não abrir múltiplas abas concorrentes do Playwright para o mesmo perfil; as mensagens devem ser enfileiradas sequencialmente pelo worker.
5. **Experiência do Usuário no QR Code**: O QR Code deve ser recarregado automaticamente na tela se expirar antes de ser escaneado.

---

### Task 1: Gerenciador de Sessão e Disparo Headless do Playwright

**Files:**
- Modify: `.gitignore` (adicionar `crm/.whatsapp-session/`)
- Modify: `crm/package.json` (garantir dependência `playwright`)
- Create: `crm/src/lib/whatsapp-headless.ts`
- Create: `crm/tests/whatsapp-headless.test.ts`

**Interfaces:**
- Produces:
  - `getWhatsAppSessionStatus(): Promise<{ status: 'disconnected' | 'waiting_qr' | 'connected'; qrCode?: string | null }>`
  - `startWhatsAppSession(): Promise<{ qrCode: string | null; status: 'waiting_qr' | 'connected' }>`
  - `logoutWhatsAppSession(): Promise<void>`
  - `sendHeadlessMessage(phone: string, text: string): Promise<{ success: boolean; error?: string }>`
  - `isAutoSendEligible(): Promise<boolean>`

- [ ] **Step 1: Atualizar `.gitignore` e dependências**
  - Adicionar `.whatsapp-session` ao `.gitignore`.
  - Garantir `playwright` referenciado em `crm/package.json`.

- [ ] **Step 2: Escrever testes unitários em `crm/tests/whatsapp-headless.test.ts`**
  - Mockar o browser do Playwright para validar a lógica de inicialização, detecção de QR Code e timeout de seletor.

- [ ] **Step 3: Executar testes para verificar falha inicial**
  - Run: `npm --workspace=crm test`

- [ ] **Step 4: Implementar `crm/src/lib/whatsapp-headless.ts`**
  - Inicialização com `chromium.launchPersistentContext`.
  - Extração de QR code via seletor `canvas` e conversão em data URL base64.
  - Navegação para `web.whatsapp.com/send?phone=...&text=...`.
  - Espera pelo botão de envio e execução do clique/Enter.
  - Fechamento da aba e retorno de sucesso.

- [ ] **Step 5: Executar testes para validar implementação**
  - Run: `npm --workspace=crm test`
  - Expected: PASS

- [ ] **Step 6: Commit atômico**
  - `git commit -m "feat(crm): implement Playwright headless WhatsApp session manager and message dispatcher"`

---

### Task 2: Rotas de API para Conexão, Status e Envio Headless

**Files:**
- Create: `crm/src/app/api/whatsapp/status/route.ts`
- Create: `crm/src/app/api/whatsapp/connect/route.ts`
- Create: `crm/src/app/api/whatsapp/disconnect/route.ts`
- Create: `crm/src/app/api/whatsapp/send/route.ts`

**Interfaces:**
- Produces:
  - `GET /api/whatsapp/status`: `{ status, qrCode, autoSendEnabled }`
  - `POST /api/whatsapp/connect`: `{ success: true, qrCode, status }`
  - `POST /api/whatsapp/disconnect`: `{ success: true }`
  - `POST /api/whatsapp/send`: `{ success: boolean, error?: string }` (Recebe `{ phone, message, lead_id? }`)

- [ ] **Step 1: Criar endpoints da API `/api/whatsapp/*`**
  - Integrar com as funções do `whatsapp-headless.ts`.
  - Garantir atualização do lead para `em_contato` quando o envio imediato via API for bem-sucedido.

- [ ] **Step 2: Executar testes e verificar compilação**
  - Run: `npm --workspace=crm test`
  - Expected: PASS

- [ ] **Step 3: Commit atômico**
  - `git commit -m "feat(crm): add WhatsApp connection and headless send API endpoints"`

---

### Task 3: Tela de Configurações com Conexão de QR Code e Switch

**Files:**
- Modify: `crm/src/app/settings/page.tsx`

**Interfaces:**
- Consumes: `/api/whatsapp/status`, `/api/whatsapp/connect`, `/api/whatsapp/disconnect`, `/api/settings`
- Produces:
  - Seção "Envio Automático do WhatsApp (Headless)" na página de configurações.
  - Switch para ativar/desativar envio automático (`auto_send_whatsapp`).
  - Badge de status (`Conectado`, `Aguardando Leitura`, `Desconectado`).
  - Painel com o QR Code dinâmico quando a conexão estiver sendo estabelecida.
  - Botão "Desconectar WhatsApp" com confirmação.

- [ ] **Step 1: Implementar o componente de QR Code e controles em `SettingsPage`**
  - Exibir estado de conexão atual.
  - Botão "Conectar WhatsApp" que invoca a rota de conexão e exibe o QR Code.
  - Polling suave para detectar quando o usuário leu o QR Code e o status virou `conectado`.
  - Switch para habilitar/desabilitar `auto_send_whatsapp`.

- [ ] **Step 2: Testar build da página de configurações**
  - Run: `npm run crm:build`
  - Expected: Sucesso na compilação.

- [ ] **Step 3: Commit atômico**
  - `git commit -m "feat(crm): add WhatsApp QR code connection and auto-send toggle in settings page"`

---

### Task 4: Integração do Agendador (Scheduler Worker) com Envio Headless

**Files:**
- Modify: `crm/src/lib/scheduler-worker.ts`
- Modify: `crm/tests/scheduler-worker.test.ts`

**Interfaces:**
- Consumes: `isAutoSendEligible()`, `sendHeadlessMessage()` de `whatsapp-headless.ts`
- Produces:
  - O worker verifica antes de cada mensagem se `auto_send_whatsapp` está ativo e sessão conectada.
  - Se elegível: dispara via `sendHeadlessMessage(phone, item.message)`.
  - Se não elegível: mantém o comportamento nativo via `activeUrlLauncher(url)`.

- [ ] **Step 1: Atualizar testes do worker em `crm/tests/scheduler-worker.test.ts`**
  - Adicionar teste para quando o envio headless estiver habilitado.
  - Adicionar teste garantindo fallback para o launcher de SO quando o envio headless estiver desabilitado.

- [ ] **Step 2: Modificar `crm/src/lib/scheduler-worker.ts`**
  - Integrar a checagem de elegibilidade headless na fila sequencial.

- [ ] **Step 3: Executar testes do worker**
  - Run: `npm --workspace=crm test`
  - Expected: PASS

- [ ] **Step 4: Commit atômico**
  - `git commit -m "feat(crm): integrate headless dispatch into scheduler worker with graceful OS fallback"`

---

### Task 5: Integração no Modal de Mensagem (`WhatsAppModal.tsx`)

**Files:**
- Modify: `crm/src/components/whatsapp/WhatsAppModal.tsx`

**Interfaces:**
- Consumes: `/api/whatsapp/status`, `/api/whatsapp/send`
- Produces:
  - Checkbox opcional "Enviar em segundo plano (sem abrir janela)" visível quando a sessão estiver conectada e configurada.
  - Disparo direto via API headless com estado de carregamento e confirmação visual.
  - Preservação do botão tradicional caso o usuário prefira abrir a janela.

- [ ] **Step 1: Adicionar toggle e lógica de envio headless no modal**
  - Consultar se a conta está conectada ao abrir o modal.
  - Se conectada, exibir a opção de envio automático em segundo plano.
  - Tratar loading e erros de envio.

- [ ] **Step 2: Executar testes de componentes e build**
  - Run: `npm run crm:build`
  - Expected: PASS

- [ ] **Step 3: Commit atômico**
  - `git commit -m "feat(crm): add optional headless auto-send toggle to WhatsApp preview modal"`

---

### Task 6: Validação End-to-End e Verificação de Regressão

**Files:**
- Create: `scripts/test-whatsapp-headless-flow.ts`

- [ ] **Step 1: Criar script de validação de fluxo headless e fallbacks**
  - Testa validação de configurações.
  - Testa comportamento do worker quando habilitado vs desabilitado.
  - Testa endpoints de API.

- [ ] **Step 2: Executar bateria completa de testes**
  - Run: `npm test`
  - Run: `npm run test:e2e`
  - Run: `npm run test:scheduler`
  - Run: `npm run crm:build`

- [ ] **Step 3: Commit atômico final**
  - `git commit -m "test: add headless flow tests and verify full CRM test suite"`
