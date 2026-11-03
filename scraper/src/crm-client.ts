import type { ScrapedLead } from './types.js';

export interface SyncOptions {
  crmUrl?: string;
  timeoutMs?: number;
}

export interface SyncSummary {
  totalReceived: number;
  insertedCount: number;
  duplicatesCount: number;
  cardsCreated: number;
}

export interface SyncResult {
  success: boolean;
  offline: boolean;
  summary?: SyncSummary;
  error?: string;
}

/**
 * Sends scraped leads directly to the CRM import API endpoint.
 * Gracefully handles offline CRM servers (ECONNREFUSED) without crashing.
 */
export async function syncLeadsToCrm(
  leads: ScrapedLead[],
  options: SyncOptions = {}
): Promise<SyncResult> {
  if (!leads || leads.length === 0) {
    return {
      success: true,
      offline: false,
      summary: {
        totalReceived: 0,
        insertedCount: 0,
        duplicatesCount: 0,
        cardsCreated: 0,
      },
    };
  }

  const crmUrl = (options.crmUrl || process.env.CRM_URL || 'http://localhost:3000').replace(/\/$/, '');
  const endpoint = `${crmUrl}/api/leads/import`;
  const timeoutMs = options.timeoutMs || 8000;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ leads }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      let errorMsg = `CRM retornou status ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData?.error) {
          errorMsg = String(errorData.error);
        }
      } catch {}

      return {
        success: false,
        offline: false,
        error: errorMsg,
      };
    }

    const data = await response.json();
    return {
      success: true,
      offline: false,
      summary: data?.summary,
    };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return {
        success: false,
        offline: false,
        error: `Tempo limite esgotado (> ${timeoutMs}ms) aguardando resposta do CRM.`,
      };
    }

    const isConnRefused =
      err.code === 'ECONNREFUSED' ||
      err.cause?.code === 'ECONNREFUSED' ||
      err.message?.includes('fetch failed') ||
      err.message?.includes('ECONNREFUSED');

    if (isConnRefused) {
      return {
        success: false,
        offline: true,
        error: `Servidor CRM offline ou inacessível em ${crmUrl}.`,
      };
    }

    return {
      success: false,
      offline: false,
      error: err.message || 'Erro desconhecido ao enviar leads para o CRM',
    };
  }
}
