import type { ScrapedLead } from './types.js';

export interface SyncOptions {
  crmUrl?: string;
  candidatePorts?: number[];
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
  resolvedUrl?: string;
  summary?: SyncSummary;
  error?: string;
}

export const DEFAULT_CANDIDATE_PORTS = [3000, 3001, 3002, 3003, 3004, 3005];

/**
 * Checks if a candidate port is listening and responds as the CRM service.
 */
export async function probeCrmPort(port: number, timeoutMs = 800): Promise<boolean> {
  try {
    const res = await fetch(`http://localhost:${port}/api/leads/import`, {
      method: 'GET',
      signal: AbortSignal.timeout(timeoutMs),
    });
    return res.status === 200 || res.status === 405;
  } catch {
    return false;
  }
}

/**
 * Discovers an active CRM port on localhost across candidate ports.
 */
export async function discoverActivePort(
  candidatePorts: number[] = DEFAULT_CANDIDATE_PORTS,
  excludePort?: number
): Promise<number | null> {
  const portsToTry = candidatePorts.filter((p) => p !== excludePort);
  for (const port of portsToTry) {
    if (await probeCrmPort(port)) {
      return port;
    }
  }
  return null;
}

async function postLeads(
  crmUrl: string,
  leads: ScrapedLead[],
  timeoutMs: number
): Promise<{ ok: boolean; status: number; data?: any; errorMsg?: string }> {
  const endpoint = `${crmUrl.replace(/\/$/, '')}/api/leads/import`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
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

      return { ok: false, status: response.status, errorMsg };
    }

    const data = await response.json();
    return { ok: true, status: response.status, data };
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

/**
 * Sends scraped leads directly to the CRM import API endpoint.
 * Port-agnostic: automatically discovers which port the CRM is listening on (3000, 3001, etc.).
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

  let crmUrl = (options.crmUrl || process.env.CRM_URL || 'http://localhost:3000').replace(/\/$/, '');
  const timeoutMs = options.timeoutMs || 8000;
  const isLocalhost = crmUrl.includes('localhost') || crmUrl.includes('127.0.0.1');

  try {
    const res = await postLeads(crmUrl, leads, timeoutMs);
    if (!res.ok) {
      return {
        success: false,
        offline: false,
        resolvedUrl: crmUrl,
        error: res.errorMsg,
      };
    }

    return {
      success: true,
      offline: false,
      resolvedUrl: crmUrl,
      summary: res.data?.summary,
    };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return {
        success: false,
        offline: false,
        resolvedUrl: crmUrl,
        error: `Tempo limite esgotado (> ${timeoutMs}ms) aguardando resposta do CRM.`,
      };
    }

    const isConnRefused =
      err.code === 'ECONNREFUSED' ||
      err.cause?.code === 'ECONNREFUSED' ||
      err.message?.includes('fetch failed') ||
      err.message?.includes('ECONNREFUSED');

    // If connection was refused on localhost, attempt auto-discovery of active CRM port
    if (isConnRefused && isLocalhost) {
      let initialPort = 3000;
      try {
        const parsed = Number(new URL(crmUrl).port);
        if (Number.isInteger(parsed) && parsed > 0) initialPort = parsed;
      } catch {}

      const candidatePorts = options.candidatePorts || DEFAULT_CANDIDATE_PORTS;
      const discoveredPort = await discoverActivePort(candidatePorts, initialPort);

      if (discoveredPort) {
        const discoveredUrl = `http://localhost:${discoveredPort}`;
        try {
          const retryRes = await postLeads(discoveredUrl, leads, timeoutMs);
          if (retryRes.ok) {
            return {
              success: true,
              offline: false,
              resolvedUrl: discoveredUrl,
              summary: retryRes.data?.summary,
            };
          }
          return {
            success: false,
            offline: false,
            resolvedUrl: discoveredUrl,
            error: retryRes.errorMsg,
          };
        } catch {}
      }

      return {
        success: false,
        offline: true,
        resolvedUrl: crmUrl,
        error: `Servidor CRM offline (nenhum serviço detectado nas portas ${candidatePorts.join(', ')}).`,
      };
    }

    if (isConnRefused) {
      return {
        success: false,
        offline: true,
        resolvedUrl: crmUrl,
        error: `Servidor CRM offline ou inacessível em ${crmUrl}.`,
      };
    }

    return {
      success: false,
      offline: false,
      resolvedUrl: crmUrl,
      error: err.message || 'Erro desconhecido ao enviar leads para o CRM',
    };
  }
}
