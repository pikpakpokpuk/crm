import { Router } from 'express';
import customersController from '../controllers/customers.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', customersController.getAll.bind(customersController));
router.post('/', customersController.create.bind(customersController));
router.get('/:id', customersController.getById.bind(customersController));
router.put('/:id', customersController.update.bind(customersController));
router.delete('/:id', customersController.delete.bind(customersController));

export default router;
