#!/usr/bin/env node
import { Command } from 'commander';
import prompts from 'prompts';
import { crawlGoogleMaps } from './crawler.js';
import { exportLeadsToCsv } from './csv-exporter.js';
import { buildSearchQuery } from './query-builder.js';

interface CliOptions {
  nicho?: string;
  regiao?: string;
  busca?: string;
  limite?: string;
  saida?: string;
  headless?: string;
}

export async function runCli(argv: string[] = process.argv): Promise<void> {
  const program = new Command();

  program
    .name('scraper')
    .description('CLI tool to scrape local business leads from Google Maps')
    .version('1.0.0')
    .option('-n, --nicho <nicho>', 'Nicho de negócio (ex: dentistas, contabilidade)')
    .option('-r, --regiao <regiao>', 'Região geográfica ou cidade (ex: Campinas, SP)')
    .option('-b, --busca <termo>', 'Termo de busca completo (sobrescreve nicho e região)')
    .option('-l, --limite <numero>', 'Quantidade máxima de resultados a extrair', '20')
    .option('-s, --saida <caminho>', 'Caminho do arquivo CSV de saída')
    .option('--no-headless', 'Executar navegador de forma visível (útil para depuração)');

  program.parse(argv);
  const opts = program.opts<CliOptions>();

  let nicho = opts.nicho;
  let regiao = opts.regiao;
  let busca = opts.busca;
  let limite = parseInt(opts.limite || '20', 10);
  let saida = opts.saida;
  const headless = opts.headless !== undefined ? opts.headless !== 'false' : true;

  // If no direct search term and no nicho provided, prompt interactively
  if (!busca && !nicho) {
    console.log('\n🔍 Google Maps Lead Scraper - Modo Interativo');
    console.log('─────────────────────────────────────────────');

    const response = await prompts(
      [
        {
          type: 'text',
          name: 'nicho',
          message: 'Qual o nicho a buscar? (Ex: barbearia, dentista, clínica estética)',
          validate: (val) => (val && val.trim().length > 0 ? true : 'Por favor informe o nicho'),
        },
        {
          type: 'text',
          name: 'regiao',
          message: 'Qual a região ou cidade? (Ex: Campinas, SP ou Zona Sul de São Paulo)',
          validate: (val) => (val && val.trim().length > 0 ? true : 'Por favor informe a região'),
        },
        {
          type: 'number',
          name: 'limite',
          message: 'Quantidade máxima de leads a extrair?',
          initial: 20,
          min: 1,
          max: 200,
        },
        {
          type: 'text',
          name: 'saida',
          message: 'Caminho do CSV de saída (pressione Enter para padrão automático):',
        },
      ],
      {
        onCancel: () => {
          console.log('\n❌ Operação cancelada pelo usuário.');
          process.exit(0);
        },
      }
    );

    nicho = response.nicho;
    regiao = response.regiao;
    limite = response.limite || 20;
    saida = response.saida || undefined;
  }

  const query = buildSearchQuery({ busca, nicho, regiao });
  if (!query) {
    console.error('❌ Erro: Termo de busca não definido.');
    process.exit(1);
  }

  console.log(`\n🚀 Iniciando extração no Google Maps: "${query}"`);
  console.log(`📊 Limite desejado: ${limite} leads`);
  console.log(`🌐 Navegador: ${headless ? 'Headless (em segundo plano)' : 'Com interface visível'}\n`);

  const startTime = Date.now();

  try {
    const leads = await crawlGoogleMaps(query, limite, {
      headless,
      nicho: nicho || query,
      onProgress: (current, total, leadName) => {
        console.log(` [${current}/${total}] ${leadName}`);
      },
    });

    console.log(`\n✅ Extração concluída em ${((Date.now() - startTime) / 1000).toFixed(1)}s!`);
    console.log(`📦 Total de leads capturados: ${leads.length}`);

    const validPhones = leads.filter((l) => l.normalizedPhone && l.normalizedPhone.length >= 10);
    const withWebsites = leads.filter((l) => l.hasWebsite);

    console.log(`📞 Com telefone válido: ${validPhones.length} (${((validPhones.length / (leads.length || 1)) * 100).toFixed(0)}%)`);
    console.log(`🌐 Com website: ${withWebsites.length} (${((withWebsites.length / (leads.length || 1)) * 100).toFixed(0)}%)`);

    const exportedFile = await exportLeadsToCsv(leads, saida);
    console.log(`\n💾 Arquivo salvo com sucesso em:`);
    console.log(`   ${exportedFile}\n`);
    console.log(`💡 Para importar esses leads no seu CRM, utilize a aba de importação na interface web.`);
  } catch (error) {
    console.error('\n❌ Ocorreu um erro durante a raspagem:', error);
    process.exit(1);
  }
}

// Only invoke CLI if executed directly
const isMain = Boolean(process.argv[1] && /cli\.(ts|js)$/.test(process.argv[1]));
if (isMain) {
  runCli();
}
