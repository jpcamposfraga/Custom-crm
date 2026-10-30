# Custom CRM & Google Maps Scraper Monorepo

Sistema integrado de prospecção comercial B2B para negócios locais, composto por um **Scraper autônomo do Google Maps** e um **CRM Web fullstack** com múltiplos Kanbans, deduplicação inteligente por telefone e disparador rápido via WhatsApp Click-to-Chat.

---

## 🏗️ Padrões de Projeto e Decisões de Arquitetura

O projeto foi construído seguindo os princípios de **Clean Code**, **TDD (Test-Driven Development)** e o estilo **Ponytail** (código enxuto, direto e sem abstrações desnecessárias):

### 1. Padrão Monorepo Desacoplado (NPM Workspaces)
- O repositório organiza dois subsistemas independentes (`/scraper` e `/crm`), compartilhando o ecossistema TypeScript sem acoplamento de código.
- Cada workspace possui seu próprio `package.json`, scripts e testes isolados, permitindo que o Scraper e o CRM rodem ou sejam distribuídos de forma autônoma.

### 2. Arquitetura em Camadas e Desacoplamento Limpo
- **Scraper (`/scraper`)**: Arquitetura CLI com separação clara de responsabilidades:
  - `query-builder.ts`: Montagem e sanitização de consultas de busca.
  - `crawler.ts`: Automação e navegação com Playwright, paginação por scroll infinito e fallbacks para variações de layout.
  - `normalizer.ts`: Motor de sanitização de telefones brasileiros (formatação e extração de dígitos).
  - `csv-exporter.ts`: Exportador com suporte a UTF-8 BOM e escape de caracteres RFC 4180.
- **CRM Web (`/crm`)**: Fullstack Next.js com App Router:
  - `src/db/`: Single Source of Truth para o banco de dados (SQLite + Drizzle ORM).
  - `src/lib/`: Motores de regras de negócio (parser CSV, analisador de duplicados, interpolador de templates).
  - `src/components/`: Componentes visuais atômicos divididos por domínio (`kanban`, `leads`, `import`, `whatsapp`, `search`).
  - `src/app/api/`: Route handlers RESTful para sincronização de dados.

### 3. Padrão de Persistência Zero-Config (LibSQL + Drizzle ORM)
- Utilização do `@libsql/client` conectando em `file:crm.db` local.
- **Vantagem**: Pure JavaScript/WASM, livre de dependências de compilação C++ (evita problemas com `node-gyp` no Windows) e zero necessidade de servidores externos como PostgreSQL ou Docker.
- Modo WAL (Write-Ahead Logging) ativo e migração/seed automatizado (`initDatabase()`) executado na inicialização da aplicação.

### 4. Padrão de Deduplicação e Ingestão Defensiva
- **Normalização de Chave Única**: Telefones são convertidos para dígitos puros (DDD + número) antes de qualquer comparação.
- **Análise em Duplo Nível**:
  1. *Intra-file*: Identifica registros repetidos dentro do próprio arquivo CSV.
  2. *Database-level*: Cruza os telefones em lote (`IN (...)`) contra o banco de dados SQLite.
- **Pré-visualização Obrigatória**: A importação não sobrescreve cegamente; exibe métricas claras (total, novos e duplicados) antes de salvar no banco.

### 5. Padrão Anti-Ban para Contato Comercial (WhatsApp Click-to-Chat)
- Em vez de bots não-oficiais (ex: Baileys/Evolution API) que violam os termos do WhatsApp e causam banimento frequente do número da empresa, o sistema utiliza o protocolo seguro `https://wa.me/55...`.
- O CRM fornece um modal com templates dinâmicos (`{nome}`, `{nicho}`, `{cidade}`), live preview e abre a conversa preenchida no WhatsApp Web/Desktop com 1 clique.

---

## 🛠️ Tecnologias Utilizadas

| Subsistema | Tecnologia | Finalidade |
|---|---|---|
| **Runtime & Linguagem** | Node.js v24+, TypeScript 5.7+ | Execução nativa e tipagem estática ponta a ponta |
| **Scraper** | Playwright (Chromium) | Crawler headless rápido com suporte a navegação real |
| **Scraper CLI** | Commander & Prompts | Suporte duplo a flags de terminal e modo interativo |
| **CRM Frontend** | Next.js 15 (App Router, React 19) | Aplicação web responsiva e performática |
| **Estilização** | Tailwind CSS v4, Lucide Icons | Design moderno, limpo e consistente |
| **ORM & Banco de Dados** | Drizzle ORM + @libsql/client | Banco SQLite local, tipado e zero-config |
| **Manipulação de Dados** | PapaParse, Zod | Parsing resiliente de CSV e validação de schemas |
| **Testes** | Vitest, TSX | Suíte de testes unitários e teste integrado de ponta a ponta |

---

## 🚀 Como Executar o Projeto

### Pré-requisitos
- **Node.js** v20 ou superior (recomendado v24+)
- **NPM** v10+

### 1. Instalação
Na raiz do projeto (`C:\Users\João\custom-crm`):
```bash
npm install
npx playwright install chromium
```

### 2. Executando o Scraper do Google Maps

#### Modo Interativo (Perguntas no Terminal):
```bash
npm run scrape
```

#### Modo com Flags Diretas:
```bash
# Busca por nicho e região:
npm run scrape -- --nicho="dentistas" --regiao="Campinas, SP" --limite=30

# Busca livre:
npm run scrape -- --busca="academias em Pinheiros São Paulo" --limite=50

# Executar com navegador visível (útil para depuração visual):
npm run scrape -- --nicho="pet shop" --regiao="Curitiba" --no-headless
```
Os arquivos gerados são salvos em `scraper/output/leads-[data].csv`.

### 3. Executando o CRM Web
```bash
npm run dev
```
Acesse no navegador: **`http://localhost:3000`**

- **Importar Leads**: Clique no botão "Importar CSV" no cabeçalho e selecione a planilha gerada pelo scraper.
- **Verificador de Telefone**: Digite qualquer número na barra superior para verificar se o lead já está cadastrado.
- **Gestão de Kanbans**: Acesse `/kanban` para criar novos quadros, criar colunas personalizadas e mover leads e tarefas.
- **Disparo via WhatsApp**: Clique no ícone verde em qualquer card ou linha de lead para abrir o modal de templates dinâmicos.

---

## 🧪 Testes Automatizados

```bash
# Executa todos os 32 testes unitários (Scraper + CRM):
npm test

# Executa o teste ponta a ponta integrado (E2E Pipeline):
npm run test:e2e
```
