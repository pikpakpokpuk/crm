import { google, sheets_v4 } from 'googleapis';
import { Prisma } from '@prisma/client';
import prisma from '../prisma/client';
import { AppError } from '../middleware/error.middleware';

const SETTINGS_ID = 'google_sheets';

type Entity = 'customers' | 'employees' | 'inventory' | 'jobs';

const TABS: Record<Entity, string> = {
  customers: 'Customers',
  employees: 'Employees',
  inventory: 'Inventory',
  jobs: 'Jobs',
};

const COLUMNS: Record<Entity, string[]> = {
  customers: ['id', 'name', 'email', 'phone', 'address', 'taxNumber', 'notes'],
  employees: ['id', 'name', 'email', 'role', 'active'],
  inventory: ['id', 'name', 'sku', 'category', 'quantity', 'unit', 'unitPrice', 'costPrice', 'minStock', 'notes'],
  jobs: [
    'id', 'customerEmail', 'customerPhone', 'description', 'damageType', 'priority', 'status',
    'estimatedPrice', 'finalPrice', 'notes', 'scheduledStart', 'scheduledEnd',
    'vehicleMake', 'vehicleModel', 'vehicleYear', 'vehiclePlate', 'vehicleVin', 'vehicleColor', 'vehicleMileage',
    'assignedToEmail',
  ],
};

export interface RowResult { row: number; action: 'created' | 'updated' | 'skipped'; error?: string }
export interface ImportResult { created: number; updated: number; skipped: number; errors: { row: number; message: string }[] }

const cell = (v: unknown): string => (v == null ? '' : String(v));

export class SheetsService {
  async getConfig() {
    const settings = await prisma.integrationSettings.findUnique({ where: { id: SETTINGS_ID } });
    return { connected: !!settings?.serviceAccountJson && !!settings?.sheetId, sheetId: settings?.sheetId ?? null };
  }

