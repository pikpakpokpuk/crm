import { Prisma } from '@prisma/client';
import prisma from '../prisma/client';
import { AppError } from '../middleware/error.middleware';

const FINANCIALS_INCLUDE = {
  lineItems: true,
  inventoryUsage: { include: { item: true } },
  crew: { include: { user: { select: { id: true, name: true, hourlyRate: true } } } },
} satisfies Prisma.JobInclude;

type JobWithFinancialsData = Prisma.JobGetPayload<{ include: typeof FINANCIALS_INCLUDE }>;

export interface JobFinancials {
  jobId: string;
  materialRevenue: number;
  materialCost: number;
  manpowerRevenue: number;
  manpowerCost: number;
  totalRevenue: number;
  totalCost: number;
  profit: number;
  marginPct: number | null;
  hasIncompleteCostData: boolean;
}

export function computeJobFinancials(job: JobWithFinancialsData): JobFinancials {
  let materialRevenue = 0;
  let materialCost = 0;
  let manpowerRevenue = 0;
  let manpowerCost = 0;
  let hasIncompleteCostData = false;

  for (const li of job.lineItems) {
    const net = Number(li.qty) * Number(li.unitPrice);
    if (li.type === 'product') {
      materialRevenue += net;
      materialCost += Number(li.qty) * (li.costPrice != null ? Number(li.costPrice) : 0);
    } else {
      manpowerRevenue += net;
    }
  }

  for (const usage of job.inventoryUsage) {
    const cost = usage.item.costPrice != null ? Number(usage.item.costPrice) : 0;
    if (usage.item.costPrice == null) hasIncompleteCostData = true;
    materialCost += usage.quantity * cost;
  }

  for (const c of job.crew) {
    const hours = c.hours != null ? Number(c.hours) : 0;
    if (c.hours != null && c.user.hourlyRate == null) hasIncompleteCostData = true;
    manpowerCost += hours * (c.user.hourlyRate != null ? Number(c.user.hourlyRate) : 0);
  }

  const totalRevenue = materialRevenue + manpowerRevenue;
  const totalCost = materialCost + manpowerCost;
  const profit = totalRevenue - totalCost;
  const marginPct = totalRevenue > 0 ? (profit / totalRevenue) * 100 : null;

  return {
    jobId: job.id,
    materialRevenue, materialCost, manpowerRevenue, manpowerCost,
    totalRevenue, totalCost, profit, marginPct, hasIncompleteCostData,
  };
}

