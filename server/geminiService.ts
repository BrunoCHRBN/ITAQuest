import crypto from 'crypto';
import fs from 'fs';
import { GoogleGenAI, createPartFromUri, Type } from '@google/genai';
import type {
  Difficulty,
  ExtractedAnswerKeyItem,
  ExtractedQuestionRaw,
  ReconciledQuestion,
  Subject,
} from './types';

const PROMPT_VERSION = 'ita-extractor-v1.1';
const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';

const SUBJECT_LIST: Subject[] = [
  'Matemática',
  'Física',
  'Química',
  'Português',
  'Inglês',
  'Redação',
  'Outra',
];

export function computeFileChecksum(filePath: string): string {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY não configurada no ambiente do servidor.');
  }
  return new GoogleGenAI({ apiKey });
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isTransientError(err: any): boolean {
  if (!err) return false;
  const msg = String(err?.message || '').toLowerCase();
  const statusStr = String(err?.status || '').toLowerCase();
  const code = Number(err?.code || err?.status);
  return (
    code === 503 ||
    code === 429 ||
    statusStr === 'unavailable' ||
    statusStr === 'resource_exhausted' ||
    msg.includes('high demand') ||
    msg.includes('unavailable') ||
    msg.includes('resource_exhausted') ||
    msg.includes('503') ||
    msg.includes('429') ||
    msg.includes('rate limit') ||
    msg.includes('quota') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout')
  );
}

function formatFriendlyError(err: any): string {
  if (!err) return 'Erro desconhecido.';
  if (isTransientError(err)) {
    return 'Os servidores da API Gemini estão enfrentando alta demanda temporária (código 503/429). O sistema tentou modelos alternativos com retentativas automáticas, mas não obteve resposta. Por favor, aguarde alguns instantes e tente novamente.';
  }
  const rawMsg = String(err?.message || err);
  try {
    const parsed = JSON.parse(rawMsg);
    if (parsed.error?.message) {
      return parsed.error.message;
    }
  } catch {
    // not JSON
  }
  return rawMsg;
}

async function uploadFileWithRetry(
  ai: GoogleGenAI,
  filePath: string,
  onProgress?: (msg: string) => void
) {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (attempt > 1) {
        onProgress?.(`Retentando upload do PDF para File API (${attempt}/${maxAttempts})...`);
      }
      const uploaded = await ai.files.upload({
        file: filePath,
        config: {
          mimeType: 'application/pdf',
        },
      });
      return uploaded;
    } catch (err: any) {
      console.warn(`[Gemini File API] Tentativa ${attempt} falhou:`, err?.message || err);
      if (isTransientError(err) && attempt < maxAttempts) {
        await sleep(2000 * attempt);
      } else {
        throw err;
      }
    }
  }
  throw new Error('Falha ao enviar arquivo PDF para o Gemini File API após múltiplas tentativas.');
}

async function generateWithRetryAndFallback(
  ai: GoogleGenAI,
  params: {
    contents: any[];
    config: any;
    preferredModel?: string;
    onProgress?: (msg: string) => void;
  }
): Promise<{ text: string; modelUsed: string }> {
  const preferred = params.preferredModel || process.env.GEMINI_MODEL || 'gemini-3.5-flash';
  // Candidate sequence prioritizing preferred model and resilient alternatives
  const candidateModels = Array.from(
    new Set([preferred, 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.8-flash'])
  );

  let lastError: any = null;

  for (const model of candidateModels) {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        params.onProgress?.(
          attempt === 1
            ? `Analisando com modelo ${model}...`
            : `Retentando análise com ${model} (tentativa ${attempt}/${maxAttempts})...`
        );

        const response = await ai.models.generateContent({
          model,
          contents: params.contents,
          config: {
            ...params.config,
            maxOutputTokens: 65536,
          },
        });

        const text = response.text || '[]';
        return { text, modelUsed: model };
      } catch (err: any) {
        lastError = err;
        console.warn(`[Gemini] Falha no modelo ${model} (tentativa ${attempt}/${maxAttempts}):`, err?.message || err);

        if (isTransientError(err) && attempt < maxAttempts) {
          const delayMs = attempt * 3000;
          params.onProgress?.(
            `Servidor ocupado (${model}). Aguardando ${delayMs / 1000}s para retentar...`
          );
          await sleep(delayMs);
        } else {
          // If transient error after max attempts, break loop to try next fallback model
          break;
        }
      }
    }

    params.onProgress?.(`Modelo ${model} com alta demanda. Alternando para modelo de contingência...`);
  }

  // If all models failed, provide a readable academic error message
  throw new Error(formatFriendlyError(lastError));
}