  async saveConfig(sheetId: string, serviceAccountJson: string) {
    let parsed: { client_email?: string };
    try {
      parsed = JSON.parse(serviceAccountJson);
    } catch {
      throw new AppError(400, 'Service account JSON is not valid JSON');
    }
    if (!parsed.client_email) throw new AppError(400, 'Service account JSON is missing client_email — is this the right file?');

    const auth = new google.auth.GoogleAuth({ credentials: parsed as never, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    const sheets = google.sheets({ version: 'v4', auth });
    try {
      await sheets.spreadsheets.get({ spreadsheetId: sheetId });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error';
      throw new AppError(400, `Could not access the spreadsheet — check the Sheet ID and that it's shared with ${parsed.client_email} as Editor (${message})`);
    }

    await prisma.integrationSettings.upsert({
      where: { id: SETTINGS_ID },
      create: { id: SETTINGS_ID, sheetId, serviceAccountJson },
      update: { sheetId, serviceAccountJson },
    });
    return { connected: true, sheetId, serviceAccountEmail: parsed.client_email };
  }

  private async getClient(): Promise<{ sheets: sheets_v4.Sheets; sheetId: string }> {
    const settings = await prisma.integrationSettings.findUnique({ where: { id: SETTINGS_ID } });
    if (!settings?.serviceAccountJson || !settings?.sheetId) {
      throw new AppError(400, 'Google Sheets is not configured yet');
    }
    const credentials = JSON.parse(settings.serviceAccountJson);
    const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    return { sheets: google.sheets({ version: 'v4', auth }), sheetId: settings.sheetId };
  }

  async exportEntity(entity: Entity): Promise<number> {
    const { sheets, sheetId } = await this.getClient();
    const tab = TABS[entity];
    const columns = COLUMNS[entity];
    const rows = await this.fetchRows(entity);

    await sheets.spreadsheets.values.clear({ spreadsheetId: sheetId, range: tab });
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${tab}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [columns, ...rows.map((r) => columns.map((c) => cell(r[c])))] },
    });
    return rows.length;
  }

  async importEntity(entity: Entity): Promise<ImportResult> {
    const { sheets, sheetId } = await this.getClient();
    const tab = TABS[entity];
    const columns = COLUMNS[entity];

    const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: tab });
    const values = res.data.values ?? [];
    if (values.length === 0) return { created: 0, updated: 0, skipped: 0, errors: [] };

    const [header, ...dataRows] = values;
    const colIndex = new Map(columns.map((c) => [c, header.indexOf(c)]));

    const result: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [] };
    for (let i = 0; i < dataRows.length; i++) {
      const rowNum = i + 2; // 1-indexed + header row
      const raw = dataRows[i];
      const get = (col: string) => {
        const idx = colIndex.get(col);
        return idx != null && idx >= 0 ? (raw[idx] ?? '').trim() : '';
      };
      try {
        const outcome = await this.importRow(entity, get);
        result[outcome]++;
      } catch (err) {
        result.skipped++;
        result.errors.push({ row: rowNum, message: err instanceof Error ? err.message : 'Unknown error' });
      }
    }
    return result;
  }

  private async fetchRows(entity: Entity): Promise<Record<string, unknown>[]> {
    switch (entity) {
      case 'customers':
        return prisma.customer.findMany({ orderBy: { name: 'asc' } });
      case 'employees':
        return prisma.user.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, email: true, role: true, active: true } });
      case 'inventory':
        return prisma.inventoryItem.findMany({ orderBy: { name: 'asc' } });
      case 'jobs': {
        const jobs = await prisma.job.findMany({ include: { customer: true, assignedTo: true }, orderBy: { createdAt: 'desc' } });
        return jobs.map((j) => ({
          id: j.id,
          customerEmail: j.customer.email ?? '',
          customerPhone: j.customer.phone,
          description: j.description,
          damageType: j.damageType,
          priority: j.priority,
          status: j.status,
          estimatedPrice: j.estimatedPrice,
          finalPrice: j.finalPrice,
          notes: j.notes,
          scheduledStart: j.scheduledStart?.toISOString() ?? '',
          scheduledEnd: j.scheduledEnd?.toISOString() ?? '',
          vehicleMake: j.vehicleMake, vehicleModel: j.vehicleModel, vehicleYear: j.vehicleYear,
          vehiclePlate: j.vehiclePlate, vehicleVin: j.vehicleVin, vehicleColor: j.vehicleColor, vehicleMileage: j.vehicleMileage,
          assignedToEmail: j.assignedTo?.email ?? '',
        }));
      }
    }
  }

  private async importRow(entity: Entity, get: (col: string) => string): Promise<'created' | 'updated' | 'skipped'> {
    switch (entity) {
      case 'customers': return this.importCustomerRow(get);
      case 'employees': return this.importEmployeeRow(get);
      case 'inventory': return this.importInventoryRow(get);
      case 'jobs': return this.importJobRow(get);
    }
  }

  private async importCustomerRow(get: (col: string) => string): Promise<'created' | 'updated' | 'skipped'> {
    const id = get('id');
    const email = get('email');
    if (!get('name') || !get('phone')) throw new Error('name and phone are required');
    const data = {
      name: get('name'), email: email || null, phone: get('phone'),
      address: get('address') || null, taxNumber: get('taxNumber') || null, notes: get('notes') || null,
    };
    const existing = id
      ? await prisma.customer.findUnique({ where: { id } })
      : (email ? await prisma.customer.findUnique({ where: { email } }) : null);
    if (existing) {
      await prisma.customer.update({ where: { id: existing.id }, data });
      return 'updated';
    }
    await prisma.customer.create({ data });
    return 'created';
  }

  private async importEmployeeRow(get: (col: string) => string): Promise<'created' | 'updated' | 'skipped'> {
    const id = get('id');
    const email = get('email');
    const existing = id
      ? await prisma.user.findUnique({ where: { id } })
      : (email ? await prisma.user.findUnique({ where: { email } }) : null);
    if (!existing) throw new Error('Employee not found by id/email — employee creation via import is not supported (would need a password)');
    const role = get('role');
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        name: get('name') || existing.name,
        active: get('active') ? get('active').toLowerCase() === 'true' : existing.active,
        role: role === 'ADMIN' || role === 'EMPLOYEE' ? role : existing.role,
      },
    });
    return 'updated';
  }

  private async importInventoryRow(get: (col: string) => string): Promise<'created' | 'updated' | 'skipped'> {
    const id = get('id');
    const sku = get('sku');
    if (!get('name')) throw new Error('name is required');
    const data = {
      name: get('name'),
      sku: sku || null,
      category: get('category') || null,
      quantity: get('quantity') ? parseInt(get('quantity'), 10) : 0,
      unit: get('unit') || 'piece',
      unitPrice: new Prisma.Decimal(get('unitPrice') || '0'),
      costPrice: get('costPrice') ? new Prisma.Decimal(get('costPrice')) : null,
      minStock: get('minStock') ? parseInt(get('minStock'), 10) : null,
      notes: get('notes') || null,
    };
    const existing = id
      ? await prisma.inventoryItem.findUnique({ where: { id } })
      : (sku ? await prisma.inventoryItem.findUnique({ where: { sku } }) : null);
    if (existing) {
      await prisma.inventoryItem.update({ where: { id: existing.id }, data });
      return 'updated';
    }
    await prisma.inventoryItem.create({ data });
    return 'created';
  }

  private async importJobRow(get: (col: string) => string): Promise<'created' | 'updated' | 'skipped'> {
    const id = get('id');
    const customerEmail = get('customerEmail');
    const customerPhone = get('customerPhone');

    let customer = customerEmail ? await prisma.customer.findUnique({ where: { email: customerEmail } }) : null;
    if (!customer && customerPhone) customer = await prisma.customer.findFirst({ where: { phone: customerPhone } });
    if (!customer) {
      if (!customerPhone) throw new Error('No matching customer found and no customerPhone given to create one');
      customer = await prisma.customer.create({
        data: { name: customerEmail || customerPhone, email: customerEmail || null, phone: customerPhone },
      });
    }

    let assignedToId: string | null = null;
    const assignedToEmail = get('assignedToEmail');
    if (assignedToEmail) {
      const emp = await prisma.user.findUnique({ where: { email: assignedToEmail } });
      if (!emp) throw new Error(`assignedToEmail "${assignedToEmail}" does not match any employee`);
      assignedToId = emp.id;
    }

    const data = {
      customerId: customer.id,
      assignedToId,
      description: get('description') || 'Imported job',
      damageType: get('damageType') || null,
      priority: (['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(get('priority')) ? get('priority') : 'MEDIUM') as never,
      status: (['NEW', 'IN_PROGRESS', 'WAITING_PARTS', 'READY', 'DELIVERED', 'CANCELLED'].includes(get('status')) ? get('status') : 'NEW') as never,
      estimatedPrice: get('estimatedPrice') ? new Prisma.Decimal(get('estimatedPrice')) : null,
      finalPrice: get('finalPrice') ? new Prisma.Decimal(get('finalPrice')) : null,
      notes: get('notes') || null,
      scheduledStart: get('scheduledStart') ? new Date(get('scheduledStart')) : null,
      scheduledEnd: get('scheduledEnd') ? new Date(get('scheduledEnd')) : null,
      vehicleMake: get('vehicleMake') || null,
      vehicleModel: get('vehicleModel') || null,
      vehicleYear: get('vehicleYear') ? parseInt(get('vehicleYear'), 10) : null,
      vehiclePlate: get('vehiclePlate') || null,
      vehicleVin: get('vehicleVin') || null,
      vehicleColor: get('vehicleColor') || null,
      vehicleMileage: get('vehicleMileage') ? parseInt(get('vehicleMileage'), 10) : null,
    };

    const existing = id ? await prisma.job.findUnique({ where: { id } }) : null;
    if (existing) {
      await prisma.job.update({ where: { id: existing.id }, data });
      return 'updated';
    }
    await prisma.job.create({ data: { ...data, createdById: (await this.getFirstAdminId()) } });
    return 'created';
  }

  private async getFirstAdminId(): Promise<string> {
    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    if (!admin) throw new Error('No admin user exists to attribute imported jobs to');
    return admin.id;
  }
}

export default new SheetsService();
