import { NextResponse } from 'next/server';
import { getDatabase, initDatabase } from '@/db';
import { scheduledMessages, leads } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';
import crypto from 'crypto';

export async function GET() {
  try {
    await initDatabase();
    const { db } = getDatabase();

    // Query scheduled messages with lead data
    const rows = await db
      .select({
        id: scheduledMessages.id,
        lead_id: scheduledMessages.lead_id,
        message: scheduledMessages.message,
        scheduled_for: scheduledMessages.scheduled_for,
        status: scheduledMessages.status,
        platform: scheduledMessages.platform,
        created_at: scheduledMessages.created_at,
        lead_name: leads.name,
        lead_phone: leads.phone,
        lead_normalized_phone: leads.normalized_phone,
        lead_nicho: leads.nicho,
      })
      .from(scheduledMessages)
      .leftJoin(leads, eq(scheduledMessages.lead_id, leads.id))
      .orderBy(asc(scheduledMessages.scheduled_for));

    return NextResponse.json({ scheduledMessages: rows });
  } catch (err: any) {
    console.error('Fetch scheduled messages error:', err);
    return NextResponse.json(
      { error: err.message || 'Error fetching scheduled messages' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await initDatabase();
    const { db } = getDatabase();
    const body = await request.json();

    const { lead_id, message, scheduled_for, platform } = body;

    if (!lead_id || !message || !scheduled_for) {
      return NextResponse.json(
        { error: 'lead_id, message e scheduled_for são obrigatórios' },
        { status: 400 }
      );
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await db.insert(scheduledMessages).values({
      id,
      lead_id,
      message,
      scheduled_for,
      status: 'pendente',
      platform: platform || 'web',
      created_at: now,
    });

    // Ensure background scheduler worker is running
    const { startSchedulerWorker } = await import('@/lib/scheduler-worker');
    startSchedulerWorker();

    return NextResponse.json({
      success: true,
      scheduledMessage: {
        id,
        lead_id,
        message,
        scheduled_for,
        status: 'pendente',
        platform: platform || 'web',
        created_at: now,
      },
    });
  } catch (err: any) {
    console.error('Create scheduled message error:', err);
    return NextResponse.json(
      { error: err.message || 'Error scheduling message' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    await initDatabase();
    const { db } = getDatabase();
    const body = await request.json();

    const { id, status } = body;
    if (!id || !status) {
      return NextResponse.json({ error: 'id e status são obrigatórios' }, { status: 400 });
    }

    await db
      .update(scheduledMessages)
      .set({ status })
      .where(eq(scheduledMessages.id, id));

    return NextResponse.json({ success: true, id, status });
  } catch (err: any) {
    console.error('Update scheduled message error:', err);
    return NextResponse.json(
      { error: err.message || 'Error updating scheduled message' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    await initDatabase();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }

    const { db } = getDatabase();
    await db.delete(scheduledMessages).where(eq(scheduledMessages.id, id));

    return NextResponse.json({ success: true, deletedId: id });
  } catch (err: any) {
    console.error('Delete scheduled message error:', err);
    return NextResponse.json(
      { error: err.message || 'Error deleting scheduled message' },
      { status: 500 }
    );
  }
}
