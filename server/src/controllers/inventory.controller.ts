import { Response, NextFunction } from 'express';
import inventoryService from '../services/inventory.service';
import type { AuthRequest } from '../types';

export class InventoryController {
  async getAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await inventoryService.findAll(req.query as never);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async getById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const item = await inventoryService.findById(req.params.id as string);
      res.json(item);
    } catch (err) {
      next(err);
    }
  }

  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const item = await inventoryService.create(req.body);
      res.status(201).json(item);
    } catch (err) {
      next(err);
    }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const item = await inventoryService.update(req.params.id as string, req.body);
      res.json(item);
    } catch (err) {
      next(err);
    }
  }

  async adjustStock(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { delta } = req.body;
      const item = await inventoryService.adjustStock(req.params.id as string, delta);
      res.json(item);
    } catch (err) {
      next(err);
    }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await inventoryService.delete(req.params.id as string);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }

  async getCategories(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const categories = await inventoryService.getCategories();
      res.json(categories);
    } catch (err) {
      next(err);
    }
  }
}

export default new InventoryController();
