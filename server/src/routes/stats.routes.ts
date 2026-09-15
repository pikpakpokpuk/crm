import { Router } from 'express';
import statsController from '../controllers/stats.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.get('/jobs', statsController.jobs.bind(statsController));
router.get('/job-types', statsController.jobTypes.bind(statsController));
router.get('/employees', statsController.employees.bind(statsController));
router.get('/monthly', statsController.monthly.bind(statsController));
router.get('/monthly-range', statsController.monthlyRange.bind(statsController));

export default router;
