import { Response, NextFunction } from 'express';
import employeesService from '../services/employees.service';
import type { AuthRequest } from '../types';

export class EmployeesController {
  async getAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await employeesService.findAll(req.query as never);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async getById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const employee = await employeesService.findById(req.params.id as string);
      res.json(employee);
    } catch (err) {
      next(err);
    }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const employee = await employeesService.update(req.params.id as string, req.body);
      res.json(employee);
    } catch (err) {
      next(err);
    }
  }

  async setActive(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { active } = req.body;
      const employee = await employeesService.setActive(req.params.id as string, active);
      res.json(employee);
    } catch (err) {
      next(err);
    }
  }
}

export default new EmployeesController();
