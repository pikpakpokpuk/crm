import { Client, LocalAuth, Message } from 'whatsapp-web.js';
import qrcode from 'qrcode';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import prisma from '../prisma/client';

export type WAStatus = 'initializing' | 'qr' | 'connected' | 'disconnected';

class WhatsAppService {
  private client: Client | null = null;
  private status: WAStatus = 'disconnected';
  private qrDataUrl: string | null = null;
  private initialized = false;

  private normalizePhone(raw: string): string {
    const digits = raw.replace(/\D/g, '');
    if (digits.startsWith('06')) return '36' + digits.slice(2);
    if (digits.startsWith('0')) return '36' + digits.slice(1);
    return digits;
  }

  async initialize() {
    if (this.initialized) return;
    this.initialized = true;
    this.status = 'initializing';

    const authPath = path.join(__dirname, '../../../whatsapp-auth');

    // Kill any orphaned Chrome/Chromium process using this profile dir
    try {
      execSync(
        `powershell -Command "Get-WmiObject Win32_Process | Where-Object { $_.CommandLine -like '*whatsapp-auth*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"`,
        { stdio: 'ignore', timeout: 8000 }
      );
      // Wait for process to fully exit
      await new Promise((r) => setTimeout(r, 1500));
    } catch { /* ignore on non-Windows or if no process found */ }

    // Delete Chrome lock/crash files left by previous process
    for (const name of ['SingletonLock', 'SingletonSocket', 'DevToolsActivePort']) {
      try { fs.unlinkSync(path.join(authPath, 'session', name)); } catch { /* ignore */ }
    }
    // Delete crash recovery files that cause LifecycleWatcher disposal
    const sessionDir = path.join(authPath, 'session', 'Default', 'Sessions');
    try {
      if (fs.existsSync(sessionDir)) {
        for (const f of fs.readdirSync(sessionDir)) {
          fs.unlinkSync(path.join(sessionDir, f));
        }
      }
    } catch { /* ignore */ }
    const lastTabsDir = path.join(authPath, 'session', 'Default');
    for (const name of ['Last Session', 'Last Tabs', 'Last Browser State']) {
      try { fs.unlinkSync(path.join(lastTabsDir, name)); } catch { /* ignore */ }
    }

    this.client = new Client({
      authStrategy: new LocalAuth({ dataPath: authPath }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--no-first-run',
          '--no-default-browser-check',
          '--disable-restore-session-state',
        ],
      },
    });

    this.client.on('qr', async (qr) => {
      this.status = 'qr';
      try {
        this.qrDataUrl = await qrcode.toDataURL(qr);
      } catch {
        this.qrDataUrl = null;
      }
      console.log('[WhatsApp] QR code ready — scan to connect');
    });

    this.client.on('ready', () => {
      this.status = 'connected';
      this.qrDataUrl = null;
      console.log('[WhatsApp] Connected');
    });

    this.client.on('disconnected', () => {
      this.status = 'disconnected';
      this.qrDataUrl = null;
      console.log('[WhatsApp] Disconnected');
    });

    this.client.on('message', async (msg: Message) => {
      console.log(`[WhatsApp] message event: from=${msg.from} fromMe=${msg.fromMe} body=${msg.body?.slice(0, 40)}`);
      if (msg.fromMe) return;
      // Skip group messages
      if (msg.from.endsWith('@g.us')) return;
      try {
        let rawPhone: string;
        if (msg.from.endsWith('@c.us')) {
          rawPhone = msg.from.replace('@c.us', '');
        } else {
          // LID format — getFormattedNumber() returns the actual phone (e.g. "+45 91843180")
          const contact = await msg.getContact();
          const formatted = await contact.getFormattedNumber().catch(() => '');
          rawPhone = formatted.replace(/\D/g, '') || contact.number || contact.id.user;
        }
        console.log(`[WhatsApp] rawPhone resolved: ${rawPhone}`);
        const fromPhone = this.normalizePhone(rawPhone);
        console.log(`[WhatsApp] Saving incoming from ${fromPhone}`);
        const customer = await prisma.customer.findFirst({
          where: { phone: { contains: fromPhone.slice(-9) } },
          include: { jobs: { orderBy: { createdAt: 'desc' }, take: 1, select: { id: true } } },
        });
        await prisma.whatsAppMessage.create({
          data: {
            jobId: customer?.jobs[0]?.id ?? null,
            customerPhone: fromPhone,
            fromMe: false,
            body: msg.body,
            timestamp: new Date((msg.timestamp as number) * 1000),
            waMessageId: msg.id.id,
          },
        });
      } catch (err) {
        console.error('[WhatsApp] Failed to save incoming message:', err);
      }
    });

