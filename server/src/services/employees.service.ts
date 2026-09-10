import bcrypt from 'bcryptjs';
import { Prisma, UserRole } from '@prisma/client';
import prisma from '../prisma/client';
import { AppError } from '../middleware/error.middleware';
import type { PaginationQuery } from '../types';

export class EmployeesService {
  async findAll(query: PaginationQuery & { search?: string; active?: string }) {
    const page = Math.max(1, parseInt(query.page ?? '1'));
    const limit = Math.min(100, parseInt(query.limit ?? '50'));
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};
    if (query.active !== undefined) where.active = query.active === 'true';
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [employees, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        select: { id: true, name: true, email: true, role: true, active: true, createdAt: true, _count: { select: { assignedJobs: true } } },
      }),
      prisma.user.count({ where }),
    ]);

    return { employees, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findById(id: string) {
    const employee = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true, name: true, email: true, role: true, active: true, createdAt: true,
        assignedJobs: { orderBy: { createdAt: 'desc' }, take: 10, include: { customer: true } },
      },
    });
    if (!employee) throw new AppError(404, 'Employee not found');
    return employee;
  }

  async update(id: string, data: Prisma.UserUpdateInput) {
    await this.findById(id);
    return prisma.user.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, role: true, active: true },
    });
  }

  async setActive(id: string, active: boolean) {
    return this.update(id, { active });
  }

  async create(data: { name: string; email: string; password: string; role?: string }) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new AppError(409, 'Email already in use');
    const passwordHash = await bcrypt.hash(data.password, 12);
    return prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash,
        role: (data.role as UserRole) ?? UserRole.EMPLOYEE,
      },
      select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
    });
  }
}

export default new EmployeesService();