function buildDateRange(dateFrom?: string, dateTo?: string): Prisma.DateTimeFilter | undefined {
  if (!dateFrom && !dateTo) return undefined;
  const filter: Prisma.DateTimeFilter = {};
  if (dateFrom) filter.gte = new Date(dateFrom);
  if (dateTo) filter.lte = new Date(dateTo);
  return filter;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export class StatsService {
  async getJobFinancials(jobId: string): Promise<JobFinancials> {
    const job = await prisma.job.findUnique({ where: { id: jobId }, include: FINANCIALS_INCLUDE });
    if (!job) throw new AppError(404, 'Job not found');
    return computeJobFinancials(job);
  }

  async getJobsStats(filters: { jobType?: string; dateFrom?: string; dateTo?: string; status?: string }) {
    const where: Prisma.JobWhereInput = {};
    if (filters.jobType) where.damageType = filters.jobType;
    if (filters.status) where.status = filters.status as never;
    const createdAt = buildDateRange(filters.dateFrom, filters.dateTo);
    if (createdAt) where.createdAt = createdAt;

    const jobs = await prisma.job.findMany({ where, include: FINANCIALS_INCLUDE, orderBy: { createdAt: 'desc' } });
    const rows = jobs.map((job) => ({
      ...computeJobFinancials(job),
      description: job.description,
      damageType: job.damageType,
      status: job.status,
      createdAt: job.createdAt,
    }));

    const margins = rows.map((r) => r.marginPct).filter((m): m is number => m != null);
    return {
      jobs: rows,
      count: rows.length,
      totalRevenue: rows.reduce((s, r) => s + r.totalRevenue, 0),
      totalCost: rows.reduce((s, r) => s + r.totalCost, 0),
      totalProfit: rows.reduce((s, r) => s + r.profit, 0),
      avgMarginPct: average(margins),
    };
  }

  async getJobTypes() {
    const jobs = await prisma.job.findMany({
      where: { damageType: { not: null } },
      include: FINANCIALS_INCLUDE,
    });
    const byType = new Map<string, { count: number; margins: number[]; profit: number; revenue: number }>();
    for (const job of jobs) {
      const type = job.damageType as string;
      const fin = computeJobFinancials(job);
      const entry = byType.get(type) ?? { count: 0, margins: [], profit: 0, revenue: 0 };
      entry.count += 1;
      entry.profit += fin.profit;
      entry.revenue += fin.totalRevenue;
      if (fin.marginPct != null) entry.margins.push(fin.marginPct);
      byType.set(type, entry);
    }
    return Array.from(byType.entries())
      .map(([jobType, e]) => ({ jobType, count: e.count, avgMarginPct: average(e.margins), totalProfit: e.profit, totalRevenue: e.revenue }))
      .sort((a, b) => b.count - a.count);
  }

  async getEmployeeStats(dateFrom?: string, dateTo?: string) {
    const createdAt = buildDateRange(dateFrom, dateTo);
    const [jobs, employees] = await Promise.all([
      prisma.job.findMany({ where: createdAt ? { createdAt } : {}, include: FINANCIALS_INCLUDE }),
      prisma.user.findMany({ where: { active: true }, select: { id: true, name: true } }),
    ]);

    const byEmployee = new Map<string, { name: string; jobsCount: number; hours: number; revenue: number; manpowerCost: number; jobs: { id: string; description: string }[] }>();
    for (const emp of employees) {
      byEmployee.set(emp.id, { name: emp.name, jobsCount: 0, hours: 0, revenue: 0, manpowerCost: 0, jobs: [] });
    }

    for (const job of jobs) {
      if (job.crew.length === 0) continue;
      const fin = computeJobFinancials(job);
      const share = fin.totalRevenue / job.crew.length;
      for (const c of job.crew) {
        const entry = byEmployee.get(c.userId) ?? { name: c.user.name, jobsCount: 0, hours: 0, revenue: 0, manpowerCost: 0, jobs: [] };
        const hours = c.hours != null ? Number(c.hours) : 0;
        const rate = c.user.hourlyRate != null ? Number(c.user.hourlyRate) : 0;
        entry.jobsCount += 1;
        entry.hours += hours;
        entry.revenue += share;
        entry.manpowerCost += hours * rate;
        entry.jobs.push({ id: job.id, description: job.description });
        byEmployee.set(c.userId, entry);
      }
    }

    return Array.from(byEmployee.entries())
      .map(([userId, e]) => ({ userId, ...e }))
      .sort((a, b) => b.revenue - a.revenue);
  }

  async getMonthly(month: string) {
    const [year, mon] = month.split('-').map(Number);
    const start = new Date(Date.UTC(year, mon - 1, 1));
    const end = new Date(Date.UTC(year, mon, 0, 23, 59, 59, 999));
    return this.aggregateRange(start, end);
  }

  async getMonthlyRange(fromMonth: string, toMonth: string) {
    const [fy, fm] = fromMonth.split('-').map(Number);
    const [ty, tm] = toMonth.split('-').map(Number);
    const start = new Date(Date.UTC(fy, fm - 1, 1));
    const end = new Date(Date.UTC(ty, tm, 0, 23, 59, 59, 999));

    const jobs = await prisma.job.findMany({ where: { createdAt: { gte: start, lte: end } }, include: FINANCIALS_INCLUDE });
    const byMonth = new Map<string, ReturnType<typeof this.emptyAggregate>>();

    let cursor = new Date(Date.UTC(fy, fm - 1, 1));
    const endCursor = new Date(Date.UTC(ty, tm - 1, 1));
    while (cursor <= endCursor) {
      byMonth.set(`${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`, this.emptyAggregate());
      cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
    }

    for (const job of jobs) {
      const key = `${job.createdAt.getUTCFullYear()}-${String(job.createdAt.getUTCMonth() + 1).padStart(2, '0')}`;
      const agg = byMonth.get(key);
      if (!agg) continue;
      this.foldJobIntoAggregate(agg, job);
    }

    return Array.from(byMonth.entries()).map(([month, agg]) => this.finalizeAggregate(month, agg));
  }

  private emptyAggregate() {
    return { totalRevenue: 0, totalCost: 0, totalProfit: 0, jobCount: 0, byType: new Map<string, { revenue: number; cost: number; profit: number }>() };
  }

  private foldJobIntoAggregate(agg: ReturnType<typeof this.emptyAggregate>, job: JobWithFinancialsData) {
    const fin = computeJobFinancials(job);
    agg.totalRevenue += fin.totalRevenue;
    agg.totalCost += fin.totalCost;
    agg.totalProfit += fin.profit;
    agg.jobCount += 1;
    const type = job.damageType ?? 'Uncategorized';
    const t = agg.byType.get(type) ?? { revenue: 0, cost: 0, profit: 0 };
    t.revenue += fin.totalRevenue;
    t.cost += fin.totalCost;
    t.profit += fin.profit;
    agg.byType.set(type, t);
  }

  private finalizeAggregate(month: string, agg: ReturnType<typeof this.emptyAggregate>) {
    return {
      month,
      totalRevenue: agg.totalRevenue,
      totalCost: agg.totalCost,
      totalProfit: agg.totalProfit,
      jobCount: agg.jobCount,
      breakdown: Array.from(agg.byType.entries()).map(([jobType, v]) => ({ jobType, ...v })),
    };
  }

  private async aggregateRange(start: Date, end: Date) {
    const jobs = await prisma.job.findMany({ where: { createdAt: { gte: start, lte: end } }, include: FINANCIALS_INCLUDE });
    const agg = this.emptyAggregate();
    for (const job of jobs) this.foldJobIntoAggregate(agg, job);
    return this.finalizeAggregate(`${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}`, agg);
  }
}

export default new StatsService();
