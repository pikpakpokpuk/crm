import { Router } from 'express';
import jobsController from '../controllers/jobs.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', jobsController.getAll.bind(jobsController));
router.post('/', jobsController.create.bind(jobsController));
router.get('/:id/items', jobsController.getLineItems.bind(jobsController));
router.put('/:id/items', jobsController.updateLineItems.bind(jobsController));
router.get('/:id/activity', jobsController.getActivity.bind(jobsController));
router.get('/:id', jobsController.getById.bind(jobsController));
router.put('/:id', jobsController.update.bind(jobsController));
router.patch('/:id/status', jobsController.updateStatus.bind(jobsController));
router.delete('/:id', jobsController.delete.bind(jobsController));

export default router;
