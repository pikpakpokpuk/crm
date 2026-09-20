import { Response, NextFunction } from 'express';
import documentService, { generateStarterTemplate, PLACEHOLDERS, type JobDocData } from '../services/document.service';
import companyService from '../services/company.service';
import { AppError } from '../middleware/error.middleware';
import type { AuthRequest } from '../types';

export class DocumentController {
  async listTemplates(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const templates = await documentService.listTemplates();
      res.json(templates);
    } catch (err) { next(err); }
  }

  async uploadTemplate(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { name, type } = req.body as { name: string; type: string };
      const file = req.file;
      if (!file) { res.status(400).json({ error: 'No file uploaded' }); return; }
      const tmpl = await documentService.saveTemplate(file, name, type ?? 'offer');
      res.status(201).json(tmpl);
    } catch (err) { next(err); }
  }

  async deleteTemplate(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await documentService.deleteTemplate(req.params.id as string);
      res.status(204).send();
    } catch (err) { next(err); }
  }

  async getPlaceholders(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      res.json(PLACEHOLDERS);
    } catch (err) { next(err); }
  }

  async downloadStarter(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const buffer = await generateStarterTemplate();
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', 'attachment; filename="crm-starter-template.docx"');
      res.send(buffer);
    } catch (err) { next(err); }
  }

  async generateDocument(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { templateId } = req.params as { templateId: string };
      const company = await companyService.get();
      if (!company.name) {
        throw new AppError(400, 'Company details are not set. Ask an admin to fill in Settings → Company Info before generating documents.');
      }
      // Company fields always come from the database, never from the client.
      const jobData: JobDocData = {
        ...(req.body as JobDocData),
        company_name: company.name,
        company_address: company.address,
        company_tax_number: company.taxNumber,
        company_phone: company.phone,
        company_email: company.email,
      };
      const buffer = await documentService.generateDocument(templateId, jobData);
      const filename = `document-${jobData.job_id}-${Date.now()}.docx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (err) { next(err); }
  }
}

export default new DocumentController();
