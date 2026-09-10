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

  async create(body: Record<string, unknown>) {
    return prisma.inventoryItem.create({
      data: {
        name: body.name as string,
        category: body.category as string ?? null,
        quantity: Number(body.quantity) || 0,
        unit: (body.unit as string) || 'piece',
        unitPrice: new Prisma.Decimal(String(body.unitPrice ?? body.unit_price ?? 0)),
        sku: (body.sku as string) || null,
        notes: (body.notes as string) || null,
        minStock: body.minStock != null ? Number(body.minStock) : null,
      },
    });
  }

  async update(id: string, body: Record<string, unknown>) {
    await this.findById(id);
    const data: Prisma.InventoryItemUpdateInput = {};
    if (body.name !== undefined) data.name = body.name as string;
    if (body.category !== undefined) data.category = body.category as string;
    if (body.quantity !== undefined) data.quantity = Number(body.quantity);
    if (body.unit !== undefined) data.unit = body.unit as string;
    if (body.unitPrice !== undefined) data.unitPrice = new Prisma.Decimal(String(body.unitPrice));
    if (body.unit_price !== undefined) data.unitPrice = new Prisma.Decimal(String(body.unit_price));
    if (body.sku !== undefined) data.sku = body.sku as string;
    if (body.notes !== undefined) data.notes = body.notes as string;
    if (body.minStock !== undefined) data.minStock = Number(body.minStock);
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
