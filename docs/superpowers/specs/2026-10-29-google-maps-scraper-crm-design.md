# Especificação de Design: Scraper Google Maps & CRM Web

**Data:** 2026-10-29  
**Status:** Aprovado  
**Público-alvo:** Prospecção B2B de negócios locais e gestão comercial pessoal.

---

## 1. Visão Geral e Objetivos

O sistema é composto por duas ferramentas integradas e desacopladas:
1. **Google Maps Scraper**: Um utilitário de linha de comando (CLI) em TypeScript/Playwright que busca estabelecimentos locais no Google Maps com base em nicho e região, extrai dados de contato estruturados e exporta um arquivo `.csv`.
2. **CRM Web Pessoal**: Uma aplicação web fullstack moderna em Next.js (TypeScript, Tailwind CSS, Shadcn UI, SQLite/Drizzle ORM) que importa os leads do CSV com verificação inteligente de duplicados por telefone normalizado, permite organizar leads e tarefas em múltiplos Kanbans customizáveis, gerencia status de conversão e facilita contato comercial via WhatsApp Click-to-Chat com templates dinâmicos.

---

## 2. Subsistema 1: Google Maps Scraper (`/scraper`)

### 2.1 Requisitos Funcionais
- **Execução**: Autônoma via terminal (`npm run scrape`).
- **Parâmetros via CLI (flags)**:
  - `--nicho="ex: dentistas"`
  - `--regiao="ex: Campinas, SP"`
  - `--busca="ex: dentistas em Campinas, SP"` (opção de busca livre)
  - `--limite=50` (número máximo de resultados, padrão 50)
  - `--saida="caminho/arquivo.csv"` (opcional, padrão gera em `scraper/output/leads-[timestamp].csv`)
- **Modo Interativo (Fallback)**:
  - Se executado sem flags (`npm run scrape`), exibe perguntas no terminal solicitando nicho, região e limite.
- **Campos Extraídos**:
  - `name`: Nome do estabelecimento.
  - `phone`: Telefone comercial formatado como exibido no Google Maps.
  - `normalized_phone`: Apenas dígitos (ex: `19987654321` ou `1133334444`).
  - `nicho`: Categoria ou nicho pesquisado/identificado.
  - `has_website`: Booleano indicando se possui website cadastrado (`true` / `false`).
  - `website`: URL do site (ou vazio).
  - `location`: Endereço textual completo ou cidade/estado.
  - `rating`: Nota média (se disponível).
  - `reviews_count`: Quantidade de avaliações (se disponível).
  - `google_maps_url`: Link direto da ficha no Google Maps.
- **Comportamento do Crawler**:
  - Execução com browser headless via Playwright.
  - Rolagem automática do painel lateral de resultados do Google Maps até atingir o limite solicitado ou fim da lista.
  - Extração resiliente com seletores flexíveis para suportar variações na estrutura HTML do Google Maps.
  - Delay humanizado e respeitoso para evitar bloqueios temporários de IP.

---

## 3. Subsistema 2: CRM Web Pessoal (`/crm`)

### 3.1 Stack Tecnológica
- **Framework**: Next.js 15+ (App Router, Server Actions / Route Handlers, React 19).
- **Linguagem**: TypeScript.
- **Estilização**: Tailwind CSS v4 + componentes Shadcn UI (Radix UI, Lucide Icons).
- **Banco de Dados**: SQLite local (`crm.db`) via **Drizzle ORM** (zero-config, leve, sem servidor externo, arquivos simples de backup).
- **Manipulação de CSV**: `papaparse` ou nativo com validação via `zod`.

### 3.2 Modelo de Dados (Schema Drizzle)

#### Tabela `leads`
- `id`: `text` (UUID / cuid), chave primária.
- `name`: `text`, obrigatório.
- `phone`: `text`, obrigatório (como importado).
- `normalized_phone`: `text`, obrigatório (apenas números para comparação e busca rápida).
- `has_website`: `integer` (booleano 0/1).
- `website`: `text`, opcional.
- `nicho`: `text`, obrigatório.
- `location`: `text`, opcional.
- `status`: `text` ('novo' | 'em_contato' | 'convertido' | 'perdido'), padrão 'novo'.
- `notes`: `text`, anotações livres.
- `created_at`: `text` (ISO 8601 timestamp).
- `updated_at`: `text` (ISO 8601 timestamp).

#### Tabela `boards` (Kanbans)
- `id`: `text` (UUID), chave primária.
- `title`: `text`, obrigatório (ex: "Prospecção Clínicas SP", "Tarefas Operacionais").
- `description`: `text`, opcional.
- `type`: `text` ('leads' | 'tasks' | 'general'), padrão 'leads'.
- `created_at`: `text` (ISO timestamp).

