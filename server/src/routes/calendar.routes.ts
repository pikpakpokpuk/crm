import { Router } from 'express';
import calendarController from '../controllers/calendar.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.get('/events', calendarController.getEvents.bind(calendarController));
router.post('/events', calendarController.createEvent.bind(calendarController));
router.put('/events/:id', calendarController.updateEvent.bind(calendarController));
router.delete('/events/:id', calendarController.deleteEvent.bind(calendarController));

export default router;
