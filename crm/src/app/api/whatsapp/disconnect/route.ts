import { NextResponse } from 'next/server';
import { logoutWhatsAppSession } from '@/lib/whatsapp-headless';
import { getDatabase, initDatabase } from '@/db';
import { settings } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function POST() {
  try {
    await logoutWhatsAppSession();

    // Auto-disable auto_send when disconnecting
    await initDatabase();
    const { db } = getDatabase();
    await db
      .insert(settings)
      .values({ key: 'auto_send_whatsapp', value: 'false', updated_at: new Date().toISOString() })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: 'false', updated_at: new Date().toISOString() },
      });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[API /api/whatsapp/disconnect] Erro:', err);
    return NextResponse.json(
      { error: err.message || 'Erro ao desconectar WhatsApp' },
      { status: 500 }
    );
  }
}
