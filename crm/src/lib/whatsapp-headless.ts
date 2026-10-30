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
        if (isCanvasVisible) {
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
      const canvas = this.activePage.locator('canvas').first();
      if (await canvas.isVisible({ timeout: 2000 })) {
        const buffer = await canvas.screenshot();
        this.latestQrCode = `data:image/png;base64,${buffer.toString('base64')}`;
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
          console.log('[WhatsApp Playwright] ✅ Conectado com sucesso ao WhatsApp Web!');
          clearInterval(checkInterval);
          this.isCheckingAuth = false;
          return;
        }

        // Refresh QR Code if still on canvas
        const hasCanvas = await this.activePage.locator('canvas').isVisible({ timeout: 1000 }).catch(() => false);
        if (hasCanvas) {
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
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
        ],
      });
    }

    if (!this.activePage || this.activePage.isClosed()) {
      const pages = this.context.pages();
      this.activePage = pages.length > 0 ? pages[0] : await this.context.newPage();
      await this.activePage.goto('https://web.whatsapp.com', { waitUntil: 'domcontentloaded', timeout: 45000 });
    }

    // Wait for either logged in pane or QR code canvas
    try {
      const result = await Promise.race([
        this.activePage.waitForSelector('div[id="pane-side"]', { timeout: 15000 }).then(() => 'logged_in').catch(() => null),
        this.activePage.waitForSelector('canvas', { timeout: 15000 }).then(() => 'qr_ready').catch(() => null),
      ]);

      if (result === 'logged_in') {
        this.currentStatus = 'connected';
        this.latestQrCode = null;
        return { status: 'connected', qrCode: null };
      }
    } catch (e) {}

    // If canvas found or not yet logged in:
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
    const status = await this.getStatus();
    if (status.status !== 'connected') {
      return { success: false, error: 'WhatsApp não está conectado. Conecte pelo painel de configurações.' };
    }

    if (!this.context || !this.activePage || this.activePage.isClosed()) {
      await this.start();
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

// Active driver instance
let activeDriver: WhatsAppAutomationDriver = new PlaywrightWhatsAppDriver();

export function setAutomationDriver(driver: WhatsAppAutomationDriver) {
  activeDriver = driver;
}

export function resetAutomationDriver() {
  activeDriver = new PlaywrightWhatsAppDriver();
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

  const autoSendEnabled = settingRow?.value === 'true';
  const driverStatus = await activeDriver.getStatus();

  return {
    status: driverStatus.status,
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
  return activeDriver.logout();
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
