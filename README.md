# Ecossistema de Prospecção B2B: Scraper Google Maps & CRM Web

Sistema integrado, local e enxuto desenvolvido em TypeScript para coletar leads qualificados do Google Maps e gerenciá-los em um CRM visual com múltiplos Kanbans, detecção inteligente de telefones duplicados e disparo de mensagens via WhatsApp Click-to-Chat com templates dinâmicos.

---

## 🛠️ Tecnologias Utilizadas

- **Scraper CLI (`/scraper`)**: Node.js, TypeScript, Playwright (Chromium headless), Commander, Prompts, RFC-4180 CSV Exporter.
- **CRM Web (`/crm`)**: Next.js 15 (App Router, React 19), Tailwind CSS, Lucide Icons, SQLite local via LibSQL (`@libsql/client`), Drizzle ORM, PapaParse, Vitest.
- **Monorepo**: NPM Workspaces gerenciando os dois projetos de forma desacoplada.

---

## 📋 Pré-requisitos

- **Node.js** v20+ (testado e recomendado na v24+)
- **NPM** v10+
- Navegador para o CRM (Chrome, Edge, Firefox, Brave, etc.)

---

## 🚀 Instalação Rápida

1. Clone o repositório ou navegue até a pasta do projeto:
   ```bash
   cd custom-crm
   ```

2. Instale as dependências de todos os workspaces com um único comando:
   ```bash
   npm install
   ```

3. Instale os binários do Chromium necessários para o Playwright (apenas na primeira vez):
   ```bash
   npx playwright install chromium
   ```

---

## 🗺️ 1. Como Usar o Scraper do Google Maps

O scraper pode ser executado de duas formas no seu terminal:

### Opção A: Modo Interativo (Perguntas no Terminal)
Basta rodar sem argumentos:
```bash
npm run scrape
```
O assistente perguntará:
- *Qual o nicho a ser pesquisado?* (ex: `dentistas`, `academias`, `restaurantes`)
- *Qual a região ou cidade?* (ex: `Campinas, SP`, `Pinheiros, São Paulo`)
- *Limite de estabelecimentos a coletar:* (padrão: `50`)

### Opção B: Linha de Comando (Flags diretas)
```bash
# Busca combinando nicho e região:
npm run scrape -- --nicho="dentistas" --regiao="Campinas, SP" --limite=30

# Ou busca direta livre:
npm run scrape -- --busca="clinicas de estética em Belo Horizonte" --limite=40

# Para acompanhar o navegador visualmente (modo com janela aberta):
npm run scrape -- --nicho="pet shop" --regiao="Curitiba" --no-headless
```

### 📁 Arquivo Gerado
Os resultados são salvos automaticamente na pasta `scraper/output/` com o nome no formato:
`scraper/output/leads-YYYY-MM-DDTHH-mm-ss.csv`

**Colunas do CSV:**
- `name`: Nome da empresa
- `phone`: Telefone comercial formatado
- `normalized_phone`: Apenas dígitos para deduplicação (ex: `19987654321`)
- `nicho`: Categoria/Nicho
- `has_website`: `true` ou `false`
- `website`: URL do site (se houver)
- `location`: Endereço completo ou cidade
- `rating`: Nota média no Google Maps (ex: `4.8`)
- `reviews_count`: Total de avaliações
- `google_maps_url`: Link direto da ficha no Maps

---

## 💼 2. Como Usar o CRM Web

Inicie o servidor de desenvolvimento do CRM:
```bash
npm run dev
# ou
npm run crm:dev
```
Acesse no seu navegador: **`http://localhost:3000`**

### Funcionalidades do CRM:

1. **📥 Importação Inteligente de CSV:**
   - Clique no botão **"Importar CSV"** no cabeçalho.
   - Selecione o arquivo `.csv` gerado pelo scraper.
   - O sistema analisa instantaneamente o arquivo e exibe a pré-visualização:
     - Total de registros
     - Leads novos
     - Leads duplicados (destaca telefones que já existem no banco ou repetidos dentro do próprio CSV)
   - Escolha o quadro Kanban de destino e confirme a importação com 1 clique.

2. **🔍 Verificador Rápido de Telefone:**
   - No topo de qualquer página do CRM, digite qualquer número de telefone (com ou sem DDD, com ou sem traços).
   - O verificador avisa em tempo real:
     - Se o lead já está cadastrado, seu nome, nicho e em qual estágio/coluna ele se encontra.
     - Se é um número novo disponível para prospecção.

3. **📊 Tabela Completa de Leads:**
   - Acesse `/leads` para visualizar todos os contatos.
   - **Ordenação rápida:** por Data de Inclusão, Nome (A-Z) ou Nicho (A-Z).
   - **Filtros avançados:** por Nicho, Status de Conversão e se possui Website.
   - **Status de conversão:** botão para alternar rapidamente entre "Convertido" e "Não Convertido".

4. **📌 Múltiplos Kanbans Customizáveis:**
   - Acesse `/kanban` para ver o funil visual.
   - Crie novos quadros (ex: *"Prospecção Odonto SP"*, *"Tarefas Internas"*).
   - Crie e renomeie colunas/estágios personalizados.
   - Mova os cards entre as colunas; mover um lead para a coluna marcada como **"Convertido"** atualiza automaticamente o status do lead no banco de dados.

5. **💬 WhatsApp Click-to-Chat com Templates Dinâmicos:**
   - Em qualquer card do Kanban ou linha da tabela de leads, clique no botão verde do **WhatsApp**.
   - Escolha um dos templates cadastrados (ex: *Apresentação Comercial*, *Proposta de Website*, *Follow-up*).
   - O sistema substitui automaticamente as variáveis `{nome}`, `{nicho}`, `{cidade}` pelos dados reais do lead.
   - Clique em **"Abrir WhatsApp"**: a conversa abre instantaneamente no WhatsApp Web / Desktop com a mensagem preenchida, sem risco de banimento de número.

---

## 🧪 Executando os Testes

O projeto conta com cobertura completa de testes unitários e teste integrado E2E:

```bash
# Executa todos os testes unitários (scraper + crm):
npm test

# Executa apenas os testes do scraper:
npm --workspace=scraper test

# Executa apenas os testes do CRM:
npm --workspace=crm test

# Executa o teste de ponta a ponta (E2E Pipeline):
npm run test:e2e
```

---

## 📁 Estrutura do Repositório

```text
crm-jpcamposfraga/
├── scraper/                     # Workspace do Scraper
│   ├── src/
│   │   ├── cli.ts               # Interface de linha de comando
│   │   ├── crawler.ts           # Crawler Google Maps com Playwright
│   │   ├── csv-exporter.ts      # Gerador de CSV estruturado
│   │   ├── normalizer.ts        # Sanitizador de telefones BR
│   │   └── query-builder.ts     # Formatador de queries de busca
│   └── tests/                   # Testes unitários do scraper
│
├── crm/                         # Workspace do CRM Web (Next.js 15)
│   ├── src/
│   │   ├── app/                 # Rotas e páginas (App Router)
│   │   ├── components/          # Componentes de UI (Kanban, Leads, Import, WhatsApp)
│   │   ├── db/                  # Schema e conexão SQLite (Drizzle ORM)
│   │   └── lib/                 # Parser CSV, Deduplicador e Templates
│   └── tests/                   # Testes unitários do CRM
│
├── scripts/
│   └── test-e2e-pipeline.ts     # Teste ponta a ponta integrado
├── docs/                        # Especificações de design e planos Superpowers
├── package.json                 # Configuração do Monorepo (NPM Workspaces)
└── README.md                    # Documentação completa do projeto
```
