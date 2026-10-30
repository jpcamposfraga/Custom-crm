import { NextResponse } from 'next/server';
import { startWhatsAppSession } from '@/lib/whatsapp-headless';

export async function POST() {
  try {
    const result = await startWhatsAppSession();
    return NextResponse.json({
      success: true,
      status: result.status,
      qrCode: result.qrCode,
    });
  } catch (err: any) {
    console.error('[API /api/whatsapp/connect] Erro:', err);
    return NextResponse.json(
      { error: err.message || 'Erro ao iniciar sessão do WhatsApp' },
      { status: 500 }
    );
  }
}
