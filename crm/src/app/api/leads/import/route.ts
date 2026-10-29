import { NextResponse } from 'next/server';
import { parseAndAnalyzeCsv, executeImport } from '@/lib/deduplicator';
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

    // Execute import
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
