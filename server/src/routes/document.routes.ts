import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import type { Request, Response, NextFunction } from 'express';
import documentController from '../controllers/document.controller';
import { authenticate } from '../middleware/auth.middleware';
import { AppError } from '../middleware/error.middleware';

const TEMPLATES_DIR = path.join(__dirname, '../../uploads/templates');
fs.mkdirSync(TEMPLATES_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: TEMPLATES_DIR,
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      cb(null, true);
    } else {
      cb(new Error('Only .docx files allowed'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

const router = Router();

// Generic blank starter template — no tenant data, safe to serve without auth
// so the frontend can trigger it with a plain window.open().
router.get('/starter', documentController.downloadStarter.bind(documentController));

router.use(authenticate);

router.get('/placeholders', documentController.getPlaceholders.bind(documentController));
router.get('/', documentController.listTemplates.bind(documentController));
router.post('/', (req: Request, res: Response, next: NextFunction) => {
  upload.single('file')(req, res, (err: unknown) => {
    if (err) { next(new AppError(400, err instanceof Error ? err.message : 'Upload failed')); return; }
    next();
  });
}, documentController.uploadTemplate.bind(documentController));
router.delete('/:id', documentController.deleteTemplate.bind(documentController));
router.post('/:templateId/generate', documentController.generateDocument.bind(documentController));

export default router;
