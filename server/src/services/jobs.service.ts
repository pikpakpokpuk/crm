import { JobStatus, Priority, Prisma } from '@prisma/client';
import prisma from '../prisma/client';
import { AppError } from '../middleware/error.middleware';
import type { JobsQuery } from '../types';

const JOB_INCLUDE = {
  customer: true,
  vehicle: true,
  assignedTo: { select: { id: true, name: true, email: true } },
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.JobInclude;

export class JobsService {
  async findAll(query: JobsQuery) {
    const page = Math.max(1, parseInt(query.page ?? '1'));
    const limit = Math.min(100, parseInt(query.limit ?? '20'));
    const skip = (page - 1) * limit;

    const where: Prisma.JobWhereInput = {};
    if (query.status) where.status = query.status as JobStatus;
    if (query.priority) where.priority = query.priority as Priority;
    if (query.customerId) where.customerId = query.customerId;
    if (query.assignedToId) where.assignedToId = query.assignedToId;
    if (query.search) {
      where.OR = [
        { description: { contains: query.search, mode: 'insensitive' } },
        { customer: { name: { contains: query.search, mode: 'insensitive' } } },
        { vehicle: { plate: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const [jobs, total] = await prisma.$transaction([
      prisma.job.findMany({ where, skip, take: limit, include: JOB_INCLUDE, orderBy: { createdAt: 'desc' } }),
      prisma.job.count({ where }),
    ]);

    return { jobs, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findById(id: string) {
    const job = await prisma.job.findUnique({
      where: { id },
      include: { ...JOB_INCLUDE, statusHistory: { orderBy: { changedAt: 'desc' } }, inventoryUsage: { include: { item: true } } },
    });
    if (!job) throw new AppError(404, 'Job not found');
    return job;
  }

  async create(data: Prisma.JobUncheckedCreateInput) {
    return prisma.job.create({ data, include: JOB_INCLUDE });
  }

  async update(id: string, data: Prisma.JobUncheckedUpdateInput) {
    await this.findById(id);
    return prisma.job.update({ where: { id }, data, include: JOB_INCLUDE });
  }

  async updateStatus(id: string, status: JobStatus, userId: string, note?: string) {
    await this.findById(id);
    const [job] = await prisma.$transaction([
      prisma.job.update({
        where: { id },
        data: {
          status,
          completedAt: status === 'DELIVERED' ? new Date() : undefined,
        },
        include: JOB_INCLUDE,
      }),
      prisma.jobStatusHistory.create({ data: { jobId: id, status, changedBy: userId, note } }),
    ]);
    return job;
  }

  async delete(id: string) {
    await this.findById(id);
    await prisma.job.delete({ where: { id } });
  }
}

export default new JobsService();
