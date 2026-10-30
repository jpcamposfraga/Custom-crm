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

const baseDir = process.cwd().endsWith('crm') ? process.cwd() : path.join(process.cwd(), 'crm');
const SESSION_DIR = path.join(baseDir, '.whatsapp-session');

class PlaywrightWhatsAppDriver implements WhatsAppAutomationDriver {
  private context: BrowserContext | null = null;
  private activePage: Page | null = null;
  private currentStatus: WhatsAppSessionStatus = 'disconnected';
  private latestQrCode: string | null = null;
  private isCheckingAuth = false;

  async getStatus(): Promise<{ status: WhatsAppSessionStatus; qrCode?: string | null }> {
    if (this.context && this.activePage) {
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

    // If context is not in memory but session files exist on disk, probe silently
    if (!this.context && fs.existsSync(SESSION_DIR)) {
      try {
        const files = fs.readdirSync(SESSION_DIR);
        if (files.length > 0) {
          return { status: this.currentStatus, qrCode: this.latestQrCode };
        }
      } catch (e) {}
    }

    return { status: this.currentStatus, qrCode: this.latestQrCode };
  }

  private async captureQrCode(): Promise<void> {
    if (!this.activePage) return;
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

    const checkInterval = setInterval(async () => {
      if (!this.activePage || this.activePage.isClosed()) {
        clearInterval(checkInterval);
        this.isCheckingAuth = false;
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
        this.activePage.waitForSelector('div[id="pane-side"]', { timeout: 15000 }).then(() => 'logged_in'),
        this.activePage.waitForSelector('canvas', { timeout: 15000 }).then(() => 'qr_ready'),
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
        fs.rmSync(SESSION_DIR, { recursive: true, force: true });
      }
    } catch (e) {
      console.warn('[WhatsApp Playwright] Aviso ao remover diretório de sessão:', e);
    }
  }

  async send(phone: string, message: string): Promise<{ success: boolean; error?: string }> {
    const status = await this.getStatus();
    if (status.status !== 'connected') {
      return { success: false, error: 'WhatsApp não está conectado. Conecte pelo painel de configurações.' };
    }

    if (!this.context) {
      await this.start();
    }

    if (!this.context) {
      return { success: false, error: 'Não foi possível iniciar o navegador do WhatsApp.' };
    }

    const cleanDigits = phone.replace(/\D/g, '');
    const targetPhone = cleanDigits.length <= 11 && !cleanDigits.startsWith('55')
      ? `55${cleanDigits}`
      : cleanDigits;

    const page = await this.context.newPage();
    const encodedText = encodeURIComponent(message);
    const targetUrl = `https://web.whatsapp.com/send?phone=${targetPhone}&text=${encodedText}`;

    try {
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });

      // Check for send button or invalid number popup
      const sendButtonSelector = 'button[data-testid="compose-btn-send"], button[aria-label="Enviar"], span[data-icon="send"]';
      const errorPopupSelector = 'div[data-testid="popup-contents"], div[data-animate-modal-popup="true"]';

      const detected = await Promise.race([
        page.waitForSelector(sendButtonSelector, { timeout: 25000 }).then(() => 'send_btn'),
        page.waitForSelector(errorPopupSelector, { timeout: 25000 }).then(() => 'invalid_number'),
      ]);

      if (detected === 'invalid_number') {
        await page.close();
        return { success: false, error: 'O número de telefone não possui conta no WhatsApp.' };
      }

      // Click send button
      const sendBtn = page.locator(sendButtonSelector).first();
      await sendBtn.click();

      // Small pause to allow websocket transmission
      await page.waitForTimeout(2000);
      await page.close();
      return { success: true };
    } catch (err: any) {
      await page.close().catch(() => {});
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
