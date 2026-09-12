import { Response, NextFunction } from 'express';
import { whatsappService } from '../services/whatsapp.service';
import type { AuthRequest } from '../types';

export class WhatsAppController {
  status(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      res.json({ status: whatsappService.getStatus(), qr: whatsappService.getQR() });
    } catch (err) { next(err); }
  }

  async send(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { phone, body, jobId } = req.body as { phone: string; body: string; jobId?: string };
      if (!phone || !body) { res.status(400).json({ error: 'phone and body required' }); return; }
      await whatsappService.sendMessage(phone, body, jobId);
      res.json({ ok: true });
    } catch (err) { next(err); }
  }

  async messages(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { phone } = req.query as { phone: string };
      if (!phone) { res.status(400).json({ error: 'phone required' }); return; }
      const msgs = await whatsappService.getMessages(phone);
      res.json(msgs);
    } catch (err) { next(err); }
  }

  async sync(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { phone } = req.query as { phone: string };
      if (!phone) { res.status(400).json({ error: 'phone required' }); return; }
      const saved = await whatsappService.syncMessages(phone);
      res.json({ saved });
    } catch (err) { next(err); }
  }

  async logout(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await whatsappService.logout();
      res.json({ ok: true });
    } catch (err) { next(err); }
  }
}

export default new WhatsAppController();
