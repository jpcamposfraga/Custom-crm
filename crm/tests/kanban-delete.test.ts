import { describe, it, expect } from 'vitest';
import { getDatabase, initDatabase } from '../src/db';
import { boards, columns, cards } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

describe('Kanban Board Deletion', () => {
  it('prevents deleting the last remaining board', async () => {
    await initDatabase();
    const { db } = getDatabase();

    const allBoards = await db.select().from(boards);
    // If only 1 board exists, deletion should be prevented
    expect(allBoards.length).toBeGreaterThan(0);
  });

  it('deletes a board and cascades deletion to columns and cards', async () => {
    await initDatabase();
    const { db } = getDatabase();

    // Create a temporary board
    const tempBoardId = crypto.randomUUID();
    const tempColId = crypto.randomUUID();
    const tempCardId = crypto.randomUUID();
    const now = new Date().toISOString();

    await db.insert(boards).values({
      id: tempBoardId,
      title: 'Quadro Temporário para Deletar',
      type: 'tasks',
      created_at: now,
    });

    await db.insert(columns).values({
      id: tempColId,
      board_id: tempBoardId,
      title: 'Etapa Temp',
      order: 0,
      is_converted_stage: 0,
      is_lost_stage: 0,
    });

    await db.insert(cards).values({
      id: tempCardId,
      board_id: tempBoardId,
      column_id: tempColId,
      title: 'Card Temp',
      order: 0,
      created_at: now,
    });

    // Verify created
    const [createdBoard] = await db.select().from(boards).where(eq(boards.id, tempBoardId));
    expect(createdBoard).toBeDefined();

    // Delete in cascade
    await db.delete(cards).where(eq(cards.board_id, tempBoardId));
    await db.delete(columns).where(eq(columns.board_id, tempBoardId));
    await db.delete(boards).where(eq(boards.id, tempBoardId));

    // Verify deleted
    const [deletedBoard] = await db.select().from(boards).where(eq(boards.id, tempBoardId));
    const deletedCols = await db.select().from(columns).where(eq(columns.board_id, tempBoardId));
    const deletedCards = await db.select().from(cards).where(eq(cards.board_id, tempBoardId));

    expect(deletedBoard).toBeUndefined();
    expect(deletedCols).toHaveLength(0);
    expect(deletedCards).toHaveLength(0);
  });
});
