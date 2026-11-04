import path from 'path';
import fs from 'fs';
import { getDatabase, initDatabase } from '../db';
import { settings } from '../db/schema';
import { eq } from 'drizzle-orm';
import type { BrowserContext, Page } from 'playwright';

export type WhatsAppSessionStatus = 'disconnected' | 'waiting_qr' | 'connected';

export interface WhatsAppAutomationDriver {
  getStatus(): Promise<{ status: WhatsAppSessionStatus; qrCode?: string | null }>;
  start(): Promise<{ status: WhatsAppSessionStatus; qrCode?: string | null }>;
  logout(): Promise<void>;
  send(phone: string, message: string): Promise<{ success: boolean; error?: string }>;
}

const isCrmDir = path.basename(process.cwd()) === 'crm';
const baseDir = isCrmDir ? process.cwd() : path.join(process.cwd(), 'crm');
const SESSION_DIR = path.join(baseDir, '.whatsapp-session');

export class PlaywrightWhatsAppDriver implements WhatsAppAutomationDriver {
  private context: BrowserContext | null = null;
  private activePage: Page | null = null;
  private currentStatus: WhatsAppSessionStatus = 'disconnected';
  private latestQrCode: string | null = null;
  private isCheckingAuth = false;
  private sendQueue: Promise<any> = Promise.resolve();

  async getStatus(): Promise<{ status: WhatsAppSessionStatus; qrCode?: string | null }> {
    if (this.context && this.activePage && !this.activePage.isClosed()) {
      try {
        const isChatListVisible = await this.activePage.locator('div[id="pane-side"]').isVisible({ timeout: 1000 }).catch(() => false);
        if (isChatListVisible) {
          this.currentStatus = 'connected';
          this.latestQrCode = null;
          return { status: 'connected', qrCode: null };
        }

        const isCanvasVisible = await this.activePage.locator('canvas').isVisible({ timeout: 1000 }).catch(() => false);
        const hasDataRef = await this.activePage.locator('div[data-ref]').isVisible({ timeout: 1000 }).catch(() => false);
        if (isCanvasVisible || hasDataRef) {
          this.currentStatus = 'waiting_qr';
          await this.captureQrCode();
          return { status: 'waiting_qr', qrCode: this.latestQrCode };
        }
      } catch (e) {}
    }

    return { status: this.currentStatus, qrCode: this.latestQrCode };
  }

  private async captureQrCode(): Promise<void> {
    if (!this.activePage || this.activePage.isClosed()) return;
    try {
      // Check if QR code expired and needs refresh click
      const reloadBtn = this.activePage.locator(
        'button:has-text("Recarregar"), button:has-text("Clique para recarregar"), span[data-icon="refresh"], div[data-ref] button, [data-testid="qrcode"] button'
      ).first();
      if (await reloadBtn.isVisible({ timeout: 500 }).catch(() => false)) {
        await reloadBtn.click().catch(() => {});
        await this.activePage.waitForTimeout(1000);
      }

      const canvas = this.activePage.locator('canvas').first();
      if (await canvas.isVisible({ timeout: 2000 }).catch(() => false)) {
        const buffer = await canvas.screenshot();
        this.latestQrCode = `data:image/png;base64,${buffer.toString('base64')}`;
        return;
      }

      const qrContainer = this.activePage.locator('div[data-ref], [data-testid="qrcode"], [data-testid="link-device-qrcode-alt-linking-tc"]').first();
      if (await qrContainer.isVisible({ timeout: 1000 }).catch(() => false)) {
        const buffer = await qrContainer.screenshot();
        this.latestQrCode = `data:image/png;base64,${buffer.toString('base64')}`;
        return;
      }
    } catch (e) {
      console.warn('[WhatsApp Playwright] Falha ao capturar screenshot do QR Code:', e);
    }
  }

