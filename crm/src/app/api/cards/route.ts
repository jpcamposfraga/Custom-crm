import { NextResponse } from 'next/server';
import { getDatabase, initDatabase } from '@/db';
import { cards, leads } from '@/db/schema';
import { moveCard } from '@/lib/kanban-actions';
import { eq, asc } from 'drizzle-orm';
import crypto from 'crypto';

export async function GET(request: Request) {
  try {
    await initDatabase();
    const { db } = getDatabase();
    const { searchParams } = new URL(request.url);
    const boardId = searchParams.get('board_id');

    if (!boardId) {
      return NextResponse.json({ error: 'board_id is required' }, { status: 400 });
    }

    const allCards = await db
      .select()
      .from(cards)
      .where(eq(cards.board_id, boardId))
      .orderBy(asc(cards.order));

    // Enrich cards with lead data if attached
    const enriched = await Promise.all(
      allCards.map(async (c) => {
        let leadData = null;
        if (c.lead_id) {
          const [l] = await db.select().from(leads).where(eq(leads.id, c.lead_id));
          leadData = l || null;
        }
        return {
          ...c,
          lead: leadData,
        };
      })
    );

    return NextResponse.json({ cards: enriched });
  } catch (err: any) {
    console.error('Fetch cards error:', err);
    return NextResponse.json({ error: err.message || 'Error fetching cards' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await initDatabase();
    const { db } = getDatabase();
    const body = await request.json();

    const board_id = body.board_id;
    const column_id = body.column_id;
    const title = String(body.title || '').trim();
    if (!board_id || !column_id || !title) {
      return NextResponse.json({ error: 'board_id, column_id and title are required' }, { status: 400 });
    }

    const cardId = crypto.randomUUID();
    const newCard = {
      id: cardId,
      board_id,
      column_id,
      lead_id: body.lead_id || null,
      title,
      description: body.description || null,
      order: body.order || 0,
      created_at: new Date().toISOString(),
    };

    await db.insert(cards).values(newCard);

    let leadData = null;
    if (newCard.lead_id) {
      const [l] = await db.select().from(leads).where(eq(leads.id, newCard.lead_id));
      leadData = l || null;
    }

    return NextResponse.json({ success: true, card: { ...newCard, lead: leadData } });
  } catch (err: any) {
    console.error('Create card error:', err);
    return NextResponse.json({ error: err.message || 'Error creating card' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await initDatabase();
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json({ error: 'Card id is required' }, { status: 400 });
    }

    if (body.column_id) {
      const updated = await moveCard(body.id, body.column_id, body.order);
      return NextResponse.json({ success: true, card: updated });
    }

    const { db } = getDatabase();
    const updates: Record<string, any> = {};
    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.order !== undefined) updates.order = body.order;

    await db.update(cards).set(updates).where(eq(cards.id, body.id));
    const [updatedCard] = await db.select().from(cards).where(eq(cards.id, body.id));

    return NextResponse.json({ success: true, card: updatedCard });
  } catch (err: any) {
    console.error('Update card error:', err);
    return NextResponse.json({ error: err.message || 'Error updating card' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await initDatabase();
    const { db } = getDatabase();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    await db.delete(cards).where(eq(cards.id, id));
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Delete card error:', err);
    return NextResponse.json({ error: err.message || 'Error deleting card' }, { status: 500 });
  }
}
