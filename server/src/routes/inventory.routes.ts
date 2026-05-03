import { Router } from 'express';
import inventoryController from '../controllers/inventory.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/categories', inventoryController.getCategories.bind(inventoryController));
router.get('/', inventoryController.getAll.bind(inventoryController));
router.post('/', inventoryController.create.bind(inventoryController));
router.get('/:id', inventoryController.getById.bind(inventoryController));
router.put('/:id', inventoryController.update.bind(inventoryController));
router.patch('/:id/stock', inventoryController.adjustStock.bind(inventoryController));
router.delete('/:id', inventoryController.delete.bind(inventoryController));

export default router;