  private startLoginWatcher(): void {
    if (this.isCheckingAuth) return;
    this.isCheckingAuth = true;
    let ticks = 0;
    const MAX_TICKS = 100; // ~5 minutes max

    const checkInterval = setInterval(async () => {
      ticks++;
      if (!this.activePage || this.activePage.isClosed() || ticks >= MAX_TICKS) {
        clearInterval(checkInterval);
        this.isCheckingAuth = false;
        if (ticks >= MAX_TICKS && this.currentStatus !== 'connected') {
          this.currentStatus = 'disconnected';
          this.latestQrCode = null;
          console.log('[WhatsApp Playwright] ⏱️ Tempo limite de leitura de QR Code atingido.');
        }
        return;
      }

      try {
        const isLoggedIn = await this.activePage.locator('div[id="pane-side"]').isVisible({ timeout: 1000 }).catch(() => false);
        if (isLoggedIn) {
          this.currentStatus = 'connected';
          this.latestQrCode = null;
          await persistWhatsAppConnectedState(true);
          console.log('[WhatsApp Playwright] ✅ Conectado com sucesso ao WhatsApp Web!');
          clearInterval(checkInterval);
          this.isCheckingAuth = false;
          return;
        }

        // Refresh QR Code if still on canvas or data-ref
        const hasCanvas = await this.activePage.locator('canvas').isVisible({ timeout: 1000 }).catch(() => false);
        const hasDataRef = await this.activePage.locator('div[data-ref]').isVisible({ timeout: 1000 }).catch(() => false);
        if (hasCanvas || hasDataRef) {
          this.currentStatus = 'waiting_qr';
          await this.captureQrCode();
        }
      } catch (e) {
        clearInterval(checkInterval);
        this.isCheckingAuth = false;
      }
    }, 3000);
  }

  async start(): Promise<{ status: WhatsAppSessionStatus; qrCode?: string | null }> {
    const { chromium } = await import('playwright');

    if (!this.context) {
      if (!fs.existsSync(SESSION_DIR)) {
        fs.mkdirSync(SESSION_DIR, { recursive: true });
      }

      this.context = await chromium.launchPersistentContext(SESSION_DIR, {
        headless: true,
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 800 },
        locale: 'pt-BR',
        timezoneId: 'America/Sao_Paulo',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled',
          '--no-first-run',
          '--no-zygote',
        ],
      });

