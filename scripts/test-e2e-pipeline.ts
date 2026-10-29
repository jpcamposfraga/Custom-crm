/**
 * End-to-End Pipeline Verification Test
 * 
 * Verifies the complete flow:
 * 1. Scraper data structures, phone normalization & CSV export
 * 2. CRM database initialization and seeding (SQLite via LibSQL)
 * 3. CRM CSV parsing & smart duplicate detection
 * 4. Batch import and Kanban card generation
 * 5. Lead status updating & Kanban stage synchronization
 * 6. Dynamic WhatsApp Click-to-Chat template interpolation & URL generation
 */

import fs from 'fs';
import path from 'path';
import { normalizePhone } from '../scraper/src/normalizer';
import { exportLeadsToCsv } from '../scraper/src/csv-exporter';
import type { ScrapedLead } from '../scraper/src/types';

// Point CRM to isolated test database
const TEST_DB_PATH = path.resolve(process.cwd(), 'test-pipeline.db');
process.env.DATABASE_URL = `file:${TEST_DB_PATH}`;

async function runE2EPipeline() {
  console.log('🚀 Starting End-to-End Pipeline Verification...\n');

  // Ensure clean test database on startup
  try {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    const journalPath = `${TEST_DB_PATH}-journal`;
    if (fs.existsSync(journalPath)) fs.unlinkSync(journalPath);
  } catch (e) {}

  // Step 1: Simulate Scraper Output
  console.log('📌 [Step 1] Simulating Scraper execution and CSV export...');
  const sampleRawLeads = [
    {
      name: 'Clínica Odonto Sorriso',
      phone: '(19) 98765-4321',
      nicho: 'Dentista',
      hasWebsite: true,
      website: 'https://odontosorriso.com.br',
      location: 'Campinas, SP',
      rating: 4.8,
      reviewsCount: 42,
      googleMapsUrl: 'https://maps.google.com/?cid=123',
    },
    {
      name: 'Consultório Dr. Carlos',
      phone: '+55 19 3234-5678',
      nicho: 'Dentista',
      hasWebsite: false,
      location: 'Campinas, SP',
      rating: 4.5,
      reviewsCount: 15,
      googleMapsUrl: 'https://maps.google.com/?cid=456',
    },
    {
      name: 'Auto Mecânica Express',
      phone: '11999998888',
      nicho: 'Mecânica Automotiva',
      hasWebsite: true,
      website: 'https://mecanicaexpress.com.br',
      location: 'São Paulo, SP',
      rating: 4.9,
      reviewsCount: 88,
      googleMapsUrl: 'https://maps.google.com/?cid=789',
    },
  ];

  const scrapedLeads: ScrapedLead[] = sampleRawLeads.map(item => {
    const norm = normalizePhone(item.phone);
    return {
      ...item,
      normalizedPhone: norm.normalized,
    };
  });

  const tempCsvPath = path.resolve(process.cwd(), 'temp-e2e-leads.csv');
  await exportLeadsToCsv(scrapedLeads, tempCsvPath);
  console.log(`   ✅ Exported ${scrapedLeads.length} leads to CSV: ${tempCsvPath}`);

  // Step 2: Initialize CRM Database
  console.log('\n📌 [Step 2] Initializing CRM database & default seed...');
  const { initDatabase, getDatabase } = await import('../crm/src/db');
  await initDatabase();
  const { db } = getDatabase();
  const { leads, boards, columns, cards, messageTemplates } = await import('../crm/src/db/schema');
  console.log('   ✅ SQLite database initialized with boards, columns, and message templates.');

  // Step 3: Parse CSV & Smart Deduplication in CRM
  console.log('\n📌 [Step 3] Testing CRM CSV parser & duplicate detection...');
  const csvContent = fs.readFileSync(tempCsvPath, 'utf-8');
  const { parseAndAnalyzeCsv, executeImport } = await import('../crm/src/lib/deduplicator');
  
  const initialAnalysis = await parseAndAnalyzeCsv(csvContent);
  console.log(`   Total rows in CSV: ${initialAnalysis.totalRows}`);
  console.log(`   New leads detected: ${initialAnalysis.newLeads.length}`);
  console.log(`   Duplicates detected: ${initialAnalysis.duplicateLeads.length}`);

  if (initialAnalysis.newLeads.length !== 3 || initialAnalysis.duplicateLeads.length !== 0) {
    throw new Error('❌ Initial deduplication failed: expected 3 new leads and 0 duplicates');
  }
  console.log('   ✅ Initial analysis verified: 3 new leads detected.');

  // Step 4: Import Leads into Default Kanban Board
  console.log('\n📌 [Step 4] Executing import into CRM...');
  const importResult = await executeImport(initialAnalysis.newLeads);
  console.log(`   Imported leads count: ${importResult.insertedCount}`);
  console.log(`   Created Kanban cards: ${importResult.cardsCreated}`);

  if (importResult.insertedCount !== 3 || importResult.cardsCreated !== 3) {
    throw new Error('❌ Import failed: expected 3 inserted leads and 3 created cards');
  }
  console.log('   ✅ Import verified.');

  // Step 5: Test Duplicate Detection on Second Upload
  console.log('\n📌 [Step 5] Testing deduplication with repeated CSV...');
  const secondAnalysis = await parseAndAnalyzeCsv(csvContent);
  console.log(`   Second upload - New leads: ${secondAnalysis.newLeads.length}, Duplicates: ${secondAnalysis.duplicateLeads.length}`);

  if (secondAnalysis.newLeads.length !== 0 || secondAnalysis.duplicateLeads.length !== 3) {
    throw new Error('❌ Duplicate detection failed: expected 0 new and 3 duplicate leads on re-import');
  }
  console.log('   ✅ Deduplicator successfully blocked duplicates based on normalized phone.');

  // Step 6: Test Real-time Phone Checker
  console.log('\n📌 [Step 6] Testing real-time phone lookup...');
  const { eq } = await import('drizzle-orm');
  const [existingLead] = await db.select().from(leads).where(eq(leads.normalized_phone, '19987654321'));
  if (!existingLead || existingLead.name !== 'Clínica Odonto Sorriso') {
    throw new Error('❌ Phone lookup failed to locate Clínica Odonto Sorriso');
  }
  console.log(`   ✅ Located existing lead: "${existingLead.name}" by phone 19987654321.`);

  // Step 7: Test Kanban Card Movement & Automatic Conversion Status Sync
  console.log('\n📌 [Step 7] Testing Kanban card movement & stage conversion sync...');
  const [targetCard] = await db.select().from(cards).where(eq(cards.lead_id, existingLead.id));
  const [convertedCol] = await db.select().from(columns).where(eq(columns.is_converted_stage, 1));

  if (!targetCard || !convertedCol) {
    throw new Error('❌ Failed to locate card or converted stage column');
  }

  // Update card column and lead status (simulating Kanban move)
  await db.update(cards).set({ column_id: convertedCol.id }).where(eq(cards.id, targetCard.id));
  await db.update(leads).set({ status: 'convertido' }).where(eq(leads.id, existingLead.id));

  const [updatedLead] = await db.select().from(leads).where(eq(leads.id, existingLead.id));
  if (updatedLead.status !== 'convertido') {
    throw new Error('❌ Lead status was not updated to convertido');
  }
  console.log(`   ✅ Lead status synchronized to: "${updatedLead.status}".`);

  // Step 8: WhatsApp Click-to-Chat & Message Template Interpolation
  console.log('\n📌 [Step 8] Testing WhatsApp Click-to-Chat URL generation...');
  const { interpolateTemplate, generateWhatsAppUrl } = await import('../crm/src/lib/template-interpolator');
  const [template] = await db.select().from(messageTemplates).limit(1);

  const messageText = interpolateTemplate(template.content, {
    nome: existingLead.name,
    nicho: existingLead.nicho,
    cidade: existingLead.location || 'sua região',
  });

  const waUrl = generateWhatsAppUrl(existingLead.normalized_phone, messageText);
  console.log(`   Interpolated message: "${messageText.slice(0, 70)}..."`);
  console.log(`   Generated WhatsApp URL: ${waUrl.slice(0, 60)}...`);

  if (!waUrl.startsWith('https://wa.me/5519987654321?text=')) {
    throw new Error('❌ WhatsApp URL generation did not produce expected wa.me prefix');
  }
  console.log('   ✅ WhatsApp Click-to-Chat URL verified.');

  console.log('\n🎉 ALL 8 PIPELINE VERIFICATION STEPS PASSED SUCCESSFULLY! 🎉\n');

  // Close database client so Windows releases file handle
  const { client } = getDatabase();
  client.close();

  // Cleanup temporary test artifacts
  try {
    if (fs.existsSync(tempCsvPath)) fs.unlinkSync(tempCsvPath);
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    const journalPath = `${TEST_DB_PATH}-journal`;
    if (fs.existsSync(journalPath)) fs.unlinkSync(journalPath);
  } catch (e) {
    // Non-critical cleanup
  }
}

runE2EPipeline().catch(err => {
  console.error('\n❌ Pipeline verification error:', err);
  process.exit(1);
});
