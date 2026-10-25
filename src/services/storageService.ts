export const STORAGE_KEYS = {
  questions: 'itaquest.questions.v1',
  sessions: 'itaquest.sessions.v1',
  batches: 'itaquest.batches.v1',
  schemaVersion: 'itaquest.schema_version',
} as const;

const LEGACY_STORAGE_KEYS = {
  questions: 'rotina-ita.questions.v1',
  sessions: 'rotina-ita.sessions.v1',
  batches: 'rotina-ita.batches.v1',
  schemaVersion: 'rotina-ita.schema_version',
} as const;

export const CURRENT_SCHEMA_VERSION = 2;

export type StorageErrorType = 'quota_exceeded' | 'corrupt_data' | 'access_denied' | 'unknown';

export interface StorageError {
  type: StorageErrorType;
  message: string;
  originalError?: unknown;
}

type StorageErrorListener = (error: StorageError) => void;
const listeners = new Set<StorageErrorListener>();

export function onStorageError(listener: StorageErrorListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyStorageError(error: StorageError) {
  listeners.forEach((listener) => {
    try {
      listener(error);
    } catch {
      // ignore errors in listeners
    }
  });
}

function isQuotaExceededError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { name?: string; code?: number; number?: number };
  return (
    e.name === 'QuotaExceededError' ||
    e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    e.code === 22 ||
    e.code === 1014 ||
    e.number === -2147024882
  );
}

export function readStorage<T>(key: string, fallback: T): T {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return fallback;
    }
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (error) {
    // If JSON is corrupt, preserve raw data to prevent total data loss
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = localStorage.getItem(key);
        if (raw) {
          localStorage.setItem(`${key}.corrupt_backup.${Date.now()}`, raw);
        }
      }
    } catch {
      // ignore secondary storage attempt
    }

    notifyStorageError({
      type: 'corrupt_data',
      message: `Os dados salvos para a chave "${key}" estavam corrompidos. Uma cópia de segurança foi criada e os dados padrão foram recuperados.`,
      originalError: error,
    });
    return fallback;
  }
}

export function writeStorage<T>(key: string, value: T): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }
    const serialized = JSON.stringify(value);
    localStorage.setItem(key, serialized);
    return true;
  } catch (error) {
    if (isQuotaExceededError(error)) {
      notifyStorageError({
        type: 'quota_exceeded',
        message: 'O armazenamento local do seu navegador está esgotado. Exporte um backup JSON e limpe itens desnecessários.',
        originalError: error,
      });
    } else {
      notifyStorageError({
        type: 'unknown',
        message: `Não foi possível salvar os dados locais para "${key}".`,
        originalError: error,
      });
    }
    return false;
  }
}

export function clearQuestionsStorage(): boolean {
  return writeStorage(STORAGE_KEYS.questions, []);
}

export function initializeStorageMigration() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;

    // Migração de chaves do prefixo legado "rotina-ita" para "itaquest"
    if (localStorage.getItem(STORAGE_KEYS.questions) === null && localStorage.getItem(LEGACY_STORAGE_KEYS.questions) !== null) {
      const legacyQ = localStorage.getItem(LEGACY_STORAGE_KEYS.questions);
      const legacyS = localStorage.getItem(LEGACY_STORAGE_KEYS.sessions);
      const legacyB = localStorage.getItem(LEGACY_STORAGE_KEYS.batches);
      const legacyV = localStorage.getItem(LEGACY_STORAGE_KEYS.schemaVersion);

      if (legacyQ !== null) localStorage.setItem(STORAGE_KEYS.questions, legacyQ);
      if (legacyS !== null) localStorage.setItem(STORAGE_KEYS.sessions, legacyS);
      if (legacyB !== null) localStorage.setItem(STORAGE_KEYS.batches, legacyB);
      if (legacyV !== null) localStorage.setItem(STORAGE_KEYS.schemaVersion, legacyV);
    }

    const currentVersionStr = localStorage.getItem(STORAGE_KEYS.schemaVersion);
    const version = currentVersionStr ? parseInt(currentVersionStr, 10) : 0;

    if (version < CURRENT_SCHEMA_VERSION) {
      if (version < 2) {
        // Migration v2: Zerar banco de questões sintéticas para início da inserção de dados reais
        localStorage.setItem(STORAGE_KEYS.questions, JSON.stringify([]));
      }
      localStorage.setItem(STORAGE_KEYS.schemaVersion, String(CURRENT_SCHEMA_VERSION));
    }
  } catch (error) {
    notifyStorageError({
      type: 'access_denied',
      message: 'Não foi possível verificar ou atualizar a versão do armazenamento local.',
      originalError: error,
    });
  }
}