export async function extractExamFromPdf(
  examPdfPath: string,
  modelName = DEFAULT_MODEL,
  onProgress?: (msg: string) => void
): Promise<{ questions: ExtractedQuestionRaw[]; promptVersion: string; model: string }> {
  const ai = getGeminiClient();

  onProgress?.('Enviando caderno de prova para a API Gemini...');
  const uploaded = await uploadFileWithRetry(ai, examPdfPath, onProgress);

  const prompt = `Você é um extrator determinístico de provas de vestibular acadêmico rigoroso (como ITA e IME).
Analise o documento PDF completo da prova e extraia todas as questões com máxima fidelidade e precisão.

Regras estritas:
1. Preserve o enunciado exato de cada questão, incluindo todas as expressões matemáticas, fórmulas e símbolos.
2. Extraia cada alternativa (A, B, C, D, E) quando presentes no texto.
3. Se a questão for discursiva, deixe as alternativas vazias.
4. NUNCA invente gabarito nem deduza qual é a resposta correta. O gabarito não deve ser inferido aqui.
5. Identifique se o enunciado faz referência a figuras, gráficos ou tabelas (ex.: "Figura 1", "esquema abaixo").
6. Classifique a matéria (Matemática, Física, Química, Português, Inglês, Redação ou Outra) e sugira o assunto tópico.
7. Registre o número oficial da questão e a página em que ela aparece no PDF.`;

  if (!uploaded.uri) {
    throw new Error('Falha no upload: URI do arquivo não retornado pela API Gemini.');
  }
  const filePart = createPartFromUri(uploaded.uri, uploaded.mimeType || 'application/pdf');

  try {
    const { text, modelUsed } = await generateWithRetryAndFallback(ai, {
      contents: [filePart, prompt],
      config: {
        responseMimeType: 'application/json',
        responseJsonSchema: {
          type: Type.ARRAY,
          description: 'Lista de questões extraídas do PDF da prova',
          items: {
            type: Type.OBJECT,
            properties: {
              questionNumber: {
                type: Type.INTEGER,
                description: 'Número oficial da questão impresso na prova',
              },
              statement: {
                type: Type.STRING,
                description: 'Enunciado integral e completo da questão',
              },
              alternatives: {
                type: Type.OBJECT,
                description: 'Mapa de alternativas A, B, C, D, E quando múltipla escolha',
                properties: {
                  A: { type: Type.STRING },
                  B: { type: Type.STRING },
                  C: { type: Type.STRING },
                  D: { type: Type.STRING },
                  E: { type: Type.STRING },
                },
              },
              suggestedSubject: {
                type: Type.STRING,
                description: 'Matéria principal: Matemática, Física, Química, Português, Inglês, Redação ou Outra',
              },
              suggestedTopic: {
                type: Type.STRING,
                description: 'Assunto ou tópico específico',
              },
              suggestedDifficulty: {
                type: Type.STRING,
                description: 'Básica, Intermediária ou Avançada',
              },
              referencedFigures: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Menções a figuras, diagramas ou imagens',
              },
              page: {
                type: Type.INTEGER,
                description: 'Número da página no PDF',
              },
              confidence: {
                type: Type.STRING,
                description: 'alta, media ou baixa',
              },
              internalNotes: {
                type: Type.STRING,
                description: 'Observações de formatação ou texto recortado',
              },
            },
            required: ['statement', 'alternatives'],
          },
        },
      },
      preferredModel: modelName,
      onProgress,
    });

    const parsed = JSON.parse(text) as ExtractedQuestionRaw[];
    return {
      questions: Array.isArray(parsed) ? parsed : [],
      promptVersion: PROMPT_VERSION,
      model: modelUsed,
    };
  } finally {
    if (uploaded?.name) {
      try {
        await ai.files.delete({ name: uploaded.name });
      } catch (e) {
        console.warn('Erro ao remover arquivo temporário do File API:', e);
      }
    }
  }
}

