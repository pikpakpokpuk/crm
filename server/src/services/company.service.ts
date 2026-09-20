import prisma from '../prisma/client';
import { AppError } from '../middleware/error.middleware';

const ID = 'company';
const FIELDS = ['name', 'address', 'taxNumber', 'phone', 'email'] as const;
export type CompanyDetails = Record<(typeof FIELDS)[number], string>;

export class CompanyService {
  async get(): Promise<CompanyDetails> {
    const row = await prisma.companySettings.findUnique({ where: { id: ID } });
    return {
      name: row?.name ?? '',
      address: row?.address ?? '',
      taxNumber: row?.taxNumber ?? '',
      phone: row?.phone ?? '',
      email: row?.email ?? '',
    };
  }

  async save(body: Record<string, unknown>): Promise<CompanyDetails> {
    const data = {} as CompanyDetails;
    for (const f of FIELDS) {
      const v = body[f];
      if (v !== undefined && typeof v !== 'string') throw new AppError(400, `${f} must be text`);
      data[f] = (v ?? '').trim().slice(0, 300);
    }
    if (!data.name) throw new AppError(400, 'Company name is required');
    await prisma.companySettings.upsert({ where: { id: ID }, create: { id: ID, ...data }, update: data });
    return data;
  }
}

export default new CompanyService();