#### Tabela `columns` (Estágios do Kanban)
- `id`: `text` (UUID), chave primária.
- `board_id`: `text`, chave estrangeira referenciando `boards.id`.
- `title`: `text`, obrigatório (ex: "A Fazer", "Contato Feito", "Proposta", "Convertido", "Perdido").
- `order`: `integer`, obrigatório (ordem de exibição).
- `is_converted_stage`: `integer` (booleano 0/1, se mover para cá marca lead como convertido).
- `is_lost_stage`: `integer` (booleano 0/1).

#### Tabela `cards` (Itens do Kanban)
- `id`: `text` (UUID), chave primária.
- `board_id`: `text`, chave estrangeira.
- `column_id`: `text`, chave estrangeira.
- `lead_id`: `text`, opcional (nulo para tarefas avulsas).
- `title`: `text`, obrigatório.
- `description`: `text`, opcional.
- `order`: `integer`, obrigatório (posição na coluna).
- `created_at`: `text`.

#### Tabela `message_templates`
- `id`: `text` (UUID), chave primária.
- `title`: `text`, obrigatório (ex: "Primeiro Contato - Apresentação", "Follow-up Sem Resposta").
- `content`: `text`, obrigatório (suporta tags como `{nome}`, `{nicho}`, `{cidade}`).
- `created_at`: `text`.

---

## 4. Funcionalidades Críticas do CRM

### 4.1 Importador de CSV Inteligente e Deduplicador
1. **Upload & Análise**: Usuário seleciona o CSV gerado pelo scraper.
2. **Normalização**: O sistema sanitiza todos os telefones removendo caracteres especiais (ex: `(11) 98888-7777` -> `11988887777`).
3. **Tela de Pré-visualização**:
   - Total de linhas no arquivo.
   - Leads novos (não cadastrados no banco).
   - Leads duplicados identificados pelo `normalized_phone`.
4. **Ações**:
   - Opção 1: "Importar apenas novos" (ignora duplicados).
   - Opção 2: "Importar novos e atualizar dados dos existentes".
   - Seleção do Kanban/Quadro padrão para onde os novos leads devem entrar.

### 4.2 Verificador Rápido de Leads
- Barra de busca global por número de telefone ou nome no cabeçalho.
- Ao digitar um telefone, o CRM informa instantaneamente se o número já existe, em qual coluna/quadro está, e o histórico de anotações.

### 4.3 Múltiplos Kanbans Flexíveis
- Criação e edição de quadros à vontade.
- Personalização de colunas (adicionar, renomear, reordenar).
- Movimentação de cards entre colunas (drag and drop ou menu rápido de seleção de coluna).
- Marcação explícita de "Convertido" ou "Não Convertido" nos cards e no lead.

### 4.4 Listagem de Leads com Ordenação e Filtros
- Tabela paginada/ordenável de leads:
  - Ordenar por: Nicho, Data de Inclusão, Nome, Status de Conversão.
  - Filtrar por: Nicho, Se possui site (`has_website`), Status.
  - Exportar leads filtrados.

### 4.5 WhatsApp Click-to-Chat com Templates
- Botão verde de WhatsApp em cada card e na tabela de leads.
- Ao clicar:
  - Abre modal de contato.
  - Permite escolher um template pré-cadastrado.
  - Substitui as variáveis dinamicamente (`{nome}`, `{nicho}`).
  - Botão "Abrir WhatsApp": abre `https://wa.me/55<normalized_phone>?text=<encoded_text>` em nova aba.
  - Opção de registrar anotação automática ("Mensagem enviada via WhatsApp em [data/hora]").

---

## 5. Diretrizes de Engenharia e Princípios Ponytail
- **Menor complexidade que resolve**: Sem microsserviços ou bibliotecas pesadas desnecessárias.
- **Monorepo Simples**:
  ```text
  crm-jpcamposfraga/
  ├── scraper/             # CLI Scraper Playwright
  │   ├── src/
  │   └── package.json
  ├── crm/                 # Next.js Fullstack CRM
  │   ├── src/
  │   └── package.json
  ├── docs/                # Specs e Planos
  └── package.json         # Scripts de raiz (opcional para orquestração)
  ```
- **Robustez**: SQLite em modo WAL (Write-Ahead Logging) para performance rápida e segura em concorrência.
- **Testabilidade**: Testes unitários para normalização de telefone, parser de CSV, e lógica de deduplicação.
