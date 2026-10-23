import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  initializeStorageMigration,
  onStorageError,
  readStorage,
  STORAGE_KEYS,
  writeStorage,
} from '../services/storageService';

describe('storageService', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('reads and writes data successfully to localStorage', () => {
    const data = [{ id: 'q1', text: 'teste' }];
    const success = writeStorage('test.key', data);
    expect(success).toBe(true);

    const retrieved = readStorage('test.key', []);
    expect(retrieved).toEqual(data);
  });

  it('returns fallback and creates corrupt backup when stored JSON is invalid', () => {
    localStorage.setItem('corrupted.key', '{ invalid-json-string');

    let notifiedError: any = null;
    const unsub = onStorageError((err) => {
      notifiedError = err;
    });

    const fallback = { fallback: true };
    const result = readStorage('corrupted.key', fallback);

    expect(result).toEqual(fallback);
    expect(notifiedError).not.toBeNull();
    expect(notifiedError.type).toBe('corrupt_data');

    // Confirm that a backup was written to preserve data
    const keys = Object.keys(localStorage);
    expect(keys.some((k) => k.startsWith('corrupted.key.corrupt_backup.'))).toBe(true);

    unsub();
  });

  it('handles QuotaExceededError notifying listeners with helpful guidance', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      const quotaErr = new Error('QuotaExceededError');
      quotaErr.name = 'QuotaExceededError';
      throw quotaErr;
    });

    let caughtError: any = null;
    const unsub = onStorageError((err) => {
      caughtError = err;
    });

    const success = writeStorage('large.data', { data: 'huge' });
    expect(success).toBe(false);
    expect(caughtError).not.toBeNull();
    expect(caughtError.type).toBe('quota_exceeded');
    expect(caughtError.message).toContain('armazenamento local do seu navegador está esgotado');

    unsub();
  });

  it('initializes schema version correctly', () => {
    initializeStorageMigration();
    expect(localStorage.getItem(STORAGE_KEYS.schemaVersion)).toBe('2');
  });

  it('migrates schema from version < 2 by resetting questions storage to empty', () => {
    localStorage.setItem(STORAGE_KEYS.schemaVersion, '1');
    localStorage.setItem(STORAGE_KEYS.questions, JSON.stringify([{ id: 'old-demo-1' }]));

    initializeStorageMigration();

    expect(localStorage.getItem(STORAGE_KEYS.schemaVersion)).toBe('2');
    const questions = JSON.parse(localStorage.getItem(STORAGE_KEYS.questions) ?? 'null');
    expect(questions).toEqual([]);
  });
});
