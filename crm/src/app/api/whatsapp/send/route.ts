import { NextResponse } from 'next/server';
import { sendHeadlessMessage, isAutoSendEligible } from '@/lib/whatsapp-headless';
import { getDatabase, initDatabase } from '@/db';
import { leads } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phone, message, lead_id } = body;

    if (!phone || !message) {
      return NextResponse.json(
        { error: 'phone e message são obrigatórios' },
        { status: 400 }
      );
    }

    const cleanDigits = String(phone).replace(/\D/g, '');
    if (cleanDigits.length < 10) {
      return NextResponse.json(
        { error: 'Número de telefone inválido (deve conter ao menos 10 dígitos com DDD)' },
        { status: 400 }
      );
    }

    const eligible = await isAutoSendEligible();
    if (!eligible) {
      return NextResponse.json(
        { error: 'Envio automático não está habilitado ou WhatsApp não está conectado' },
        { status: 403 }
      );
    }

    const result = await sendHeadlessMessage(phone, message);

    if (result.success) {
      // If lead_id provided, update status to em_contato
      if (lead_id) {
        try {
          await initDatabase();
          const { db } = getDatabase();
          await db
            .update(leads)
            .set({ status: 'em_contato', updated_at: new Date().toISOString() })
            .where(eq(leads.id, lead_id));
        } catch (dbErr) {
          console.warn('[API /api/whatsapp/send] Aviso ao atualizar lead status:', dbErr);
        }
      }

      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { success: false, error: result.error || 'Erro ao enviar mensagem' },
        { status: 400 }
      );
    }
  } catch (err: any) {
    console.error('[API /api/whatsapp/send] Erro inesperado:', err);
    return NextResponse.json(
      { error: err.message || 'Erro inesperado no servidor' },
      { status: 500 }
    );
  }
}