export async function extractAnswerKeyFromPdf(
  answerKeyPdfPath: string,
  modelName = DEFAULT_MODEL,
  onProgress?: (msg: string) => void
): Promise<ExtractedAnswerKeyItem[]> {
  const ai = getGeminiClient();

  onProgress?.('Enviando gabarito oficial para a API Gemini...');
  const uploaded = await uploadFileWithRetry(ai, answerKeyPdfPath, onProgress);

  const prompt = `Você é um extrator de gabaritos oficiais de provas.
Analise este documento de gabarito oficial e extraia a tabela de correspondência questão a questão.

Regras estritas:
1. Extraia o número exato da questão e a letra do gabarito oficial (A, B, C, D ou E).
2. Se uma questão foi anulada, defina isCancelledOrAnnulled como true e officialAnswer como nulo.
3. Não invente ou presuma respostas que não estejam explicitamente no documento oficial.`;

  if (!uploaded.uri) {
    throw new Error('Falha no upload: URI do arquivo de gabarito não retornado pela API Gemini.');
  }
  const filePart = createPartFromUri(uploaded.uri, uploaded.mimeType || 'application/pdf');

  try {
    const { text } = await generateWithRetryAndFallback(ai, {
      contents: [filePart, prompt],
      config: {
        responseMimeType: 'application/json',
        responseJsonSchema: {
          type: Type.ARRAY,
          description: 'Tabela oficial de respostas por questão',
          items: {
            type: Type.OBJECT,
            properties: {
              questionNumber: {
                type: Type.INTEGER,
                description: 'Número da questão correspondente',
              },
              officialAnswer: {
                type: Type.STRING,
                description: 'Letra correta da alternativa oficial (A, B, C, D, E) ou nulo se anulada',
              },
              isCancelledOrAnnulled: {
                type: Type.BOOLEAN,
                description: 'Verdadeiro se a questão foi anulada no gabarito oficial',
              },
              notes: {
                type: Type.STRING,
                description: 'Observações do gabarito (ex: recurso deferido)',
              },
            },
            required: ['questionNumber'],
          },
        },
      },
      preferredModel: modelName,
      onProgress,
    });

    const parsed = JSON.parse(text) as ExtractedAnswerKeyItem[];
    return Array.isArray(parsed) ? parsed : [];
  } finally {
    if (uploaded?.name) {
      try {
        await ai.files.delete({ name: uploaded.name });
      } catch (e) {
        console.warn('Erro ao remover arquivo de gabarito temporário do File API:', e);
      }
    }
  }
}

