import { JobStatus, Priority, Prisma } from '@prisma/client';
import prisma from '../prisma/client';
import { AppError } from '../middleware/error.middleware';
import { logActivity } from './activity.service';
import type { JobsQuery } from '../types';

const JOB_INCLUDE = {
  customer: true,
  assignedTo: { select: { id: true, name: true, email: true } },
  createdBy: { select: { id: true, name: true } },
  lineItems: { orderBy: { sortOrder: 'asc' as const } },
  crew: { include: { user: { select: { id: true, name: true, calendarColor: true } } } },
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
        { vehiclePlate: { contains: query.search, mode: 'insensitive' } },
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
    const { crew: _crew, version: _version, newCustomer: _newCustomer, ...rest } = data;
    return {
      ...rest,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt as string) : null,
      scheduledStart: data.scheduledStart ? new Date(data.scheduledStart as string) : null,
      scheduledEnd: data.scheduledEnd ? new Date(data.scheduledEnd as string) : null,
      completedAt: data.completedAt ? new Date(data.completedAt as string) : undefined,
      estimatedPrice: data.estimatedPrice != null && data.estimatedPrice !== '' ? new Prisma.Decimal(String(data.estimatedPrice)) : null,
      finalPrice: data.finalPrice != null && data.finalPrice !== '' ? new Prisma.Decimal(String(data.finalPrice)) : null,
      vehicleYear: data.vehicleYear != null && data.vehicleYear !== '' ? parseInt(String(data.vehicleYear)) : null,
    };
  }

  private async syncCrew(jobId: string, crew?: unknown) {
    if (!Array.isArray(crew)) return;
    const rows = (crew as Array<{ userId?: unknown; hours?: unknown }>)
      .filter((c) => typeof c === 'object' && c !== null && typeof c.userId === 'string')
      .map((c) => ({ userId: c.userId as string, hours: c.hours }));
    await prisma.$transaction([
      prisma.jobEmployee.deleteMany({ where: { jobId } }),
      ...(rows.length > 0
        ? [prisma.jobEmployee.createMany({
            data: rows.map((r) => ({
              jobId,
              userId: r.userId,
              hours: r.hours != null && r.hours !== '' ? new Prisma.Decimal(String(r.hours)) : null,
            })),
          })]
        : []),
    ]);
  }

  // Resolves which customer a new job belongs to: an existing one (customerId), or a
  // brand-new one created from just a name. Runs inside the job-creation transaction.
  private async resolveCustomer(tx: Prisma.TransactionClient, data: Record<string, unknown>) {
    if (typeof data.customerId === 'string' && data.customerId) {
      const existing = await tx.customer.findUnique({ where: { id: data.customerId }, select: { id: true } });
      if (!existing) throw new AppError(400, 'Selected customer no longer exists');
      return { id: existing.id, created: false as const, name: '' };
    }

    const nc = data.newCustomer as { name?: unknown; phone?: unknown } | undefined;
    const name = typeof nc?.name === 'string' ? nc.name.trim().slice(0, 200) : '';
    const phone = typeof nc?.phone === 'string' ? nc.phone.trim().slice(0, 50) : '';
    if (!name) throw new AppError(400, 'Choose a customer, or type a name to create a new one');

    // Guard against silently duplicating someone who already exists. Two different
    // people can share a name, so a different phone number is enough to allow it.
    const digits = (p: string) => p.replace(/\D/g, '').slice(-9);
    const sameName = await tx.customer.findMany({ where: { name: { equals: name, mode: 'insensitive' } }, select: { phone: true } });
    const clashes = sameName.filter((c) => !phone || !c.phone || digits(c.phone) === digits(phone));
    if (clashes.length > 0) {
      // Without a phone on file we can't tell two people apart, so entering a phone can't resolve it.
      const noPhoneOnFile = clashes.every((c) => !c.phone);
      throw new AppError(409, noPhoneOnFile
        ? `A customer named "${name}" already exists (no phone number on file). Pick them from the list, or make the name distinct (e.g. "${name} (Győr)") to create a separate customer.`
        : `A customer named "${name}" already exists. Pick them from the list, or enter a different phone number to create a separate customer.`);
    }

    const created = await tx.customer.create({ data: { name, phone } });
    return { id: created.id, created: true as const, name };
  }

  async create(data: Record<string, unknown>) {
    const { job, customer } = await prisma.$transaction(async (tx) => {
      const customer = await this.resolveCustomer(tx, data);
      const job = await tx.job.create({
        data: { ...(this.sanitize(data) as Prisma.JobUncheckedCreateInput), customerId: customer.id },
        include: JOB_INCLUDE,
      });
      return { job, customer };
    });
    await this.syncCrew(job.id, data.crew);
    await logActivity(
      job.id,
      (data.createdById as string) ?? null,
      'JOB_CREATED',
      customer.created ? `Job created (new customer "${customer.name}")` : 'Job created',
    );
    return this.findById(job.id);
  }

  async update(id: string, data: Record<string, unknown>, userId?: string) {
    const current = await this.findById(id);
    if (data.version !== undefined && Number(data.version) !== current.version) {
      throw new AppError(409, 'This job was changed by someone else since you loaded it. Reload the page and try again.');
    }
    const job = await prisma.job.update({
      where: { id },
      data: { ...(this.sanitize(data) as Prisma.JobUncheckedUpdateInput), version: { increment: 1 } },
      include: JOB_INCLUDE,
    });
    if (data.crew !== undefined) await this.syncCrew(id, data.crew);
    await logActivity(id, userId ?? null, 'JOB_UPDATED', 'Job details updated');
    return this.findById(job.id);
  }

  async updateStatus(id: string, status: JobStatus, userId: string, note?: string) {
    await this.findById(id);
    const [job] = await prisma.$transaction([
      prisma.job.update({
        where: { id },
        data: { status, completedAt: status === 'DELIVERED' ? new Date() : undefined, version: { increment: 1 } },
        include: JOB_INCLUDE,
      }),
      prisma.jobStatusHistory.create({ data: { jobId: id, status, changedBy: userId, note } }),
    ]);
    const label = status.toLowerCase().replace(/_/g, ' ');
    await logActivity(id, userId, 'STATUS_CHANGED', `Status changed to "${label}"`);
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

  async updateLineItems(jobId: string, items: Array<{ name: string; type: string; qty: number; unit: string; unitPrice: number; vatPct: number; costPrice?: number | null }>, userId?: string) {
    await this.findById(jobId);
    await logActivity(jobId, userId ?? null, 'LINE_ITEMS_UPDATED', `Products & Services updated (${items.length} rows)`);
    return prisma.$transaction(async (tx) => {
      await tx.jobLineItem.deleteMany({ where: { jobId } });
      if (items.length > 0) {
        await tx.jobLineItem.createMany({
          data: items.map((item, i) => ({
            jobId,
            sortOrder: i,
            name: item.name,
            type: item.type || 'service',
            qty: new Prisma.Decimal(String(item.qty ?? 1)),
            unit: item.unit || 'hr',
            unitPrice: new Prisma.Decimal(String(item.unitPrice ?? 0)),
            vatPct: new Prisma.Decimal(String(item.vatPct ?? 27)),
            costPrice: item.costPrice != null && (item.costPrice as unknown) !== '' ? new Prisma.Decimal(String(item.costPrice)) : null,
          })),
        });
      }
      return tx.jobLineItem.findMany({ where: { jobId }, orderBy: { sortOrder: 'asc' } });
    });
  }
}

export default new JobsService();
