import { Router, Response, NextFunction } from 'express';
import companyService from '../services/company.service';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';
import type { AuthRequest } from '../types';

const router = Router();
router.use(authenticate);

router.get('/', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try { res.json(await companyService.get()); } catch (err) { next(err); }
});

router.put('/', requireAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try { res.json(await companyService.save(req.body ?? {})); } catch (err) { next(err); }
});

export default router;