    // Capture messages sent from your phone (or any linked device)
    this.client.on('message_create', async (msg: Message) => {
      if (!msg.fromMe) return;
      if ((msg.to ?? '').endsWith('@g.us')) return;
      try {
        // Dedup: CRM-sent messages will already be saved with this waMessageId
        if (msg.id?.id) {
          const exists = await prisma.whatsAppMessage.findUnique({ where: { waMessageId: msg.id.id } });
          if (exists) return;
        }
        const recipient = msg.to ?? '';
        let rawPhone: string;
        if (recipient.endsWith('@c.us')) {
          rawPhone = recipient.replace('@c.us', '');
        } else if (recipient.includes('@')) {
          const contact = await this.client!.getContactById(recipient);
          const formatted = await contact.getFormattedNumber().catch(() => '');
          rawPhone = formatted.replace(/\D/g, '') || contact.number || contact.id.user;
        } else {
          return;
        }
        const toPhone = this.normalizePhone(rawPhone);
        await prisma.whatsAppMessage.create({
          data: {
            customerPhone: toPhone,
            fromMe: true,
            body: msg.body,
            timestamp: new Date((msg.timestamp as number) * 1000),
            waMessageId: msg.id?.id ?? null,
          },
        });
      } catch (err) {
        console.error('[WhatsApp] Failed to save phone-sent message:', err);
      }
    });

    this.client.initialize().catch((err) => {
      console.error('[WhatsApp] Init error:', err);
      this.initialized = false;
      this.client = null;
      if (this.status === 'initializing') {
        // Never got past startup — mark disconnected
        this.status = 'disconnected';
      } else {
        // Had QR or was connected but Chrome crashed — retry in 5s
        console.log('[WhatsApp] Retrying in 5s…');
        setTimeout(() => this.initialize(), 5000);
      }
    });
  }

  getStatus(): WAStatus { return this.status; }
  getQR(): string | null { return this.qrDataUrl; }

  async sendMessage(toPhone: string, body: string, jobId?: string): Promise<void> {
    if (!this.client || this.status !== 'connected') {
      throw new Error('WhatsApp not connected');
    }
    const normalized = this.normalizePhone(toPhone);
    const chatId = `${normalized}@c.us`;
    const sentMsg = await this.client.sendMessage(chatId, body);
    await prisma.whatsAppMessage.create({
      data: {
        jobId: jobId ?? null,
        customerPhone: normalized,
        fromMe: true,
        body,
        timestamp: new Date(),
        waMessageId: (sentMsg as unknown as { id?: { id?: string } }).id?.id ?? null,
      },
    });
  }

  async syncMessages(customerPhone: string): Promise<number> {
    if (!this.client || this.status !== 'connected') return 0;
    const normalized = this.normalizePhone(customerPhone);
    const chatId = `${normalized}@c.us`;
    let saved = 0;
    try {
      const chat = await this.client.getChatById(chatId);
      const messages = await chat.fetchMessages({ limit: 100 });
      for (const msg of messages) {
        if (!msg.body && !msg.hasMedia) continue;
        const waId = msg.id?.id ?? null;
        if (waId) {
          const exists = await prisma.whatsAppMessage.findUnique({ where: { waMessageId: waId } });
          if (exists) continue;
        }
        try {
          await prisma.whatsAppMessage.create({
            data: {
              customerPhone: normalized,
              fromMe: msg.fromMe,
              body: msg.body || '[media]',
              timestamp: new Date((msg.timestamp as number) * 1000),
              waMessageId: waId,
            },
          });
          saved++;
        } catch { /* unique constraint race — skip */ }
      }
    } catch (err) {
      console.error('[WhatsApp] Sync error:', err);
    }
    return saved;
  }

  async getMessages(customerPhone: string) {
    const normalized = this.normalizePhone(customerPhone);
    const last9 = normalized.slice(-9);
    return prisma.whatsAppMessage.findMany({
      where: { customerPhone: { endsWith: last9 } },
      orderBy: { timestamp: 'asc' },
    });
  }

  async logout() {
    if (this.client) {
      await this.client.logout().catch(() => {});
      await this.client.destroy().catch(() => {});
      this.client = null;
    }
    this.status = 'disconnected';
    this.qrDataUrl = null;
    this.initialized = false;
  }

  async destroy() {
    if (this.client) {
      await this.client.destroy().catch(() => {});
      this.client = null;
    }
    this.initialized = false;
  }
}

export const whatsappService = new WhatsAppService();
