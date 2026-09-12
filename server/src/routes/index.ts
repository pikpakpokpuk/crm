import { Router } from 'express';
import authRoutes from './auth.routes';
import jobsRoutes from './jobs.routes';
import customersRoutes from './customers.routes';
import employeesRoutes from './employees.routes';
import inventoryRoutes from './inventory.routes';
import documentRoutes from './document.routes';
import whatsappRoutes from './whatsapp.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/jobs', jobsRoutes);
router.use('/customers', customersRoutes);
router.use('/employees', employeesRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/documents', documentRoutes);
router.use('/whatsapp', whatsappRoutes);

export default router;
