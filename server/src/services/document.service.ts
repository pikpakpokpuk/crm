import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, HeadingLevel, WidthType, AlignmentType, BorderStyle,
  ShadingType, TableLayoutType,
} from 'docx';
import prisma from '../prisma/client';
import { AppError } from '../middleware/error.middleware';

const UPLOADS_DIR = path.join(__dirname, '../../uploads/templates');

// ─── Placeholder reference ────────────────────────────────────────────────────

export const PLACEHOLDERS = [
  { group: 'Job', tag: '{job_id}', description: 'Job ID (e.g. J-0124)' },
  { group: 'Job', tag: '{status}', description: 'Job status' },
  { group: 'Job', tag: '{priority}', description: 'Priority level' },
  { group: 'Job', tag: '{created_date}', description: 'Date job was created' },
  { group: 'Job', tag: '{scheduled_date}', description: 'Scheduled service date' },
  { group: 'Job', tag: '{description}', description: 'Job description' },
  { group: 'Job', tag: '{damage_type}', description: 'Type of damage / work' },
  { group: 'Job', tag: '{notes}', description: 'Additional notes' },
  { group: 'Job', tag: '{estimated_price}', description: 'Estimated price' },
  { group: 'Customer', tag: '{customer_name}', description: 'Customer full name' },
  { group: 'Customer', tag: '{customer_email}', description: 'Customer email' },
  { group: 'Customer', tag: '{customer_phone}', description: 'Customer phone' },
  { group: 'Customer', tag: '{customer_address}', description: 'Customer address' },
  { group: 'Customer', tag: '{customer_tax_number}', description: 'Customer tax number' },
  { group: 'Vehicle', tag: '{vehicle_make}', description: 'Vehicle make (e.g. BMW)' },
  { group: 'Vehicle', tag: '{vehicle_model}', description: 'Vehicle model (e.g. 320d)' },
  { group: 'Vehicle', tag: '{vehicle_year}', description: 'Vehicle year' },
  { group: 'Vehicle', tag: '{vehicle_plate}', description: 'License plate' },
  { group: 'Vehicle', tag: '{vehicle_vin}', description: 'VIN number' },
  { group: 'Vehicle', tag: '{vehicle_color}', description: 'Vehicle color' },
  { group: 'Vehicle', tag: '{vehicle_mileage}', description: 'Mileage (km)' },
  { group: 'Employee', tag: '{assigned_to}', description: 'Assigned employee name' },
  { group: 'Items loop', tag: '{#items}', description: 'Start of items loop' },
  { group: 'Items loop', tag: '{item_name}', description: 'Product/service name' },
  { group: 'Items loop', tag: '{item_type}', description: 'Product or Service' },
  { group: 'Items loop', tag: '{item_qty}', description: 'Quantity or hours' },
  { group: 'Items loop', tag: '{item_unit}', description: 'Unit (pc, hr, set…)' },
  { group: 'Items loop', tag: '{item_unit_price}', description: 'Unit price' },
  { group: 'Items loop', tag: '{item_vat_pct}', description: 'VAT percentage' },
  { group: 'Items loop', tag: '{item_total_net}', description: 'Line total (net)' },
  { group: 'Items loop', tag: '{item_total_gross}', description: 'Line total (gross)' },
  { group: 'Items loop', tag: '{/items}', description: 'End of items loop' },
  { group: 'Totals', tag: '{subtotal}', description: 'Sum of all net totals' },
  { group: 'Totals', tag: '{vat_total}', description: 'Total VAT amount' },
  { group: 'Totals', tag: '{grand_total}', description: 'Grand total (gross)' },
  { group: 'Company', tag: '{company_name}', description: 'Your company name' },
  { group: 'Company', tag: '{company_address}', description: 'Your company address' },
  { group: 'Company', tag: '{company_tax_number}', description: 'Your tax number' },
  { group: 'Company', tag: '{company_phone}', description: 'Your phone number' },
];

// ─── Starter template generator ───────────────────────────────────────────────

function cell(text: string, bold = false, shade = false): TableCell {
  return new TableCell({
    shading: shade ? { type: ShadingType.SOLID, color: 'E8ECEF' } : undefined,
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold, size: 18 })],
      }),
    ],
  });
}

