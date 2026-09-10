import { Router } from 'express';
import employeesController from '../controllers/employees.controller';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', employeesController.getAll.bind(employeesController));
router.post('/', requireAdmin, employeesController.create.bind(employeesController));
router.get('/:id', employeesController.getById.bind(employeesController));
router.put('/:id', requireAdmin, employeesController.update.bind(employeesController));
router.patch('/:id/active', requireAdmin, employeesController.setActive.bind(employeesController));

export default router;
