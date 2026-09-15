import { Router } from 'express';
import sheetsController from '../controllers/sheets.controller';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate, requireAdmin);

router.get('/config', sheetsController.getConfig.bind(sheetsController));
router.put('/config', sheetsController.saveConfig.bind(sheetsController));
router.post('/export/:entity', sheetsController.exportEntity.bind(sheetsController));
router.post('/import/:entity', sheetsController.importEntity.bind(sheetsController));

export default router;
