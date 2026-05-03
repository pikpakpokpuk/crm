import { Router } from 'express';
import authRoutes from './auth.routes';
import jobsRoutes from './jobs.routes';
import customersRoutes from './customers.routes';
import employeesRoutes from './employees.routes';
import inventoryRoutes from './inventory.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/jobs', jobsRoutes);
router.use('/customers', customersRoutes);
router.use('/employees', employeesRoutes);
router.use('/inventory', inventoryRoutes);

export default router;
