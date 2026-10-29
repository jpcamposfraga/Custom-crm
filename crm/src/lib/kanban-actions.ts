import { getDatabase } from '../db';
import { cards, columns, leads } from '../db/schema';
import { eq } from 'drizzle-orm';

export async function moveCard(cardId: string, targetColumnId: string, newOrder?: number) {
  const { db } = getDatabase();

  const [card] = await db.select().from(cards).where(eq(cards.id, cardId));
  if (!card) {
    throw new Error(`Card not found: ${cardId}`);
  }

  const [targetCol] = await db.select().from(columns).where(eq(columns.id, targetColumnId));
  if (!targetCol) {
    throw new Error(`Target column not found: ${targetColumnId}`);
  }

  const updateCardData: Record<string, any> = {
    column_id: targetColumnId,
  };
  if (newOrder !== undefined) {
    updateCardData.order = newOrder;
  }

  await db.update(cards).set(updateCardData).where(eq(cards.id, cardId));

  // Sync Lead status if attached
  if (card.lead_id) {
    let newStatus: 'novo' | 'em_contato' | 'convertido' | 'perdido' | null = null;

    if (targetCol.is_converted_stage === 1) {
      newStatus = 'convertido';
    } else if (targetCol.is_lost_stage === 1) {
      newStatus = 'perdido';
    } else if (targetCol.title.toLowerCase().includes('contato')) {
      newStatus = 'em_contato';
    } else if (targetCol.title.toLowerCase().includes('novo')) {
      newStatus = 'novo';
    }

    if (newStatus) {
      await db
        .update(leads)
        .set({ status: newStatus, updated_at: new Date().toISOString() })
        .where(eq(leads.id, card.lead_id));
    }
  }

  const [updatedCard] = await db.select().from(cards).where(eq(cards.id, cardId));
  return updatedCard;
}