export function reconcileExtractedData(params: {
  rawQuestions: ExtractedQuestionRaw[];
  answerKeys?: ExtractedAnswerKeyItem[];
  examFileName: string;
  examChecksum: string;
  answerKeyChecksum?: string;
  metadata: {
    institution: string;
    year?: number;
    phase?: string;
  };
  promptVersion: string;
  model: string;
}): { questions: ReconciledQuestion[]; reviewQueue: ReconciledQuestion[] } {
  const keyMap = new Map<number, ExtractedAnswerKeyItem>();
  params.answerKeys?.forEach((item) => {
    keyMap.set(item.questionNumber, item);
  });

  const keyCount = params.answerKeys?.length ?? 0;

  /**
   * Casar questão e gabarito pelo ordinal só é legítimo quando as contagens batem: aí cada
   * questão extraída tem exatamente uma linha de gabarito, na mesma ordem, e a correspondência
   * é bijetiva por construção. Fora disso, casar por posição é adivinhação.
   */
  const ordinalMatchSafe = keyCount > 0 && keyCount === params.rawQuestions.length;

  /**
   * A ordem do documento. Só reordenamos quando TODAS as questões têm número — nesse caso a
   * ordenação recupera a posição real mesmo se o modelo devolveu fora de ordem. Se alguma não
   * tem, não há como saber a posição, e inventá-la é exatamente o defeito que este código
   * corrige (duas questões reivindicando o mesmo número e uma herdando o gabarito da outra).
   */
  const allNumbered = params.rawQuestions.every(
    (q) => typeof q.questionNumber === 'number' && Number.isFinite(q.questionNumber)
  );
  const ordered = allNumbered
    ? [...params.rawQuestions].sort(
        (a, b) => (a.questionNumber as number) - (b.questionNumber as number)
      )
    : [...params.rawQuestions];

  /** Número impresso -> ordinal da primeira questão que o reivindicou. */
  const claimedNumbers = new Map<number, number>();

  const questions: ReconciledQuestion[] = [];
  const reviewQueue: ReconciledQuestion[] = [];

  ordered.forEach((raw, idx) => {
    const order = idx + 1;
    const qNum =
      typeof raw.questionNumber === 'number' && Number.isFinite(raw.questionNumber)
        ? raw.questionNumber
        : undefined;

    const alerts: string[] = [];

    // ---- Identidade -------------------------------------------------------
    let duplicateNumber = false;
    if (qNum === undefined) {
      alerts.push(
        'Número da questão não identificado no documento. O ordinal foi registrado em source.order, mas não foi usado como número.'
      );
    } else if (claimedNumbers.has(qNum)) {
      duplicateNumber = true;
      alerts.push(
        `Número ${qNum} duplicado: outra questão já reivindica este número. Gabarito não atribuído por ambiguidade.`
      );
    } else {
      claimedNumbers.set(qNum, order);
    }

    // Clean alternatives
    const cleanAlts: Record<string, string> = {};
    if (raw.alternatives && typeof raw.alternatives === 'object') {
      Object.entries(raw.alternatives).forEach(([k, v]) => {
        if (v && String(v).trim()) {
          cleanAlts[k.toUpperCase().trim()] = String(v).trim();
        }
      });
    }

    const altCount = Object.keys(cleanAlts).length;
    const isDiscursive = altCount === 0;

    if (!isDiscursive && altCount < 2) {
      alerts.push(`Questão possui apenas ${altCount} alternativa identificada.`);
    }

    // Match subject
    const rawSubj = raw.suggestedSubject ?? 'Outra';
    const matchedSubject =
      SUBJECT_LIST.find((s) => s.toLowerCase() === rawSubj.toLowerCase()) ?? 'Outra';

    // Difficulty
    const rawDiff = (raw.suggestedDifficulty ?? 'Intermediária').toLowerCase();
    const difficulty: Difficulty =
      rawDiff.includes('bás') || rawDiff.includes('fac')
        ? 'Básica'
        : rawDiff.includes('avan') || rawDiff.includes('dif')
        ? 'Avançada'
        : 'Intermediária';

    // Check figures
    const figures = Array.isArray(raw.referencedFigures) ? raw.referencedFigures : [];
    if (figures.length > 0) {
      alerts.push(`Referencia figura(s): ${figures.join(', ')}. Verifique o diagrama no PDF original.`);
    }

    // ---- Gabarito oficial ------------------------------------------------
    let officialKeyItem: ExtractedAnswerKeyItem | undefined;
    if (qNum !== undefined && !duplicateNumber) {
      officialKeyItem = keyMap.get(qNum);
    } else if (qNum === undefined && ordinalMatchSafe) {
      officialKeyItem = keyMap.get(order);
    } else if (qNum === undefined && keyCount > 0) {
      alerts.push(
        `Gabarito não atribuído: a questão não tem número e a contagem não permite casar por ordem (${params.rawQuestions.length} extraídas, ${keyCount} no gabarito).`
      );
    }

    let answerKey: string | undefined;
    let hasOfficialKey = false;
    let officialSource: string | undefined;

    if (officialKeyItem) {
      if (officialKeyItem.isCancelledOrAnnulled) {
        alerts.push('Questão anulada no gabarito oficial.');
      } else if (officialKeyItem.officialAnswer) {
        const letter = officialKeyItem.officialAnswer.toUpperCase().trim();
        hasOfficialKey = true;
        officialSource = 'Gabarito Oficial';
        if (cleanAlts[letter]) {
          answerKey = letter;
        } else {
          alerts.push(`Gabarito oficial indica "${letter}", mas a alternativa não foi identificada no texto.`);
          answerKey = letter;
        }
      }
    } else if (params.answerKeys && params.answerKeys.length > 0 && qNum !== undefined && !duplicateNumber) {
      alerts.push('Não foi encontrado gabarito oficial para esta questão no arquivo de gabarito.');
    }

    if (raw.confidence === 'baixa') {
      alerts.push('Baixa confiança do modelo na extração do enunciado.');
    }

    const validationState: ReconciledQuestion['validationState'] =
      alerts.length === 0 ? 'valida' : !raw.statement?.trim() ? 'incompleta' : 'com_alertas';

    const reconciled: ReconciledQuestion = {
      // Id determinístico: o mesmo documento reprocessado produz os mesmos ids, o que torna
      // possível reconciliar uma re-extração em vez de acumular duplicatas. Sem `Date.now()`.
      id: `gemini-${slugify(params.metadata.institution)}-${params.metadata.year ?? 'ano'}-${slugify(
        params.metadata.phase ?? 'fase'
      )}-o${order}`,
      subject: matchedSubject,
      topic: raw.suggestedTopic?.trim() || 'Assunto sugerido por IA',
      difficulty,
      statement: raw.statement.trim(),
      alternatives: cleanAlts,
      answerKey,
      explanation: isDiscursive ? 'Questão discursiva' : undefined,
      source: {
        label: params.metadata.institution,
        year: params.metadata.year,
        phase: params.metadata.phase,
        // Numero reivindicado por outra questao nao e identidade confiavel: fica nulo e o
        // ordinal responde por ela. Mantem a invariante "um numero, uma questao".
        questionNumber: duplicateNumber ? undefined : qNum,
        order,
        fileName: params.examFileName,
        page: raw.page,
        checksum: params.examChecksum,
        answerKeyChecksum: params.answerKeyChecksum,
        promptVersion: params.promptVersion,
        model: params.model,
        gabaritoOficialSource: officialSource,
      },
      tags: [params.metadata.institution.toLowerCase(), `ano-${params.metadata.year ?? 'nd'}`],
      createdAt: new Date().toISOString(),
      validationState,
      alerts,
      hasOfficialKey,
      referencedFigures: figures,
    };

    questions.push(reconciled);

    if (validationState !== 'valida') {
      reviewQueue.push(reconciled);
    }
  });

  return { questions, reviewQueue };
}

/** ASCII, minúsculo, hifenizado — para compor ids estáveis. */
function slugify(value: string): string {
  return (
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'nd'
  );
}
