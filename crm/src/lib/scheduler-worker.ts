import { getDatabase, initDatabase } from '../db';
import { scheduledMessages, leads } from '../db/schema';
import { eq, asc, and } from 'drizzle-orm';
import { generateWhatsAppUrl, type WhatsAppPlatform } from './template-interpolator';
import { exec } from 'node:child_process';

export type UrlLauncher = (url: string) => Promise<void>;

// Default OS URL opener (Windows 'start', macOS 'open', Linux 'xdg-open')
async function defaultOsUrlLauncher(url: string): Promise<void> {
  return new Promise((resolve) => {
    const cmd =
      process.platform === 'win32'
        ? `start "" "${url}"`
        : process.platform === 'darwin'
        ? `open "${url}"`
        : `xdg-open "${url}"`;

    exec(cmd, (err) => {
      if (err) {
        console.error('[Scheduler] Erro ao abrir URL no sistema operacional:', err);
      }
      resolve();
    });
  });
}

let activeUrlLauncher: UrlLauncher = defaultOsUrlLauncher;

export function setUrlLauncher(launcher: UrlLauncher) {
  activeUrlLauncher = launcher;
}

export function resetUrlLauncher() {
  activeUrlLauncher = defaultOsUrlLauncher;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isMessageDue(scheduledFor: string, nowMs = Date.now()): boolean {
  const scheduledMs = Date.parse(scheduledFor);
  if (isNaN(scheduledMs)) return false;
  return scheduledMs <= nowMs;
}

// Singleton state
let timerInstance: NodeJS.Timeout | null = null;
let isProcessingQueue = false;

export interface ProcessQueueResult {
  processedCount: number;
  errors: string[];
}

/**
 * Processes due scheduled messages one-by-one in a sequential queue with humanized cadence (3s interval).
 */
export async function checkAndTriggerDueMessages(
  options: { delayBetweenMs?: number; nowMs?: number } = {}
): Promise<ProcessQueueResult> {
  // Prevent concurrent runs: single worker queue
  if (isProcessingQueue) {
    return { processedCount: 0, errors: ['Worker já está processando a fila'] };
  }

  isProcessingQueue = true;
  const errors: string[] = [];
  let processedCount = 0;
  const delayMs = options.delayBetweenMs ?? 3000;
  const currentNow = options.nowMs ?? Date.now();

  try {
    await initDatabase();
    const { db } = getDatabase();

    // Query pending messages joined with lead details
    const rows = await db
      .select({
        id: scheduledMessages.id,
        lead_id: scheduledMessages.lead_id,
        message: scheduledMessages.message,
        scheduled_for: scheduledMessages.scheduled_for,
        status: scheduledMessages.status,
        platform: scheduledMessages.platform,
        lead_name: leads.name,
        lead_phone: leads.phone,
        lead_normalized_phone: leads.normalized_phone,
      })
      .from(scheduledMessages)
      .leftJoin(leads, eq(scheduledMessages.lead_id, leads.id))
      .where(eq(scheduledMessages.status, 'pendente'))
      .orderBy(asc(scheduledMessages.scheduled_for));

    // Filter only due messages
    const dueItems = rows.filter((r) => isMessageDue(r.scheduled_for, currentNow));

    if (dueItems.length === 0) {
      return { processedCount: 0, errors: [] };
    }

    console.log(`[Scheduler] ⏰ ${dueItems.length} mensagem(ns) pronta(s) para disparo sequencial...`);

    for (let i = 0; i < dueItems.length; i++) {
      const item = dueItems[i];
      const phone = item.lead_normalized_phone || item.lead_phone;

      if (!phone || !phone.trim() || phone === 'null') {
        // Mark as cancelado due to missing phone
        await db
          .update(scheduledMessages)
          .set({ status: 'cancelado' })
          .where(eq(scheduledMessages.id, item.id));
        errors.push(`Lead ${item.lead_name || item.lead_id} sem telefone válido.`);
        continue;
      }

      // Generate direct WhatsApp link (Web or Desktop App)
      const platformToUse = (item.platform as WhatsAppPlatform) || 'web';
      const url = generateWhatsAppUrl(phone, item.message, platformToUse);

      console.log(
        `[Scheduler] [${i + 1}/${dueItems.length}] Abrindo WhatsApp para "${item.lead_name || phone}" via ${platformToUse}...`
      );

      // Trigger via OS launcher (start command)
      await activeUrlLauncher(url);

      // Update message status to 'enviado'
      await db
        .update(scheduledMessages)
        .set({ status: 'enviado' })
        .where(eq(scheduledMessages.id, item.id));

      // Update lead status to 'em_contato'
      await db
        .update(leads)
        .set({ status: 'em_contato', updated_at: new Date().toISOString() })
        .where(eq(leads.id, item.lead_id));

      processedCount++;

      // Wait humanized delay before opening next message (if more remaining in queue)
      if (i < dueItems.length - 1 && delayMs > 0) {
        await sleep(delayMs);
      }
    }
  } catch (err: any) {
    console.error('[Scheduler] Erro ao processar fila:', err);
    errors.push(err.message || 'Erro inesperado');
  } finally {
    isProcessingQueue = false;
  }

  return { processedCount, errors };
}

/**
 * Starts the single background timer worker (Singleton).
 */
export function startSchedulerWorker(intervalMs = 15000): void {
  if (timerInstance) {
    return; // Already running as single worker
  }

  console.log(`[Scheduler] 🚀 Iniciando Worker Único (verificando a cada ${intervalMs / 1000}s)...`);

  // Run initial check
  checkAndTriggerDueMessages().catch(() => {});

  timerInstance = setInterval(() => {
    checkAndTriggerDueMessages().catch(() => {});
  }, intervalMs);
}

/**
 * Stops the single worker.
 */
export function stopSchedulerWorker(): void {
  if (timerInstance) {
    clearInterval(timerInstance);
    timerInstance = null;
    console.log('[Scheduler] 🛑 Worker Único pausado.');
  }
}
