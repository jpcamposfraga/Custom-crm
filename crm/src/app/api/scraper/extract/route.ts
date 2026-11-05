import { NextResponse } from 'next/server';
import { initDatabase } from '@/db';
import { buildSearchQuery, crawlGoogleMaps } from '@/lib/maps-crawler';
import { ingestRawLeads } from '@/lib/deduplicator';

export async function POST(request: Request) {
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição JSON inválido' }, { status: 400 });
  }

  const { nicho, regiao, limite, onlyWithoutWebsite, boardId, columnId } = body;
  const query = buildSearchQuery({ nicho, regiao });

  if (!query) {
    return NextResponse.json(
      { error: 'Informe ao menos o Nicho ou a Região para realizar a busca' },
      { status: 400 }
    );
  }

  const limit = Math.min(Math.max(Number(limite) || 20, 1), 100);
  const filterNoWebsite = onlyWithoutWebsite !== false;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const sendEvent = (event: string, data: any) => {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(payload));
      };

      try {
        await initDatabase();
        sendEvent('start', { query, limit, onlyWithoutWebsite: filterNoWebsite });

        const leads = await crawlGoogleMaps(query, limit, {
          nicho: nicho || 'Geral',
          onlyWithoutWebsite: filterNoWebsite,
          onProgress: (current, total, leadName, lead) => {
            sendEvent('progress', { current, total, leadName, lead });
          },
        });

        sendEvent('ingesting', { totalFound: leads.length });

        const summary = await ingestRawLeads(leads, {
          boardId,
          columnId,
          skipDuplicates: true,
        });

        sendEvent('complete', { summary, leads });
      } catch (err: any) {
        sendEvent('error', { message: err?.message || 'Erro durante a extração de leads' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
