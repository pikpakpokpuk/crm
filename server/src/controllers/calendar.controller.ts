import { Response, NextFunction } from 'express';
import calendarService from '../services/calendar.service';
import type { AuthRequest } from '../types';

export class CalendarController {
  async getEvents(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { start, end, userIds } = req.query as { start?: string; end?: string; userIds?: string };
      if (!start || !end) { res.status(400).json({ error: 'start and end are required' }); return; }
      const ids = userIds ? userIds.split(',').filter(Boolean) : undefined;
      const events = await calendarService.getEvents(new Date(start), new Date(end), ids);
      res.json(events);
    } catch (err) { next(err); }
  }

  async createEvent(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const event = await calendarService.createEvent(req.body, req.user!.id);
      res.status(201).json(event);
    } catch (err) { next(err); }
  }

  async updateEvent(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const event = await calendarService.updateEvent(req.params.id as string, req.body);
      res.json(event);
    } catch (err) { next(err); }
  }

  async deleteEvent(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await calendarService.deleteEvent(req.params.id as string, req.user!.id, req.user!.role === 'ADMIN');
      res.status(204).send();
    } catch (err) { next(err); }
  }
}

export default new CalendarController();
