import { NextResponse } from 'next/server';
import { getWhatsAppSessionStatus } from '@/lib/whatsapp-headless';

export async function GET() {
  try {
    const data = await getWhatsAppSessionStatus();
    return NextResponse.json(data);
  } catch (err: any) {
    console.error('[API /api/whatsapp/status] Erro:', err);
    return NextResponse.json(
      { error: err.message || 'Erro ao consultar status do WhatsApp' },
      { status: 500 }
    );
  }
}
