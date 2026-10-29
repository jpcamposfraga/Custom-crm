import { NextResponse } from 'next/server';
import { getDatabase, initDatabase } from '@/db';
import { leads, cards, columns } from '@/db/schema';
import { normalizePhone } from '@/lib/csv-parser';
import { eq } from 'drizzle-orm';

export async function GET(request: Request) {
  try {
    await initDatabase();
    const { searchParams } = new URL(request.url);
    const rawPhone = searchParams.get('phone') || '';
    const normalized = normalizePhone(rawPhone);

    if (!normalized || normalized.length < 8) {
      return NextResponse.json({ exists: false });
    }

    const { db } = getDatabase();
    const [lead] = await db.select().from(leads).where(eq(leads.normalized_phone, normalized));

    if (!lead) {
      return NextResponse.json({ exists: false });
    }

    let stage = lead.status;
    const [card] = await db.select().from(cards).where(eq(cards.lead_id, lead.id)).limit(1);
    if (card) {
      const [col] = await db.select().from(columns).where(eq(columns.id, card.column_id)).limit(1);
      if (col) {
        stage = col.title;
      }
    }

    return NextResponse.json({
      exists: true,
      lead: {
        id: lead.id,
        name: lead.name,
        phone: lead.phone,
        normalized_phone: lead.normalized_phone,
        nicho: lead.nicho,
        status: lead.status,
        location: lead.location,
        has_website: lead.has_website,
        website: lead.website,
        stage,
      },
    });
  } catch (err: any) {
    console.error('Check phone error:', err);
    return NextResponse.json({ error: err.message || 'Error checking phone' }, { status: 500 });
  }
}