      await this.context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      });
    }

    if (!this.activePage || this.activePage.isClosed()) {
      const pages = this.context.pages();
      this.activePage = pages.length > 0 ? pages[0] : await this.context.newPage();
      await this.activePage.goto('https://web.whatsapp.com', { waitUntil: 'domcontentloaded', timeout: 45000 });
    }

    // Wait up to 25s for either logged-in pane or QR code canvas / data-ref
    const startTime = Date.now();
    const TIMEOUT_MS = 25000;

    while (Date.now() - startTime < TIMEOUT_MS) {
      if (!this.activePage || this.activePage.isClosed()) break;

      // Check if already authenticated
      const isChatListVisible = await this.activePage
        .locator('div[id="pane-side"]')
        .isVisible({ timeout: 500 })
        .catch(() => false);
      if (isChatListVisible) {
        this.currentStatus = 'connected';
        this.latestQrCode = null;
        await persistWhatsAppConnectedState(true);
        return { status: 'connected', qrCode: null };
      }

      // Check if redirected to /login/ splash and shortcut link is available
      if (this.activePage.url().includes('/login/')) {
        const qrShortcut = this.activePage
          .locator('[data-testid="link_device_qr_phone_number_shortcut_link"]')
          .first();
        if (await qrShortcut.isVisible({ timeout: 500 }).catch(() => false)) {
          await qrShortcut.click().catch(() => {});
        }
      }

      // Check for QR code canvas or data-ref container
      const hasCanvas = await this.activePage
        .locator('canvas')
        .isVisible({ timeout: 500 })
        .catch(() => false);
      const hasDataRef = await this.activePage
        .locator('div[data-ref]')
        .isVisible({ timeout: 500 })
        .catch(() => false);

      if (hasCanvas || hasDataRef) {
        await this.captureQrCode();
        if (this.latestQrCode) {
          this.currentStatus = 'waiting_qr';
          this.startLoginWatcher();
          return { status: 'waiting_qr', qrCode: this.latestQrCode };
        }
      }

      await this.activePage.waitForTimeout(1000);
    }

    // Fallback capture
    await this.captureQrCode();
    this.currentStatus = 'waiting_qr';
    this.startLoginWatcher();

    return { status: 'waiting_qr', qrCode: this.latestQrCode };
  }

  async logout(): Promise<void> {
    if (this.context) {
      try {
        await this.context.close();
      } catch (e) {}
      this.context = null;
      this.activePage = null;
    }
    this.currentStatus = 'disconnected';
    this.latestQrCode = null;

    try {
      if (fs.existsSync(SESSION_DIR)) {
        fs.rmSync(SESSION_DIR, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
      }
    } catch (e) {
      console.warn('[WhatsApp Playwright] Aviso ao remover diretório de sessão:', e);
    }
  }

  async send(phone: string, message: string): Promise<{ success: boolean; error?: string }> {
    // Sequential mutex queue to prevent parallel tabs conflicting on the same WhatsApp session
    return new Promise<{ success: boolean; error?: string }>((resolve) => {
      this.sendQueue = this.sendQueue
        .then(async () => {
          const res = await this.executeSend(phone, message);
          resolve(res);
        })
        .catch((err) => {
          resolve({ success: false, error: err.message || 'Erro na fila de envio do WhatsApp' });
        });
    });
  }

  private async executeSend(phone: string, message: string): Promise<{ success: boolean; error?: string }> {
    // 1. Lazy initialize: if context or page is not open, launch/attach using persistent session
    if (!this.context || !this.activePage || this.activePage.isClosed()) {
      await initDatabase();
      const { db } = getDatabase();
      const [connRow] = await db
        .select()
        .from(settings)
        .where(eq(settings.key, 'whatsapp_session_connected'));

      const isConfiguredConnected = connRow?.value === 'true' || this.currentStatus === 'connected';

      if (!isConfiguredConnected || !fs.existsSync(SESSION_DIR)) {
        return { success: false, error: 'WhatsApp não está conectado. Conecte pelo painel de configurações.' };
      }
      await this.start();
    }

    const status = await this.getStatus();
    if (status.status !== 'connected') {
      return { success: false, error: 'WhatsApp não está conectado. Conecte pelo painel de configurações.' };
    }

    if (!this.context || !this.activePage) {
      return { success: false, error: 'Não foi possível iniciar o navegador do WhatsApp.' };
    }

    const cleanDigits = phone.replace(/\D/g, '');
    const targetPhone = cleanDigits.length <= 11 && !cleanDigits.startsWith('55')
      ? `55${cleanDigits}`
      : cleanDigits;

    // Reuse the single active page to prevent WhatsApp "Use here" multi-tab conflict
    const page = this.activePage;
    const encodedText = encodeURIComponent(message);
    const targetUrl = `https://web.whatsapp.com/send?phone=${targetPhone}&text=${encodedText}`;

    try {
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });

      // Check for send button or invalid number popup with catch to prevent unhandled rejection
      const sendButtonSelector = 'button[data-testid="compose-btn-send"], button[aria-label="Enviar"], span[data-icon="send"]';
      const errorPopupSelector = 'div[data-testid="popup-contents"], div[data-animate-modal-popup="true"]';

      const detected = await Promise.race([
        page.waitForSelector(sendButtonSelector, { timeout: 25000 }).then(() => 'send_btn').catch(() => null),
        page.waitForSelector(errorPopupSelector, { timeout: 25000 }).then(() => 'invalid_number').catch(() => null),
      ]);

      if (detected === 'invalid_number') {
        return { success: false, error: 'O número de telefone não possui conta no WhatsApp.' };
      }

      if (!detected || detected !== 'send_btn') {
        // Fallback: try pressing Enter on active element
        await page.keyboard.press('Enter');
      } else {
        const sendBtn = page.locator(sendButtonSelector).first();
        if (await sendBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await sendBtn.click();
        } else {
          await page.keyboard.press('Enter');
        }
      }

      // Small pause to allow websocket transmission
      await page.waitForTimeout(2000);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Tempo limite excedido ao tentar enviar a mensagem.' };
    }
  }
}

