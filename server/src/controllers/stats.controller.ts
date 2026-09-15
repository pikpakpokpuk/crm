import { Response, NextFunction } from 'express';
import statsService from '../services/stats.service';
import type { AuthRequest } from '../types';

export class StatsController {
  async jobs(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { jobType, dateFrom, dateTo, status } = req.query as Record<string, string | undefined>;
      const result = await statsService.getJobsStats({ jobType, dateFrom, dateTo, status });
      res.json(result);
    } catch (err) { next(err); }
  }

  async jobTypes(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      res.json(await statsService.getJobTypes());
    } catch (err) { next(err); }
  }

  async employees(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { dateFrom, dateTo } = req.query as Record<string, string | undefined>;
      res.json(await statsService.getEmployeeStats(dateFrom, dateTo));
    } catch (err) { next(err); }
  }

  async monthly(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { month } = req.query as { month?: string };
      if (!month) { res.status(400).json({ error: 'month (YYYY-MM) is required' }); return; }
      res.json(await statsService.getMonthly(month));
    } catch (err) { next(err); }
  }

  async monthlyRange(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { from, to } = req.query as { from?: string; to?: string };
      if (!from || !to) { res.status(400).json({ error: 'from and to (YYYY-MM) are required' }); return; }
      res.json(await statsService.getMonthlyRange(from, to));
    } catch (err) { next(err); }
  }
}

export default new StatsController();
