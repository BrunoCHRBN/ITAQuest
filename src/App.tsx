import { useEffect, useState } from 'react';
import { Menu, Search } from 'lucide-react';
import { seedQuestions } from './data/seed';
import type { ImportBatch, Notice, Question, ResponseRecord, StudySession, View } from './types';

// Services
import {
  initializeStorageMigration,
  onStorageError,
  readStorage,
  STORAGE_KEYS,
  writeStorage,
} from './services/storageService';
import { deduplicateQuestions, emptyResponse, revalidateQuestion, uid } from './services/questionService';
import type { DedupConflict } from './services/questionService';
import { downloadJsonFile } from './services/backupService';
import { makeImportBatch, undoBatch } from './services/batchService';

// Layout & Common Components
import { Sidebar } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { AppFooter } from './components/layout/AppFooter';
import { NoticeToast } from './components/common/NoticeToast';

// Modals
import { CreateSessionModal } from './components/modals/CreateSessionModal';
import { AddQuestionModal } from './components/modals/AddQuestionModal';
import { ImportModal } from './components/modals/ImportModal';
import { BackupModal } from './components/modals/BackupModal';
import { GeminiImportModal } from './components/modals/GeminiImportModal';
import { ImportConflictsModal } from './components/modals/ImportConflictsModal';

// Views
import { OverviewPage } from './components/views/OverviewPage';
import { BankPage } from './components/views/BankPage';
import { SessionsPage } from './components/views/SessionsPage';
import { ResolverPage } from './components/views/ResolverPage';
import { ResultsPage } from './components/views/ResultsPage';
import { ReviewsPage } from './components/views/ReviewsPage';
import { StatsPage } from './components/views/StatsPage';

// Run storage schema check / migration on startup
initializeStorageMigration();