export async function persistWhatsAppConnectedState(connected: boolean): Promise<void> {
  try {
    await initDatabase();
    const { db } = getDatabase();
    const now = new Date().toISOString();
    await db
      .insert(settings)
      .values({
        key: 'whatsapp_session_connected',
        value: connected ? 'true' : 'false',
        updated_at: now,
      })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: connected ? 'true' : 'false', updated_at: now },
      });

    if (connected) {
      await db
        .insert(settings)
        .values({
          key: 'auto_send_whatsapp',
          value: 'true',
          updated_at: now,
        })
        .onConflictDoUpdate({
          target: settings.key,
          set: { value: 'true', updated_at: now },
        });
    }
  } catch (e) {
    console.warn('[WhatsApp Playwright] Erro ao persistir estado no SQLite:', e);
  }
}

// Active driver singleton on globalThis to survive Next.js module reloads
const globalForWhatsApp = globalThis as unknown as {
  whatsappDriver?: WhatsAppAutomationDriver;
};

export let activeDriver: WhatsAppAutomationDriver =
  globalForWhatsApp.whatsappDriver ?? new PlaywrightWhatsAppDriver();
globalForWhatsApp.whatsappDriver = activeDriver;

export function setAutomationDriver(driver: WhatsAppAutomationDriver) {
  activeDriver = driver;
  globalForWhatsApp.whatsappDriver = driver;
}

export function resetAutomationDriver() {
  activeDriver = new PlaywrightWhatsAppDriver();
  globalForWhatsApp.whatsappDriver = activeDriver;
}

export async function getWhatsAppSessionStatus(): Promise<{
  status: WhatsAppSessionStatus;
  qrCode?: string | null;
  autoSendEnabled: boolean;
}> {
  await initDatabase();
  const { db } = getDatabase();

  const [settingRow] = await db
    .select()
    .from(settings)
    .where(eq(settings.key, 'auto_send_whatsapp'));

  const [connRow] = await db
    .select()
    .from(settings)
    .where(eq(settings.key, 'whatsapp_session_connected'));

  const autoSendEnabled = settingRow?.value === 'true';
  const dbConnected = connRow?.value === 'true';
  const driverStatus = await activeDriver.getStatus();

  // If driver in memory says disconnected but DB shows connected, report connected
  const effectiveStatus: WhatsAppSessionStatus =
    driverStatus.status === 'connected' || (driverStatus.status === 'disconnected' && dbConnected)
      ? 'connected'
      : driverStatus.status;

  return {
    status: effectiveStatus,
    qrCode: driverStatus.qrCode,
    autoSendEnabled,
  };
}

export async function startWhatsAppSession(): Promise<{
  status: WhatsAppSessionStatus;
  qrCode?: string | null;
}> {
  return activeDriver.start();
}

export async function logoutWhatsAppSession(): Promise<void> {
  await activeDriver.logout();
  await persistWhatsAppConnectedState(false);
}

export async function sendHeadlessMessage(
  phone: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  return activeDriver.send(phone, message);
}

export async function isAutoSendEligible(): Promise<boolean> {
  const current = await getWhatsAppSessionStatus();
  return current.autoSendEnabled && current.status === 'connected';
}
