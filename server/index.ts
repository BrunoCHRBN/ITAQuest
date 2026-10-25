import path from 'path';
import fs from 'fs';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { cancelJob, createJob, getJob } from './jobManager';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load server environment variables
const envPath = path.resolve(__dirname, '.env');
dotenv.config({ path: envPath });

const app = express();
const PORT = process.env.PORT || 3001;

// Ensure upload directory exists
const uploadDir = path.resolve(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer upload configuration with 50MB limit and PDF verification
const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB
  },
  fileFilter: (_req, file, cb) => {
    const isPdf =
      file.mimetype === 'application/pdf' ||
      file.originalname.toLowerCase().endsWith('.pdf');
    if (isPdf) {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos no formato PDF são aceitos.'));
    }
  },
});

app.use(cors());
app.use(express.json());

// 1. Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    model: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
  });
});

// 2. Start extraction job
app.post(
  '/api/extract/jobs',
  upload.fields([
    { name: 'examPdf', maxCount: 1 },
    { name: 'answerKeyPdf', maxCount: 1 },
  ]),
  (req, res) => {
    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const examFile = files?.examPdf?.[0];

      if (!examFile) {
        res.status(400).json({ error: 'O arquivo PDF da prova (examPdf) é obrigatório.' });
        return;
      }

      const answerKeyFile = files?.answerKeyPdf?.[0];

      const year = req.body.year ? Number(req.body.year) : undefined;
      const phase = req.body.phase ? String(req.body.phase).trim() : undefined;
      const institution = req.body.institution ? String(req.body.institution).trim() : 'ITA';

      const job = createJob({
        examFilePath: examFile.path,
        examFileName: examFile.originalname,
        answerKeyFilePath: answerKeyFile?.path,
        answerKeyFileName: answerKeyFile?.originalname,
        metadata: {
          institution,
          year,
          phase,
        },
      });

      res.status(202).json({
        jobId: job.id,
        status: job.status,
        step: job.step,
      });
    } catch (err) {
      console.error('Erro ao criar job de extração:', err);
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Erro interno ao iniciar extração.',
      });
    }
  }
);

// 3. Get job status and results
app.get('/api/extract/jobs/:id', (req, res) => {
  const job = getJob(req.params.id);
  if (!job) {
    res.status(404).json({ error: 'Job de extração não encontrado.' });
    return;
  }
  res.json(job);
});

// 4. Cancel job
app.post('/api/extract/jobs/:id/cancel', (req, res) => {
  const success = cancelJob(req.params.id);
  if (!success) {
    res.status(400).json({
      error: 'Não foi possível cancelar o job (já finalizado ou inexistente).',
    });
    return;
  }
  res.json({ success: true, message: 'Job cancelado com sucesso.' });
});

// Multer and general error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Server error handler:', err);
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ error: 'O arquivo PDF excede o limite máximo permitido de 50 MB.' });
      return;
    }
    res.status(400).json({ error: `Erro no upload do arquivo: ${err.message}` });
    return;
  }
  res.status(500).json({ error: err.message || 'Erro interno no servidor.' });
});

app.listen(PORT, () => {
  console.log(`Backend ITAQuest ativo na porta ${PORT}`);
});
