import { NextResponse } from 'next/server';
import { getDatabase, initDatabase } from '@/db';
import { boards, columns, cards } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';
import crypto from 'crypto';

export async function GET() {
  try {
    await initDatabase();
    const { db } = getDatabase();

    const allBoards = await db.select().from(boards);
    const boardsWithColumns = await Promise.all(
      allBoards.map(async (board) => {
        const cols = await db
          .select()
          .from(columns)
          .where(eq(columns.board_id, board.id))
          .orderBy(asc(columns.order));
        return {
          ...board,
          columns: cols,
        };
      })
    );

    return NextResponse.json({ boards: boardsWithColumns });
  } catch (err: any) {
    console.error('Fetch boards error:', err);
    return NextResponse.json({ error: err.message || 'Error fetching boards' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await initDatabase();
    const { db } = getDatabase();
    const body = await request.json();

    const title = body.title ? String(body.title).trim() : 'Novo Quadro';
    const description = body.description ? String(body.description).trim() : null;
    const type = body.type || 'leads';
    const boardId = crypto.randomUUID();
    const now = new Date().toISOString();

    await db.insert(boards).values({
      id: boardId,
      title,
      description,
      type,
      created_at: now,
    });

    // Create default columns for new board
    const defaultCols = [
      { id: crypto.randomUUID(), board_id: boardId, title: 'A Fazer', order: 0, is_converted_stage: 0, is_lost_stage: 0 },
      { id: crypto.randomUUID(), board_id: boardId, title: 'Em Andamento', order: 1, is_converted_stage: 0, is_lost_stage: 0 },
      { id: crypto.randomUUID(), board_id: boardId, title: 'Concluído', order: 2, is_converted_stage: 1, is_lost_stage: 0 },
    ];

    for (const col of defaultCols) {
      await db.insert(columns).values(col);
    }

    return NextResponse.json({
      success: true,
      board: {
        id: boardId,
        title,
        description,
        type,
        created_at: now,
        columns: defaultCols,
      },
    });
  } catch (err: any) {
    console.error('Create board error:', err);
    return NextResponse.json({ error: err.message || 'Error creating board' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await initDatabase();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID do quadro é obrigatório' }, { status: 400 });
    }

    const { db } = getDatabase();

    const allBoards = await db.select().from(boards);
    if (allBoards.length <= 1) {
      return NextResponse.json(
        { error: 'Não é possível excluir o único quadro existente. Crie outro quadro antes.' },
        { status: 400 }
      );
    }

    // Cascade delete cards and columns under this board
    await db.delete(cards).where(eq(cards.board_id, id));
    await db.delete(columns).where(eq(columns.board_id, id));
    await db.delete(boards).where(eq(boards.id, id));

    return NextResponse.json({ success: true, deletedId: id });
  } catch (err: any) {
    console.error('Delete board error:', err);
    return NextResponse.json({ error: err.message || 'Error deleting board' }, { status: 500 });
  }
}
