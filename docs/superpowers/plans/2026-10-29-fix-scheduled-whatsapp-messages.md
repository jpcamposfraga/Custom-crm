# Plano de Correção: Automação e Disparo Real de Mensagens Agendadas no WhatsApp

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar um motor de agendamento em segundo plano (background worker) no servidor local do CRM que monitore periodicamente a tabela `scheduled_messages` e, no minuto e data programados, execute automaticamente a abertura da conversa no WhatsApp Web ou no WhatsApp Desktop com a mensagem anexada, sem exigir clique manual.

**Architecture:**
- **Worker em Segundo Plano (`crm/src/lib/scheduler-worker.ts`)**: Singleton em Node.js com timer periódico (a cada 10 segundos) que busca mensagens com `status = 'pendente'` cuja data/hora programada já foi atingida (`scheduled_for <= now`).
- **Disparo Nativo no Windows**: Utiliza `node:child_process.exec` com o comando nativo `start "" "<url>"` para lançar o WhatsApp Web (no navegador padrão) ou o WhatsApp Desktop App no Windows, contornando bloqueadores de popup de navegadores.
- **Normalização de Fuso Horário**: Armazenar e comparar datas utilizando timestamp numérico Unix em milissegundos (`Date.now()`), eliminando divergências de fuso horário (ex: UTC vs Brasília UTC-3).
- **Endpoint de Execução Manual/Trigger (`POST /api/scheduled-messages/trigger`)**: Permite que o frontend force uma verificação imediata e que ferramentas de cron chamem o processador.

