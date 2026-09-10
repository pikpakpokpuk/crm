import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import documentController from '../controllers/document.controller';
import { authenticate } from '../middleware/auth.middleware';

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads/templates'),
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

router.use(authenticate);

router.get('/placeholders', documentController.getPlaceholders.bind(documentController));
router.get('/starter', documentController.downloadStarter.bind(documentController));
router.get('/', documentController.listTemplates.bind(documentController));
router.post('/', upload.single('file'), documentController.uploadTemplate.bind(documentController));
router.delete('/:id', documentController.deleteTemplate.bind(documentController));
router.post('/:templateId/generate', documentController.generateDocument.bind(documentController));

export default router;
