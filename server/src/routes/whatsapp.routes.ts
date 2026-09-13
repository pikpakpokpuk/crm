import { Router } from 'express';
import waController from '../controllers/whatsapp.controller';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.get('/status', waController.status.bind(waController));
router.post('/send', waController.send.bind(waController));
router.get('/messages', waController.messages.bind(waController));
router.get('/sync', waController.sync.bind(waController));
router.delete('/session', requireAdmin, waController.logout.bind(waController));

export default router;
