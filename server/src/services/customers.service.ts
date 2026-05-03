import { Prisma } from '@prisma/client';
import prisma from '../prisma/client';
import { AppError } from '../middleware/error.middleware';
import type { PaginationQuery } from '../types';

export class CustomersService {
  async findAll(query: PaginationQuery & { search?: string }) {
    const page = Math.max(1, parseInt(query.page ?? '1'));
    const limit = Math.min(100, parseInt(query.limit ?? '20'));
    const skip = (page - 1) * limit;

    const where: Prisma.CustomerWhereInput = {};
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search } },
      ];
    }

    const [customers, total] = await prisma.$transaction([
      prisma.customer.findMany({ where, skip, take: limit, orderBy: { name: 'asc' }, include: { vehicles: true, _count: { select: { jobs: true } } } }),
      prisma.customer.count({ where }),
    ]);

    return { customers, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findById(id: string) {
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: { vehicles: true, jobs: { orderBy: { createdAt: 'desc' }, take: 10 } },
    });
    if (!customer) throw new AppError(404, 'Customer not found');
    return customer;
  }

  async create(data: Prisma.CustomerCreateInput) {
    return prisma.customer.create({ data });
  }

  async update(id: string, data: Prisma.CustomerUpdateInput) {
    await this.findById(id);
    return prisma.customer.update({ where: { id }, data });
  }

  async delete(id: string) {
    await this.findById(id);
    await prisma.customer.delete({ where: { id } });
  }
}

export default new CustomersService();