**Tech Stack:** Next.js 15, TypeScript, Node.js (`child_process`), Drizzle ORM, SQLite via LibSQL, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-29-google-maps-scraper-crm-design.md`

---

## 🔍 Análise de Causa Raiz: Por que a mensagem não foi enviada?

1. **Inexistência de um Processo Ativo Monitorando o Tempo**:
   - A implementação anterior salvou o registro no SQLite, mas o Next.js é um servidor HTTP reativo (só executa código quando alguém faz uma requisição).
   - Não havia nenhum processo ativo verificando a passagem dos minutos no relógio da máquina.
2. **Tentativa de Ação Silenciosa sem Disparo no Sistema Operacional**:
   - Um registro no banco de dados não abre janelas por si só. No Windows, para abrir o aplicativo do WhatsApp ou o navegador automaticamente a partir de um servidor Node.js local, é necessário invocar o comando `start` do Windows.
3. **Divergência de Fuso Horário (Local vs UTC)**:
   - O campo HTML `datetime-local` gera horário local (ex: `22:30` em Brasília), mas comparações ingênuas com `toISOString()` usam UTC (ex: `01:30` do dia seguinte), gerando um atraso de 3 horas caso não sejam convertidas para timestamp absoluto.

---

## Global Constraints

- **Execução no Windows**: O comando de disparo deve usar `start "" "<url>"` compatível com o Windows PowerShell/cmd.
- **Anti-Duplicidade**: Mensagens processadas devem ser imediatamente marcadas como `'enviado'` antes ou durante o disparo para evitar múltiplos disparos simultâneos da mesma mensagem.
- **Padrão Ponytail**: Implementar um worker enxuto de arquivo único sem bibliotecas pesadas de fila (Redis, BullMQ, etc.), aproveitando a conexão SQLite local e timers nativos do Node.js.
- **TDD**: Testes automatizados cobrindo a lógica de verificação de mensagens vencidas e atualização de status.

---

## Review Focus

1. **Precisão de Fuso Horário**: Garantir que `Date.parse(item.scheduled_for) <= Date.now()` funcione independente do fuso horário local ou UTC.
2. **Tratamento de Aspas e Caracteres Especiais no `exec`**: URLs com `&`, `%` e espaços precisam ser envelopadas corretamente entre aspas duplas no comando `start` do Windows.
3. **Idempotência**: Um agendamento nunca deve ser disparado duas vezes se o worker rodar várias vezes no mesmo minuto.
4. **Resiliência a Falhas de Telefone**: Se o lead tiver sido excluído ou não possuir telefone, o status deve ir para `'falha'` ou `'cancelado'` com log claro sem derrubar o worker.
5. **Autonomia do Servidor**: O worker deve iniciar junto com a aplicação no Next.js (via `instrumentation.ts` ou primeira requisição à API).

---

### Task 1: Motor do Scheduler em Segundo Plano (`scheduler-worker.ts`)

**Files:**
- Create: `crm/src/lib/scheduler-worker.ts`
- Create: `crm/tests/scheduler-worker.test.ts`

**Interfaces:**
- Produces:
  - `checkAndTriggerDueMessages(): Promise<{ triggeredCount: number; errors: string[] }>`
  - `startSchedulerWorker(intervalMs?: number): void`
  - `stopSchedulerWorker(): void`
  - Executa `exec('start "" "<whatsappUrl>"')` no Windows para cada mensagem com `status = 'pendente'` e `Date.parse(scheduled_for) <= Date.now()`.
  - Atualiza status para `'enviado'` e atualiza o lead para `'em_contato'`.

- [ ] **Step 1: Escrever testes unitários em `crm/tests/scheduler-worker.test.ts`**
  - Criar lead com mensagem agendada no passado/agora.
  - Chamar `checkAndTriggerDueMessages` (com mock da função de execução de SO).
  - Verificar que a mensagem foi identificada, o link correto foi montado e o status no banco mudou para `'enviado'`.

- [ ] **Step 2: Executar testes para verificar que falham**
  - Run: `npm --workspace=crm test`

- [ ] **Step 3: Implementar `crm/src/lib/scheduler-worker.ts`**
  - Implementar consulta SQL buscando mensagens pendentes.
  - Implementar comando `child_process.exec` compatível com Windows.
  - Implementar timer de loop contínuo (default a cada 10 segundos).

- [ ] **Step 4: Executar testes para verificar aprovação**
  - Run: `npm --workspace=crm test`
  - Expected: PASS

- [ ] **Step 5: Commit atômico**
  - `git commit -m "feat(crm): implement background scheduler worker for automated WhatsApp message dispatch"`

---

### Task 2: Inicialização Automática no Next.js & Endpoint de Trigger

**Files:**
- Create: `crm/src/app/api/scheduled-messages/trigger/route.ts`
- Create: `crm/src/instrumentation.ts` (ou hook de inicialização global no `db/index.ts`)
- Modify: `crm/next.config.ts` (habilitar `experimental.instrumentationHook` se necessário)
- Modify: `crm/src/components/layout/Navbar.tsx` (adicionar polling discreto de verificação)

**Interfaces:**
- Produces:
  - `POST /api/scheduled-messages/trigger`: Executa checagem imediata de mensagens vencidas.
  - Inicialização automática do worker quando o servidor do CRM inicia (`npm run dev`).
  - O componente `Navbar` faz um ping periódico a cada 20 segundos em `/api/scheduled-messages/trigger` como garantia de execução ativa caso o servidor rode em modo Serverless.

- [ ] **Step 1: Criar rota `trigger` e registrar worker**
  - Chamar `checkAndTriggerDueMessages()` e retornar quantidade disparada.

- [ ] **Step 2: Conectar polling no `Navbar.tsx`**
  - Adicionar `useEffect` com intervalo leve que chama `/api/scheduled-messages/trigger`.

- [ ] **Step 3: Executar testes de integração**
  - Run: `npm --workspace=crm test`
  - Expected: PASS

- [ ] **Step 4: Commit atômico**
  - `git commit -m "feat(crm): auto-start scheduler on server boot and add trigger endpoint with client sync"`

---

### Task 3: Validação Real de Disparo Automático no Windows

**Files:**
- Create: `scripts/test-automated-scheduler.ts`

**Interfaces:**
- Produces:
  - Script que cadastra uma mensagem agendada para 3 segundos no futuro.
  - Aguarda 4 segundos e executa a checagem.
  - Valida que o status transitou de `'pendente'` para `'enviado'` e o disparo ocorreu com sucesso.

- [ ] **Step 1: Escrever script de teste do scheduler**
- [ ] **Step 2: Executar script com `npx tsx scripts/test-automated-scheduler.ts`**
  - Expected: Sucesso com log de disparo e transição de status.

- [ ] **Step 3: Commit atômico final**
  - `git commit -m "test: add automated scheduler validation test and verify end-to-end"`