export async function generateStarterTemplate(): Promise<Buffer> {
  const doc = new Document({
    sections: [{
      children: [
        // Title
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun({ text: 'OFFER / DEVIZ', bold: true, size: 36 })],
        }),

        new Paragraph({ children: [new TextRun('')] }),

        // Company info
        new Paragraph({ children: [new TextRun({ text: '{company_name}', bold: true, size: 22 })] }),
        new Paragraph({ children: [new TextRun({ text: '{company_address}', size: 20 })] }),
        new Paragraph({ children: [new TextRun({ text: '{company_phone}  |  {company_tax_number}', size: 20 })] }),

        new Paragraph({ children: [new TextRun('')] }),

        // Job meta table
        new Table({
          layout: TableLayoutType.FIXED,
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
          },
          rows: [
            new TableRow({ children: [
              cell('Job ID:', true), cell('{job_id}'),
              cell('Date:', true), cell('{created_date}'),
            ]}),
            new TableRow({ children: [
              cell('Status:', true), cell('{status}'),
              cell('Scheduled:', true), cell('{scheduled_date}'),
            ]}),
            new TableRow({ children: [
              cell('Priority:', true), cell('{priority}'),
              cell('Assigned to:', true), cell('{assigned_to}'),
            ]}),
          ],
        }),

        new Paragraph({ children: [new TextRun('')] }),

        // Customer + Vehicle
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: 'Customer', bold: true })] }),
        new Table({
          layout: TableLayoutType.FIXED,
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
          },
          rows: [
            new TableRow({ children: [cell('Name:', true), cell('{customer_name}'), cell('Phone:', true), cell('{customer_phone}')] }),
            new TableRow({ children: [cell('Email:', true), cell('{customer_email}'), cell('Tax No:', true), cell('{customer_tax_number}')] }),
            new TableRow({ children: [cell('Address:', true), cell('{customer_address}'), cell(''), cell('')] }),
          ],
        }),

        new Paragraph({ children: [new TextRun('')] }),

        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: 'Vehicle', bold: true })] }),
        new Table({
          layout: TableLayoutType.FIXED,
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
          },
          rows: [
            new TableRow({ children: [cell('Make:', true), cell('{vehicle_make}'), cell('Model:', true), cell('{vehicle_model}')] }),
            new TableRow({ children: [cell('Year:', true), cell('{vehicle_year}'), cell('Plate:', true), cell('{vehicle_plate}')] }),
            new TableRow({ children: [cell('Color:', true), cell('{vehicle_color}'), cell('Mileage:', true), cell('{vehicle_mileage} km')] }),
            new TableRow({ children: [cell('VIN:', true), cell('{vehicle_vin}'), cell(''), cell('')] }),
          ],
        }),

        new Paragraph({ children: [new TextRun('')] }),

        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: 'Work Description', bold: true })] }),
        new Paragraph({ children: [new TextRun({ text: '{description}', size: 20 })] }),
        new Paragraph({ children: [new TextRun({ text: 'Type: {damage_type}', size: 20 })] }),

        new Paragraph({ children: [new TextRun('')] }),

        // Items table
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: 'Products & Services', bold: true })] }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            // Header
            new TableRow({
              tableHeader: true,
              children: [
                cell('Name', true, true), cell('Type', true, true),
                cell('Qty', true, true), cell('Unit', true, true),
                cell('Unit Price', true, true), cell('VAT %', true, true),
                cell('Net', true, true), cell('Gross', true, true),
              ],
            }),
            // Loop row — docxtemplater will repeat this for each item
            new TableRow({
              children: [
                cell('{#items}{item_name}'), cell('{item_type}'),
                cell('{item_qty}'), cell('{item_unit}'),
                cell('{item_unit_price}'), cell('{item_vat_pct}%'),
                cell('{item_total_net}'), cell('{item_total_gross}{/items}'),
              ],
            }),
          ],
        }),

        new Paragraph({ children: [new TextRun('')] }),

        // Totals
        new Table({
          layout: TableLayoutType.FIXED,
          width: { size: 40, type: WidthType.PERCENTAGE },
          alignment: AlignmentType.RIGHT,
          borders: {
            top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
          },
          rows: [
            new TableRow({ children: [cell('Subtotal (net):', true), cell('{subtotal}')] }),
            new TableRow({ children: [cell('VAT:', true), cell('{vat_total}')] }),
            new TableRow({ children: [cell('TOTAL:', true), cell('{grand_total}')] }),
          ],
        }),

        new Paragraph({ children: [new TextRun('')] }),
        new Paragraph({ children: [new TextRun({ text: 'Notes: {notes}', italics: true, size: 18 })] }),
      ],
    }],
  });

  return Packer.toBuffer(doc);
}

// ─── Template CRUD ────────────────────────────────────────────────────────────

export class DocumentService {
  async listTemplates() {
    return prisma.documentTemplate.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async saveTemplate(file: Express.Multer.File, name: string, type: string) {
    return prisma.documentTemplate.create({
      data: { name, type, filename: file.originalname, path: file.path },
    });
  }

  async deleteTemplate(id: string) {
    const tmpl = await prisma.documentTemplate.findUnique({ where: { id } });
    if (!tmpl) throw new AppError(404, 'Template not found');
    if (fs.existsSync(tmpl.path)) fs.unlinkSync(tmpl.path);
    await prisma.documentTemplate.delete({ where: { id } });
  }

  // ─── Generate filled document ─────────────────────────────────────────────

  async generateDocument(templateId: string, jobData: JobDocData): Promise<Buffer> {
    const tmpl = await prisma.documentTemplate.findUnique({ where: { id: templateId } });
    if (!tmpl) throw new AppError(404, 'Template not found');
    if (!fs.existsSync(tmpl.path)) throw new AppError(404, 'Template file missing on disk');

    const content = fs.readFileSync(tmpl.path, 'binary');
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    doc.render(jobData);
    return doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' }) as Buffer;
  }
}

export interface JobDocData {
  job_id: string;
  status: string;
  priority: string;
  created_date: string;
  scheduled_date: string;
  description: string;
  damage_type: string;
  notes: string;
  estimated_price: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_address: string;
  customer_tax_number: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: string;
  vehicle_plate: string;
  vehicle_vin: string;
  vehicle_color: string;
  vehicle_mileage: string;
  assigned_to: string;
  items: {
    item_name: string;
    item_type: string;
    item_qty: string;
    item_unit: string;
    item_unit_price: string;
    item_vat_pct: string;
    item_total_net: string;
    item_total_gross: string;
  }[];
  subtotal: string;
  vat_total: string;
  grand_total: string;
  company_name: string;
  company_address: string;
  company_tax_number: string;
  company_phone: string;
}

export default new DocumentService();
