import { NextResponse } from 'next/server';
import { getDatabase, initDatabase } from '@/db';
import { settings } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  try {
    await initDatabase();
    const { db } = getDatabase();
    const allSettings = await db.select().from(settings);
    const settingsMap: Record<string, string> = {};
    for (const s of allSettings) {
      settingsMap[s.key] = s.value;
    }
    return NextResponse.json({ settings: settingsMap });
  } catch (err: any) {
    console.error('Fetch settings error:', err);
    return NextResponse.json({ error: err.message || 'Error fetching settings' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await initDatabase();
    const { db } = getDatabase();
    const body = await request.json();

    const { key, value } = body;
    if (!key || value === undefined) {
      return NextResponse.json({ error: 'Key and value are required' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const [existing] = await db.select().from(settings).where(eq(settings.key, key));

    if (existing) {
      await db.update(settings).set({ value: String(value), updated_at: now }).where(eq(settings.key, key));
    } else {
      await db.insert(settings).values({ key, value: String(value), updated_at: now });
    }

    return NextResponse.json({ success: true, key, value });
  } catch (err: any) {
    console.error('Update settings error:', err);
    return NextResponse.json({ error: err.message || 'Error updating settings' }, { status: 500 });
  }
}
