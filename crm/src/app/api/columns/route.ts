import { NextResponse } from 'next/server';
import { getDatabase, initDatabase } from '@/db';
import { columns, cards } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    await initDatabase();
    const { db } = getDatabase();
    const body = await request.json();

    const board_id = body.board_id;
    const title = String(body.title || '').trim();
    if (!board_id || !title) {
      return NextResponse.json({ error: 'board_id and title are required' }, { status: 400 });
    }

    const existingCols = await db
      .select()
      .from(columns)
      .where(eq(columns.board_id, board_id))
      .orderBy(asc(columns.order));

    const nextOrder = existingCols.length > 0 ? existingCols[existingCols.length - 1].order + 1 : 0;
    const newCol = {
      id: crypto.randomUUID(),
      board_id,
      title,
      order: nextOrder,
      is_converted_stage: body.is_converted_stage ? 1 : 0,
      is_lost_stage: body.is_lost_stage ? 1 : 0,
    };

    await db.insert(columns).values(newCol);
    return NextResponse.json({ success: true, column: newCol });
  } catch (err: any) {
    console.error('Create column error:', err);
    return NextResponse.json({ error: err.message || 'Error creating column' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await initDatabase();
    const { db } = getDatabase();
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json({ error: 'Column id is required' }, { status: 400 });
    }

    const updates: Record<string, any> = {};
    if (body.title !== undefined) updates.title = body.title;
    if (body.order !== undefined) updates.order = body.order;
    if (body.is_converted_stage !== undefined) updates.is_converted_stage = body.is_converted_stage ? 1 : 0;
    if (body.is_lost_stage !== undefined) updates.is_lost_stage = body.is_lost_stage ? 1 : 0;

    await db.update(columns).set(updates).where(eq(columns.id, body.id));
    const [updatedCol] = await db.select().from(columns).where(eq(columns.id, body.id));

    return NextResponse.json({ success: true, column: updatedCol });
  } catch (err: any) {
    console.error('Update column error:', err);
    return NextResponse.json({ error: err.message || 'Error updating column' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await initDatabase();
    const { db } = getDatabase();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Column id is required' }, { status: 400 });
    }

    // Delete cards in this column
    await db.delete(cards).where(eq(cards.column_id, id));
    await db.delete(columns).where(eq(columns.id, id));

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Delete column error:', err);
    return NextResponse.json({ error: err.message || 'Error deleting column' }, { status: 500 });
  }
}
