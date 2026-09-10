import { JobStatus, Priority, Prisma } from '@prisma/client';
import prisma from '../prisma/client';
import { AppError } from '../middleware/error.middleware';
import type { JobsQuery } from '../types';

const JOB_INCLUDE = {
  customer: true,
  vehicle: true,
  assignedTo: { select: { id: true, name: true, email: true } },
  createdBy: { select: { id: true, name: true } },
  lineItems: { orderBy: { sortOrder: 'asc' as const } },
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

  private sanitize(data: Record<string, unknown>) {
    return {
      ...data,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt as string) : null,
      completedAt: data.completedAt ? new Date(data.completedAt as string) : undefined,
      estimatedPrice: data.estimatedPrice != null && data.estimatedPrice !== '' ? new Prisma.Decimal(String(data.estimatedPrice)) : null,
      finalPrice: data.finalPrice != null && data.finalPrice !== '' ? new Prisma.Decimal(String(data.finalPrice)) : null,
    };
  }

  async create(data: Record<string, unknown>) {
    return prisma.job.create({ data: this.sanitize(data) as Prisma.JobUncheckedCreateInput, include: JOB_INCLUDE });
  }

  async update(id: string, data: Record<string, unknown>) {
    await this.findById(id);
    return prisma.job.update({ where: { id }, data: this.sanitize(data) as Prisma.JobUncheckedUpdateInput, include: JOB_INCLUDE });
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

  async getLineItems(jobId: string) {
    await this.findById(jobId);
    return prisma.jobLineItem.findMany({ where: { jobId }, orderBy: { sortOrder: 'asc' } });
  }

  async updateLineItems(jobId: string, items: Array<{ name: string; type: string; qty: number; unit: string; unitPrice: number; vatPct: number }>) {
    await this.findById(jobId);
    await prisma.jobLineItem.deleteMany({ where: { jobId } });
    if (items.length > 0) {
      await prisma.jobLineItem.createMany({
        data: items.map((item, i) => ({
          jobId,
          sortOrder: i,
          name: item.name,
          type: item.type || 'service',
          qty: new Prisma.Decimal(String(item.qty ?? 1)),
          unit: item.unit || 'hr',
          unitPrice: new Prisma.Decimal(String(item.unitPrice ?? 0)),
          vatPct: new Prisma.Decimal(String(item.vatPct ?? 27)),
        })),
      });
    }
    return prisma.jobLineItem.findMany({ where: { jobId }, orderBy: { sortOrder: 'asc' } });
  }
}

export default new JobsService();
