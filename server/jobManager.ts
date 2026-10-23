import fs from 'fs';
import type { ExtractedAnswerKeyItem, ExtractionJob } from './types';
import { auditCoverage } from './integrity';
import {
  computeFileChecksum,
  extractAnswerKeyFromPdf,
  extractExamFromPdf,
  reconcileExtractedData,
} from './geminiService';

const jobs = new Map<string, ExtractionJob>();

export function createJob(params: {
  examFilePath: string;
  examFileName: string;
  answerKeyFilePath?: string;
  answerKeyFileName?: string;
  metadata: {
    institution: string;
    year?: number;
    phase?: string;
  };
}): ExtractionJob {
  const jobId = `job-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const examChecksum = computeFileChecksum(params.examFilePath);
  const answerKeyChecksum = params.answerKeyFilePath
    ? computeFileChecksum(params.answerKeyFilePath)
    : undefined;

  const job: ExtractionJob = {
    id: jobId,
    status: 'queued',
    progress: 0,
    step: 'Na fila de processamento...',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    examFileName: params.examFileName,
    examChecksum,
    answerKeyFileName: params.answerKeyFileName,
    answerKeyChecksum,
    metadata: params.metadata,
    questions: [],
    reviewQueue: [],
  };

  jobs.set(jobId, job);

  // Run in background asynchronously
  processJob(jobId, params.examFilePath, params.answerKeyFilePath).catch((err) => {
    console.error(`Erro ao processar job ${jobId}:`, err);
  });

  return job;
}

export function getJob(jobId: string): ExtractionJob | undefined {
  return jobs.get(jobId);
}

export function cancelJob(jobId: string): boolean {
  const job = jobs.get(jobId);
  if (!job) return false;
  if (job.status === 'completed' || job.status === 'completed_with_gaps' || job.status === 'failed') return false;

  job.status = 'cancelled';
  job.step = 'Processamento cancelado pelo usuário.';
  job.updatedAt = new Date().toISOString();
  return true;
}

async function processJob(jobId: string, examPath: string, answerKeyPath?: string) {
  const job = jobs.get(jobId);
  if (!job) return;

  const cleanup = () => {
    try {
      if (fs.existsSync(examPath)) fs.unlinkSync(examPath);
      if (answerKeyPath && fs.existsSync(answerKeyPath)) fs.unlinkSync(answerKeyPath);
    } catch (e) {
      console.warn('Falha ao limpar arquivo temporário:', e);
    }
  };

  const isCancelled = () => jobs.get(jobId)?.status === 'cancelled';

  try {
    job.status = 'processing';
    job.progress = 15;
    job.step = 'Enviando e analisando caderno de prova com Gemini...';
    job.updatedAt = new Date().toISOString();

    if (isCancelled()) {
      cleanup();
      return;
    }

    const examResult = await extractExamFromPdf(examPath, undefined, (msg) => {
      job.step = msg;
      job.updatedAt = new Date().toISOString();
    });

    if (isCancelled()) {
      cleanup();
      return;
    }

    job.progress = 60;
    job.updatedAt = new Date().toISOString();

    let answerKeys: ExtractedAnswerKeyItem[] | undefined;
    if (answerKeyPath) {
      job.step = 'Analisando documento de gabarito oficial...';
      answerKeys = await extractAnswerKeyFromPdf(answerKeyPath, undefined, (msg) => {
        job.step = msg;
        job.updatedAt = new Date().toISOString();
      });
    }

    if (isCancelled()) {
      cleanup();
      return;
    }

    job.progress = 85;
    job.step = 'Reconciliando questões, alternativas e alertas determinísticos...';
    job.updatedAt = new Date().toISOString();

    const reconciled = reconcileExtractedData({
      rawQuestions: examResult.questions,
      answerKeys,
      examFileName: job.examFileName,
      examChecksum: job.examChecksum,
      answerKeyChecksum: job.answerKeyChecksum,
      metadata: job.metadata,
      promptVersion: examResult.promptVersion,
      model: examResult.model,
    });

    // O gabarito é um oráculo de contagem: uma linha por questão. Usá-lo para conferir a
    // cobertura é o que impede uma perda silenciosa de passar como sucesso.
    const coverage = auditCoverage({
      questions: reconciled.questions,
      expectedCount: answerKeys?.length,
    });

    job.expectedCount = coverage.expectedCount;
    job.missingNumbers = coverage.missingNumbers;
    job.alerts = coverage.alerts;
    job.questions = reconciled.questions;
    job.reviewQueue = reconciled.reviewQueue;

    if (coverage.verifiable && !coverage.complete) {
      job.status = 'completed_with_gaps';
      job.progress = 100;
      job.step = `Extração concluída com lacunas: ${reconciled.questions.length} questões identificadas, ${coverage.missingNumbers.length} ausente(s) em relação ao gabarito (${coverage.expectedCount}).`;
    } else {
      job.status = 'completed';
      job.progress = 100;
      job.step = `Extração concluída: ${reconciled.questions.length} questões identificadas (${reconciled.reviewQueue.length} na fila de revisão por exceção).`;
    }
    job.updatedAt = new Date().toISOString();
  } catch (err) {
    if (job.status !== 'cancelled') {
      job.status = 'failed';
      job.step = 'Falha no processamento com a API Gemini.';
      job.error = err instanceof Error ? err.message : 'Erro desconhecido durante a extração.';
      job.updatedAt = new Date().toISOString();
    }
  } finally {
    cleanup();
  }
}
