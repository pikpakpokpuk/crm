import { Response, NextFunction } from 'express';
import jobsService from '../services/jobs.service';
import type { AuthRequest, JobsQuery } from '../types';

export class JobsController {
  async getAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await jobsService.findAll(req.query as JobsQuery);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async getById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const job = await jobsService.findById(req.params.id as string);
      res.json(job);
    } catch (err) {
      next(err);
    }
  }

  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const job = await jobsService.create({ ...req.body, createdById: req.user!.id });
      res.status(201).json(job);
    } catch (err) {
      next(err);
    }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const job = await jobsService.update(req.params.id as string, req.body);
      res.json(job);
    } catch (err) {
      next(err);
    }
  }

  async updateStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { status, note } = req.body;
      const job = await jobsService.updateStatus(req.params.id as string, status, req.user!.id, note);
      res.json(job);
    } catch (err) {
      next(err);
    }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await jobsService.delete(req.params.id as string);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }

  async getLineItems(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const items = await jobsService.getLineItems(req.params.id as string);
      res.json(items);
    } catch (err) {
      next(err);
    }
  }

  async updateLineItems(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const items = await jobsService.updateLineItems(req.params.id as string, req.body.items ?? []);
      res.json(items);
    } catch (err) {
      next(err);
    }
  }
}

export default new JobsController();
