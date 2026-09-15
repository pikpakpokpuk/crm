import { Response, NextFunction } from 'express';
import sheetsService from '../services/sheets.service';
import type { AuthRequest } from '../types';

const VALID_ENTITIES = ['customers', 'employees', 'inventory', 'jobs'];

export class SheetsController {
  async getConfig(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      res.json(await sheetsService.getConfig());
    } catch (err) { next(err); }
  }

  async saveConfig(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { sheetId, serviceAccountJson } = req.body as { sheetId?: string; serviceAccountJson?: string };
      if (!sheetId || !serviceAccountJson) { res.status(400).json({ error: 'sheetId and serviceAccountJson are required' }); return; }
      res.json(await sheetsService.saveConfig(sheetId, serviceAccountJson));
    } catch (err) { next(err); }
  }

  async exportEntity(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const entity = req.params.entity as string;
      if (!VALID_ENTITIES.includes(entity)) { res.status(400).json({ error: 'Unknown entity' }); return; }
      const count = await sheetsService.exportEntity(entity as never);
      res.json({ exported: count });
    } catch (err) { next(err); }
  }

  async importEntity(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const entity = req.params.entity as string;
      if (!VALID_ENTITIES.includes(entity)) { res.status(400).json({ error: 'Unknown entity' }); return; }
      const result = await sheetsService.importEntity(entity as never);
      res.json(result);
    } catch (err) { next(err); }
  }
}

export default new SheetsController();
