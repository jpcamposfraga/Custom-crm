import { NextResponse } from 'next/server';
import { getDatabase, initDatabase } from '@/db';
import { leads, cards, columns } from '@/db/schema';
import { normalizePhone } from '@/lib/csv-parser';
import { eq, and, desc, asc, like, or } from 'drizzle-orm';
import crypto from 'crypto';

export async function GET(request: Request) {
  try {
    await initDatabase();
    const { db } = getDatabase();
    const { searchParams } = new URL(request.url);

    const search = searchParams.get('search') || '';
    const nicho = searchParams.get('nicho') || '';
    const status = searchParams.get('status') || '';
    const hasWebsite = searchParams.get('has_website');
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    const conditions = [];

    if (search.trim()) {
      const term = `%${search.trim()}%`;
      conditions.push(or(like(leads.name, term), like(leads.phone, term), like(leads.location, term)));
    }

    if (nicho) {
      conditions.push(eq(leads.nicho, nicho));
    }

    if (status) {
      conditions.push(eq(leads.status, status as any));
    }

    if (hasWebsite !== null && hasWebsite !== undefined && hasWebsite !== '') {
      conditions.push(eq(leads.has_website, parseInt(hasWebsite, 10)));
    }

    // Determine order
    let orderClause = desc(leads.created_at);
    if (sortBy === 'name') {
      orderClause = sortOrder === 'asc' ? asc(leads.name) : desc(leads.name);
    } else if (sortBy === 'nicho') {
      orderClause = sortOrder === 'asc' ? asc(leads.nicho) : desc(leads.nicho);
    } else if (sortBy === 'created_at') {
      orderClause = sortOrder === 'asc' ? asc(leads.created_at) : desc(leads.created_at);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const allLeads = await db.select().from(leads).where(whereClause).orderBy(orderClause);

    // Get distinct niches for filter dropdown
    const distinctNichesRows = await db
      .select({ nicho: leads.nicho })
      .from(leads);
    const niches = Array.from(new Set(distinctNichesRows.map(r => r.nicho))).filter(Boolean).sort();

    return NextResponse.json({
      leads: allLeads,
      niches,
      total: allLeads.length,
    });
  } catch (err: any) {
    console.error('Fetch leads error:', err);
    return NextResponse.json({ error: err.message || 'Error fetching leads' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await initDatabase();
    const { db } = getDatabase();
    const body = await request.json();

    const name = String(body.name || '').trim();
    const phone = String(body.phone || '').trim();
    if (!name || !phone) {
      return NextResponse.json({ error: 'Nome e telefone são obrigatórios' }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const normalized_phone = normalizePhone(phone);
    const has_website = body.website ? 1 : (body.has_website ? 1 : 0);

    const newLead = {
      id,
      name,
      phone,
      normalized_phone,
      has_website,
      website: body.website ? String(body.website).trim() : null,
      nicho: body.nicho ? String(body.nicho).trim() : 'Geral',
      location: body.location ? String(body.location).trim() : null,
      status: (body.status || 'novo') as any,
      notes: body.notes || null,
      created_at: now,
      updated_at: now,
    };

    await db.insert(leads).values(newLead);
    return NextResponse.json({ success: true, lead: newLead });
  } catch (err: any) {
    console.error('Create lead error:', err);
    return NextResponse.json({ error: err.message || 'Error creating lead' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await initDatabase();
    const { db } = getDatabase();
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json({ error: 'Lead ID is required' }, { status: 400 });
    }

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (body.status !== undefined) updates.status = body.status;
    if (body.notes !== undefined) updates.notes = body.notes;
    if (body.name !== undefined) updates.name = body.name;
    if (body.phone !== undefined) {
      updates.phone = body.phone;
      updates.normalized_phone = normalizePhone(body.phone);
    }
    if (body.website !== undefined) {
      updates.website = body.website;
      updates.has_website = body.website ? 1 : 0;
    }
    if (body.nicho !== undefined) updates.nicho = body.nicho;
    if (body.location !== undefined) updates.location = body.location;

    await db.update(leads).set(updates).where(eq(leads.id, body.id));

    // If status changed to 'convertido' or 'perdido', sync associated kanban card
    if (body.status === 'convertido' || body.status === 'perdido') {
      const [card] = await db.select().from(cards).where(eq(cards.lead_id, body.id)).limit(1);
      if (card) {
        const flagColumn = body.status === 'convertido' ? 'is_converted_stage' : 'is_lost_stage';
        const cols = await db.select().from(columns).where(eq(columns.board_id, card.board_id));
        const targetCol = cols.find(c => (c as any)[flagColumn] === 1);
        if (targetCol) {
          await db.update(cards).set({ column_id: targetCol.id }).where(eq(cards.id, card.id));
        }
      }
    }

    const [updatedLead] = await db.select().from(leads).where(eq(leads.id, body.id));
    return NextResponse.json({ success: true, lead: updatedLead });
  } catch (err: any) {
    console.error('Update lead error:', err);
    return NextResponse.json({ error: err.message || 'Error updating lead' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await initDatabase();
    const { db } = getDatabase();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Lead ID is required' }, { status: 400 });
    }

    await db.delete(cards).where(eq(cards.lead_id, id));
    await db.delete(leads).where(eq(leads.id, id));

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Delete lead error:', err);
    return NextResponse.json({ error: err.message || 'Error deleting lead' }, { status: 500 });
  }
}
