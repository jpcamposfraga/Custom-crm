import { NextResponse } from 'next/server';
import { getDatabase, initDatabase } from '@/db';
import { messageTemplates } from '@/db/schema';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';

export async function GET() {
  try {
    await initDatabase();
    const { db } = getDatabase();
    const templates = await db.select().from(messageTemplates);
    return NextResponse.json({ templates });
  } catch (err: any) {
    console.error('Fetch templates error:', err);
    return NextResponse.json({ error: err.message || 'Error fetching templates' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await initDatabase();
    const { db } = getDatabase();
    const body = await request.json();

    const title = String(body.title || '').trim();
    const content = String(body.content || '').trim();
    if (!title || !content) {
      return NextResponse.json({ error: 'Título e conteúdo são obrigatórios' }, { status: 400 });
    }

    const newTemplate = {
      id: crypto.randomUUID(),
      title,
      content,
      created_at: new Date().toISOString(),
    };

    await db.insert(messageTemplates).values(newTemplate);
    return NextResponse.json({ success: true, template: newTemplate });
  } catch (err: any) {
    console.error('Create template error:', err);
    return NextResponse.json({ error: err.message || 'Error creating template' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await initDatabase();
    const { db } = getDatabase();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Template ID is required' }, { status: 400 });
    }

    await db.delete(messageTemplates).where(eq(messageTemplates.id, id));
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Delete template error:', err);
    return NextResponse.json({ error: err.message || 'Error deleting template' }, { status: 500 });
  }
}
