import { NextResponse } from 'next/server';
import { parseAndAnalyzeCsv, executeImport, ingestRawLeads } from '@/lib/deduplicator';
import { initDatabase } from '@/db';

export async function POST(request: Request) {
  try {
    await initDatabase();
    const body = await request.json();

    if (body.analyzeOnly) {
      if (!body.csvContent) {
        return NextResponse.json({ error: 'csvContent is required for analysis' }, { status: 400 });
      }
      const analysis = await parseAndAnalyzeCsv(body.csvContent);
      return NextResponse.json(analysis);
    }

    // Direct leads array (e.g. from Scraper CLI or direct API sync)
    const directLeads = body.leads || (Array.isArray(body) ? body : null);
    if (directLeads && Array.isArray(directLeads)) {
      const summary = await ingestRawLeads(directLeads, body.options || {});
      return NextResponse.json({ success: true, summary });
    }

    // Execute import from pre-analyzed leads or raw csvContent
    let leadsToInsert = body.leadsToInsert;
    if (!leadsToInsert && body.csvContent) {
      const analysis = await parseAndAnalyzeCsv(body.csvContent);
      leadsToInsert = analysis.newLeads;
    }

    if (!leadsToInsert || !Array.isArray(leadsToInsert)) {
      return NextResponse.json({ error: 'No leads provided to import' }, { status: 400 });
    }

    const summary = await executeImport(leadsToInsert, body.options || {});
    return NextResponse.json({ success: true, summary });
  } catch (err: any) {
    console.error('Import error:', err);
    return NextResponse.json({ error: err.message || 'Import failed' }, { status: 500 });
  }
}