export function App() {
  const [questions, setQuestions] = useState<Question[]>(() =>
    readStorage(STORAGE_KEYS.questions, seedQuestions)
  );
  const [sessions, setSessions] = useState<StudySession[]>(() =>
    readStorage(STORAGE_KEYS.sessions, [])
  );
  const [batches, setBatches] = useState<ImportBatch[]>(() =>
    readStorage(STORAGE_KEYS.batches, [])
  );
  const [view, setView] = useState<View>('overview');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [resultSessionId, setResultSessionId] = useState<string | null>(null);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [modal, setModal] = useState<
    'session' | 'question' | 'import' | 'backup' | 'gemini' | 'conflicts' | null
  >(null);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [pendingImport, setPendingImport] = useState<{
    fresh: Question[];
    duplicatesCount: number;
    conflicts: DedupConflict[];
    warnings: string[];
  } | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [tick, setTick] = useState(Date.now());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Subscribe to storage error events (e.g. QuotaExceededError or corrupted data)
  useEffect(() => {
    const unsubscribe = onStorageError((err) => {
      notify(err.message, 'error');
    });
    return unsubscribe;
  }, []);

  // Persist state changes
  useEffect(() => {
    writeStorage(STORAGE_KEYS.questions, questions);
  }, [questions]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.sessions, sessions);
  }, [sessions]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.batches, batches);
  }, [batches]);

  // Timer tick for resolver
  useEffect(() => {
    if (view !== 'resolver') return;
    const interval = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [view]);

  // Notice auto-dismiss
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;
  const resultSession = sessions.find((s) => s.id === resultSessionId) ?? null;

  // Check timeout in simulado mode
  useEffect(() => {
    if (
      view === 'resolver' &&
      activeSession?.mode === 'simulado' &&
      activeSession?.timerMinutes &&
      activeSession.startedAt &&
      activeSession.status === 'em_andamento'
    ) {
      const elapsed = Math.floor((tick - new Date(activeSession.startedAt).getTime()) / 1000);
      const remaining = activeSession.timerMinutes * 60 - elapsed;
      if (remaining <= 0) {
        finishSession(activeSession.id, true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, view, activeSession?.id, activeSession?.status]);

  function notify(text: string, type: Notice['type'] = 'success') {
    setNotice({ text, type });
  }

  function navigate(next: View) {
    setView(next);
    setMobileMenuOpen(false);
  }

  function updateSession(id: string, updater: (session: StudySession) => StudySession) {
    setSessions((prev) => prev.map((s) => (s.id === id ? updater(s) : s)));
  }

  function updateResponse(questionId: string, updater: (response: ResponseRecord) => ResponseRecord) {
    if (!activeSession) return;
    updateSession(activeSession.id, (s) => ({
      ...s,
      responses: {
        ...s.responses,
        [questionId]: updater(s.responses[questionId] ?? emptyResponse()),
      },
    }));
  }

  function handleCreateSession(params: {
    title: string;
    mode: StudySession['mode'];
    timeLimitMinutes?: number;
    questionIds: string[];
    startNow: boolean;
  }) {
    const startedAt = params.startNow ? new Date().toISOString() : undefined;
    const session: StudySession = {
      id: uid('session'),
      title: params.title,
      mode: params.mode,
      status: params.startNow ? 'em_andamento' : 'planejada',
      questionIds: params.questionIds,
      responses: {},
      currentIndex: 0,
      createdAt: new Date().toISOString(),
      startedAt,
      timerMinutes: params.timeLimitMinutes,
    };

    setSessions((prev) => [session, ...prev]);
    setActiveSessionId(session.id);
    setSelectedQuestionIds([]);
    setModal(null);

    if (params.startNow) {
      navigate('resolver');
    } else {
      navigate('sessions');
    }

    notify(
      params.startNow
        ? 'Sessão iniciada. Suas respostas serão salvas neste navegador.'
        : 'Sessão planejada com sucesso.'
    );
  }

  function resumeSession(session: StudySession) {
    if (session.status === 'concluída') {
      setResultSessionId(session.id);
      navigate('results');
      return;
    }
    setActiveSessionId(session.id);
    updateSession(session.id, (s) => ({
      ...s,
      status: 'em_andamento',
      startedAt: s.startedAt ?? new Date().toISOString(),
    }));
    navigate('resolver');
  }

  function startSingleQuestion(questionId: string) {
    const question = questions.find((q) => q.id === questionId);
    if (!question) return;

    const session: StudySession = {
      id: uid('session'),
      title: `${question.subject} · ${question.topic}`,
      mode: 'treino',
      status: 'em_andamento',
      questionIds: [questionId],
      responses: {},
      currentIndex: 0,
      createdAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
    };

    setSessions((prev) => [session, ...prev]);
    setActiveSessionId(session.id);
    navigate('resolver');
  }

  function finishSession(id: string, byTimeout = false) {
    const existing = sessions.find((s) => s.id === id);
    if (!existing || existing.status === 'concluída') return;

    const finished: StudySession = {
      ...existing,
      status: 'concluída',
      finishedAt: new Date().toISOString(),
      elapsedSeconds: existing.startedAt
        ? Math.floor((Date.now() - new Date(existing.startedAt).getTime()) / 1000)
        : 0,
    };

    setSessions((prev) => prev.map((s) => (s.id === id ? finished : s)));
    setResultSessionId(id);
    navigate('results');

    if (byTimeout) {
      notify('Tempo encerrado. O simulado foi finalizado automaticamente.', 'info');
    } else {
      notify('Sessão finalizada. Seu resultado já está disponível.');
    }
  }

  function notifyImport(
    freshCount: number,
    duplicatesCount: number,
    replacedCount: number,
    warnings: string[]
  ) {
    let msg = `${freshCount} questão(ões) importada(s).`;
    if (replacedCount > 0) msg += ` ${replacedCount} substituída(s) pela versão do arquivo.`;
    if (duplicatesCount > 0) msg += ` ${duplicatesCount} idêntica(s) ignorada(s).`;
    if (warnings.length > 0) msg += ` ${warnings.length} alerta(s) estruturais registrados.`;
    notify(msg, warnings.length ? 'info' : 'success');
  }

  function makeBatch(
    id: string,
    representative: Question[],
    created: string[],
    replaced: Array<{ id: string; previous: Question }>
  ): ImportBatch {
    return makeImportBatch({ id, representative, created, replaced });
  }

  function handleImportQuestions(incoming: Question[], warnings: string[]) {
    const { fresh, duplicatesCount, conflicts } = deduplicateQuestions(questions, incoming);

    // Questões idênticas ao que já existe são ignoradas em silêncio (nada se perde). Questões
    // divergentes NÃO: a versão do arquivo pode ser a correção, e descartá-la foi o defeito que
    // tornava a fila de revisão um beco sem saída.
    if (conflicts.length > 0) {
      setPendingImport({ fresh, duplicatesCount, conflicts, warnings });
      setModal('conflicts');
      return;
    }

    const batchId = uid('batch');
    const stamped = fresh.map((q) => ({ ...q, batchId }));

    setQuestions((prev) => [...stamped, ...prev]);
    setBatches((prev) => [makeBatch(batchId, stamped, stamped.map((q) => q.id), []), ...prev].slice(0, 50));
    setModal(null);
    notifyImport(fresh.length, duplicatesCount, 0, warnings);
  }

  function applyImportDecisions(decisions: Record<string, 'replace' | 'keep'>) {
    if (!pendingImport) return;
    const { fresh, duplicatesCount, conflicts, warnings } = pendingImport;

    const replacements = new Map<string, Question>();
    conflicts.forEach((c) => {
      if (decisions[c.existingId] === 'replace') replacements.set(c.existingId, c.incoming);
    });

    const batchId = uid('batch');
    const created = fresh.map((q) => ({ ...q, batchId }));
    const replaced: Array<{ id: string; previous: Question }> = [];

    const merged = questions.map((q) => {
      const incoming = replacements.get(q.id);
      if (!incoming) return q;
      // A versão anterior fica guardada no lote: sem isso, "desfazer" não seria desfazer.
      replaced.push({ id: q.id, previous: q });
      // Preserva o id e a data: sessões e respostas já gravadas apontam para este id.
      return revalidateQuestion({ ...incoming, id: q.id, createdAt: q.createdAt, batchId });
    });

    setQuestions([...created, ...merged]);
    setBatches((prev) => [
      makeBatch(
        batchId,
        [...created, ...conflicts.map((c) => c.incoming)],
        created.map((q) => q.id),
        replaced
      ),
      ...prev,
    ].slice(0, 50));

    setPendingImport(null);
    setModal(null);
    notifyImport(fresh.length, duplicatesCount, replacements.size, warnings);
  }

  function undoLastImport() {
    const last = batches[0];
    if (!last) return;

    const createdIds = new Set(last.created);

    setQuestions((prev) => undoBatch(prev, last));
    setBatches((prev) => prev.slice(1));
    setSelectedQuestionIds((prev) => prev.filter((id) => !createdIds.has(id)));

    notify(
      `Importação de ${new Date(last.createdAt).toLocaleString('pt-BR')} desfeita: ${
        last.created.length
      } questão(ões) removida(s)${
        last.replaced.length ? `, ${last.replaced.length} restaurada(s) à versão anterior` : ''
      }.`,
      'info'
    );
  }

  function handleAddQuestion(question: Question) {
    setQuestions((prev) => [question, ...prev]);
    setModal(null);
    notify('Questão adicionada ao banco.');
  }

  function handleUpdateQuestion(updated: Question) {
    setQuestions((prev) => prev.map((q) => (q.id === updated.id ? updated : q)));
    setModal(null);
    setEditingQuestion(null);
    notify(
      updated.validationState === 'com_alertas'
        ? 'Questão atualizada. Ainda há alertas pendentes nesta questão.'
        : 'Questão atualizada e revalidada.',
      updated.validationState === 'com_alertas' ? 'info' : 'success'
    );
  }

  function handleClearQuestions() {
    setQuestions([]);
    setSelectedQuestionIds([]);
    writeStorage(STORAGE_KEYS.questions, []);
    notify('Banco de questões zerado com sucesso. Pronto para a inserção de novos dados.', 'info');
  }

  function handleRestoreApplied(params: {
    questions: Question[];
    sessions: StudySession[];
    message: string;
  }) {
    setQuestions(params.questions);
    setSessions(params.sessions);
    setModal(null);
    notify(params.message, 'success');
  }

  function exportQuestionsOnly() {
    downloadJsonFile({ questions }, 'itaquest-questoes.json');
    notify('Exportação das questões iniciada.');
  }

  const reviewCount = sessions.flatMap((s) =>
    s.questionIds.filter((id) => s.responses[id]?.markedForReview)
  ).length;

  const renderView = () => {
    switch (view) {
      case 'overview':
        return (
          <OverviewPage
            questions={questions}
            sessions={sessions}
            onNavigate={navigate}
            onOpenSessionModal={() => setModal('session')}
            onResumeSession={resumeSession}
          />
        );
      case 'bank':
        return (
          <BankPage
            questions={questions}
            sessions={sessions}
            selectedQuestionIds={selectedQuestionIds}
            onToggleSelect={(id) =>
              setSelectedQuestionIds((prev) =>
                prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
              )
            }
            onClearSelection={() => setSelectedQuestionIds([])}
            onStartSingleQuestion={startSingleQuestion}
            onOpenSessionModal={(ids) => {
              if (ids) setSelectedQuestionIds(ids);
              setModal('session');
            }}
            onOpenImportModal={() => setModal('import')}
            onOpenGeminiModal={() => setModal('gemini')}
            onOpenAddQuestionModal={() => setModal('question')}
            onEditQuestion={(question) => {
              setEditingQuestion(question);
              setModal('question');
            }}
            onExportQuestions={exportQuestionsOnly}
            onClearQuestions={handleClearQuestions}
            lastBatch={batches[0] ?? null}
            onUndoImport={undoLastImport}
          />
        );
      case 'sessions':
        return (
          <SessionsPage
            sessions={sessions}
            onOpenSessionModal={() => setModal('session')}
            onResumeSession={resumeSession}
          />
        );
      case 'resolver':
        if (!activeSession) {
          return (
            <div className="empty-state">
              <h3>Nenhuma sessão aberta</h3>
              <p>Crie uma sessão antes de começar a resolver.</p>
              <button className="button button-primary" onClick={() => setModal('session')}>
                Criar sessão
              </button>
            </div>
          );
        }
        return (
          <ResolverPage
            session={activeSession}
            questions={questions}
            tick={tick}
            onExit={() => navigate('sessions')}
            onFinishSession={finishSession}
            onUpdateSession={updateSession}
            onUpdateResponse={updateResponse}
            onNotify={notify}
          />
        );
      case 'results':
        return (
          <ResultsPage
            resultSession={resultSession}
            questions={questions}
            onNavigate={navigate}
            onStartSingleQuestion={startSingleQuestion}
            onOpenSessionModal={(ids) => {
              setSelectedQuestionIds(ids);
              setModal('session');
            }}
            onNotify={notify}
          />
        );
      case 'reviews':
        return (
          <ReviewsPage
            questions={questions}
            sessions={sessions}
            onNavigate={navigate}
            onStartSingleQuestion={startSingleQuestion}
            onOpenSessionModal={(ids) => {
              setSelectedQuestionIds(ids);
              setModal('session');
            }}
            onNotify={notify}
          />
        );
      case 'stats':
        return (
          <StatsPage
            questions={questions}
            sessions={sessions}
            onExportQuestions={exportQuestionsOnly}
          />
        );
    }
  };

  return (
    <div className="app-shell">
      <Sidebar
        currentView={view}
        mobileMenuOpen={mobileMenuOpen}
        reviewCount={reviewCount}
        onNavigate={navigate}
        onCloseMobile={() => setMobileMenuOpen(false)}
        onSettingsClick={() =>
          notify(
            'As configurações avançadas e sincronização serão adicionadas nas próximas etapas.',
            'info'
          )
        }
        onBackupClick={() => setModal('backup')}
      />

      {mobileMenuOpen && (
        <button
          className="mobile-scrim"
          aria-label="Fechar menu"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <main className={`main-area ${view === 'resolver' ? 'main-resolver' : ''}`}>
        <div className="mobile-topbar">
          <button
            className="icon-button"
            aria-label="Abrir menu"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu size={20} />
          </button>
          <div className="mobile-brand">
            rotina <b>ITA</b>
          </div>
          <button
            className="icon-button"
            aria-label="Banco de questões"
            onClick={() => navigate('bank')}
          >
            <Search size={18} />
          </button>
        </div>

        {view !== 'resolver' && (
          <TopBar
            currentView={view}
            onHelpClick={() =>
              notify(
                'ITAQuest: os dados são armazenados neste navegador. Use o botão de Backup para exportar ou restaurar todos os seus dados.',
                'info'
              )
            }
            onBackupClick={() => setModal('backup')}
          />
        )}

        <div className={`page-content ${view === 'resolver' ? 'page-content-resolver' : ''}`}>
          {renderView()}
        </div>

        {view !== 'resolver' && <AppFooter />}
      </main>

      {/* Modals */}
      {modal === 'session' && (
        <CreateSessionModal
          questions={questions}
          initialSelectedIds={selectedQuestionIds}
          onClose={() => setModal(null)}
          onCreate={handleCreateSession}
        />
      )}

      {modal === 'question' && (
        <AddQuestionModal
          question={editingQuestion ?? undefined}
          onClose={() => {
            setModal(null);
            setEditingQuestion(null);
          }}
          onSave={editingQuestion ? handleUpdateQuestion : handleAddQuestion}
          onError={(msg) => notify(msg, 'error')}
        />
      )}

      {modal === 'conflicts' && pendingImport && (
        <ImportConflictsModal
          conflicts={pendingImport.conflicts}
          freshCount={pendingImport.fresh.length}
          identicalCount={pendingImport.duplicatesCount}
          onClose={() => {
            setPendingImport(null);
            setModal(null);
          }}
          onApply={applyImportDecisions}
        />
      )}

      {modal === 'import' && (
        <ImportModal
          onClose={() => setModal(null)}
          onImport={handleImportQuestions}
          onError={(msg) => notify(msg, 'error')}
        />
      )}

      {modal === 'backup' && (
        <BackupModal
          questions={questions}
          sessions={sessions}
          onClose={() => setModal(null)}
          onRestoreApplied={handleRestoreApplied}
          onError={(msg) => notify(msg, 'error')}
          onClearQuestions={handleClearQuestions}
        />
      )}

      {modal === 'gemini' && (
        <GeminiImportModal
          knownChecksums={questions
            .map((q) => q.source.checksum)
            .filter((c): c is string => Boolean(c))}
          onClose={() => setModal(null)}
          onImport={handleImportQuestions}
          onError={(msg) => notify(msg, 'error')}
        />
      )}

      {/* Notifications */}
      {notice && <NoticeToast notice={notice} onClose={() => setNotice(null)} />}
    </div>
  );
}

export default App;
