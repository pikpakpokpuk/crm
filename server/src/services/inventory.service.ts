import { Prisma } from '@prisma/client';
import prisma from '../prisma/client';
import { AppError } from '../middleware/error.middleware';
import type { PaginationQuery } from '../types';

export class InventoryService {
  async findAll(query: PaginationQuery & { search?: string; category?: string; lowStock?: string }) {
    const page = Math.max(1, parseInt(query.page ?? '1'));
    const limit = Math.min(100, parseInt(query.limit ?? '50'));
    const skip = (page - 1) * limit;

    const where: Prisma.InventoryItemWhereInput = {};
    if (query.category) where.category = query.category;
    if (query.lowStock === 'true') where.AND = [{ minStock: { not: null } }, { quantity: { lte: prisma.inventoryItem.fields.minStock as unknown as number } }];
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { sku: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await prisma.$transaction([
      prisma.inventoryItem.findMany({ where, skip, take: limit, orderBy: { name: 'asc' } }),
      prisma.inventoryItem.count({ where }),
    ]);

    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findById(id: string) {
    const item = await prisma.inventoryItem.findUnique({ where: { id } });
    if (!item) throw new AppError(404, 'Item not found');
    return item;
  }

  async create(data: Prisma.InventoryItemCreateInput) {
    return prisma.inventoryItem.create({ data });
  }

  async update(id: string, data: Prisma.InventoryItemUpdateInput) {
    await this.findById(id);
    return prisma.inventoryItem.update({ where: { id }, data });
  }

  async adjustStock(id: string, delta: number) {
    const item = await this.findById(id);
    if (item.quantity + delta < 0) throw new AppError(400, 'Insufficient stock');
    return prisma.inventoryItem.update({ where: { id }, data: { quantity: { increment: delta } } });
  }

  async delete(id: string) {
    await this.findById(id);
    await prisma.inventoryItem.delete({ where: { id } });
  }

  async getCategories() {
    const result = await prisma.inventoryItem.findMany({
      select: { category: true },
      distinct: ['category'],
      where: { category: { not: null } },
    });
    return result.map((r) => r.category).filter(Boolean);
  }
}

export default new InventoryService();
