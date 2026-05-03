import { Response, NextFunction } from 'express';
import customersService from '../services/customers.service';
import type { AuthRequest } from '../types';

export class CustomersController {
  async getAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await customersService.findAll(req.query as never);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async getById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const customer = await customersService.findById(req.params.id as string);
      res.json(customer);
    } catch (err) {
      next(err);
    }
  }

  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const customer = await customersService.create(req.body);
      res.status(201).json(customer);
    } catch (err) {
      next(err);
    }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const customer = await customersService.update(req.params.id as string, req.body);
      res.json(customer);
    } catch (err) {
      next(err);
    }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await customersService.delete(req.params.id as string);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
}

export default new CustomersController();
