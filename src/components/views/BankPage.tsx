import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Database,
  Download,
  Eye,
  Filter,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trash2,
  Undo2,
  Upload,
  X,
} from 'lucide-react';
import type {
  ImportBatch,
  Question,
  QuestionFilters,
  QuestionSortOption,
  QuestionStatusFilter,
  QuestionValidationFilter,
  StudySession,
} from '../../types';
import { PageHeader } from '../layout/PageHeader';
import { QuestionRow } from '../question/QuestionRow';
import { QuestionPreviewModal } from '../modals/QuestionPreviewModal';
import { DIFFICULTIES, filterQuestions, SUBJECTS } from '../../services/questionService';
import { getQuestionResolutionMap } from '../../services/scoringService';

interface BankPageProps {
  questions: Question[];
  sessions?: StudySession[];
  selectedQuestionIds: string[];
  onToggleSelect: (id: string) => void;
  onClearSelection: () => void;
  onStartSingleQuestion: (id: string) => void;
  onOpenSessionModal: (ids?: string[]) => void;
  onOpenImportModal: () => void;
  onOpenGeminiModal?: () => void;
  onOpenAddQuestionModal: () => void;
  onEditQuestion?: (question: Question) => void;
  onExportQuestions: () => void;
  onClearQuestions?: () => void;
  lastBatch?: ImportBatch | null;
  onUndoImport?: () => void;
}

export function BankPage({
  questions,
  sessions = [],
  selectedQuestionIds,
  onToggleSelect,
  onClearSelection,
  onStartSingleQuestion,
  onOpenSessionModal,
  onOpenImportModal,
  onOpenGeminiModal,
  onOpenAddQuestionModal,
  onEditQuestion,
  onExportQuestions,
  onClearQuestions,
  lastBatch,
  onUndoImport,
}: BankPageProps) {
  const [query, setQuery] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('Todas');
  const [topicFilter, setTopicFilter] = useState('Todos');
  const [yearFilter, setYearFilter] = useState('Todos');
  const [difficultyFilter, setDifficultyFilter] = useState('Todas');
  const [sourceFilter, setSourceFilter] = useState('Todas');
  const [statusFilter, setStatusFilter] = useState<QuestionStatusFilter>('todas');
  const [validationFilter, setValidationFilter] = useState<QuestionValidationFilter>('todas');
  const [sortBy, setSortBy] = useState<QuestionSortOption>('recentes');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // Broad preview modal state
  const [previewQuestion, setPreviewQuestion] = useState<Question | null>(null);

  // Resolution status map computed from student's session history
  const statusMap = useMemo(() => {
    return getQuestionResolutionMap(sessions, questions);
  }, [sessions, questions]);

  // Dynamic filter options extracted from existing questions
  const availableSources = useMemo(() => {
    return Array.from(new Set(questions.map((q) => q.source.label))).filter(Boolean);
  }, [questions]);

  const availableYears = useMemo(() => {
    const years = questions
      .map((q) => q.source.year)
      .filter((y): y is number => typeof y === 'number' && !isNaN(y));
    return Array.from(new Set(years)).sort((a, b) => b - a);
  }, [questions]);

  const availableTopics = useMemo(() => {
    const list = subjectFilter !== 'Todas'
      ? questions.filter((q) => q.subject === subjectFilter)
      : questions;
    return Array.from(new Set(list.map((q) => q.topic))).filter(Boolean).sort();
  }, [questions, subjectFilter]);

  // Filtered and sorted questions
  const filteredQuestions = useMemo(() => {
    return filterQuestions(
      questions,
      {
        query,
        subject: subjectFilter,
        difficulty: difficultyFilter,
        source: sourceFilter,
        year: yearFilter,
        topic: topicFilter,
        status: statusFilter,
        validation: validationFilter,
        sortBy,
      },
      statusMap
    );
  }, [questions, query, subjectFilter, difficultyFilter, sourceFilter, yearFilter, topicFilter, statusFilter, validationFilter, sortBy, statusMap]);

  // Reset page when filters change
  const handleQueryChange = (val: string) => {
    setQuery(val);
    setPage(1);
  };

  const handleSubjectChange = (val: string) => {
    setSubjectFilter(val);
    setTopicFilter('Todos');
    setPage(1);
  };

  const handleClearFilters = () => {
    setSubjectFilter('Todas');
    setTopicFilter('Todos');
    setYearFilter('Todos');
    setDifficultyFilter('Todas');
    setSourceFilter('Todas');
    setStatusFilter('todas');
    setValidationFilter('todas');
    setSortBy('recentes');
    setPage(1);
  };

  const handleClearAllSearch = () => {
    setQuery('');
    handleClearFilters();
  };

  const activeFiltersCount = [
    Boolean(query.trim()),
    subjectFilter !== 'Todas',
    topicFilter !== 'Todos',
    yearFilter !== 'Todos',
    difficultyFilter !== 'Todas',
    sourceFilter !== 'Todas',
    statusFilter !== 'todas',
    validationFilter !== 'todas',
    sortBy !== 'recentes',
  ].filter(Boolean).length;

  // Pendências de validação: o que a extração sinalizou e ninguém conferiu ainda.
  const triage = useMemo(
    () => ({
      comAlertas: questions.filter((q) => (q.alerts?.length ?? 0) > 0).length,
      semGabarito: questions.filter((q) => !q.answerKey).length,
      comFigura: questions.filter((q) => (q.referencedFigures?.length ?? 0) > 0).length,
    }),
    [questions]
  );
  const triageTotal = triage.comAlertas + triage.semGabarito + triage.comFigura;

  // Pagination slicing
  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(filteredQuestions.length / pageSize)) : 1;
  const safePage = Math.min(page, totalPages);
  const pagedQuestions = useMemo(() => {
    if (pageSize === 0) return filteredQuestions;
    const start = (safePage - 1) * pageSize;
    return filteredQuestions.slice(start, start + pageSize);
  }, [filteredQuestions, safePage, pageSize]);

  return (
    <>
      <PageHeader
        eyebrow="ACERVO DE ESTUDO"
        title="Banco de questões"
        subtitle="Encontre a próxima questão, filtre com precisão e monte sessões deliberadas."
        actions={
          <>
            {onOpenGeminiModal && (
              <button
                type="button"
                className="button button-primary"
                onClick={onOpenGeminiModal}
                title="Extrair caderno de prova em PDF com IA Gemini"
              >
                <Upload size={16} /> Extrair Prova PDF (IA)
              </button>
            )}
            <button
              type="button"
              className="button button-secondary"
              onClick={onOpenImportModal}
              title="Importar questões de arquivo JSON ou CSV"
            >
              <Upload size={16} /> Importar JSON/CSV
            </button>
            <button
              type="button"
              className="button button-secondary"
              onClick={onOpenAddQuestionModal}
              title="Cadastrar questão avulsa"
            >
              <Plus size={17} /> Nova questão
            </button>
            {questions.length > 0 && onClearQuestions && (
              <button
                type="button"
                className="button button-secondary"
                style={{ color: '#9a4c38', borderColor: '#e4c4be' }}
                onClick={() => {
                  const confirmed = window.confirm(
                    `Tem certeza de que deseja zerar todas as ${questions.length} questão(ões) do banco local? Essa ação não pode ser desfeita.`
                  );
                  if (confirmed) onClearQuestions();
                }}
                title="Zerar todas as questões do banco local"
              >
                <Trash2 size={16} /> Zerar banco
              </button>
            )}
          </>
        }
      />

      {/* Triage strip: what the extraction flagged and nobody checked yet */}
      {questions.length > 0 && triageTotal > 0 && (
        <div className="triage-strip" role="status">
          <span className="triage-title">
            <AlertTriangle size={15} /> Triagem pendente
          </span>
          <div className="triage-actions">
            {triage.comAlertas > 0 && (
              <button
                type="button"
                className={`triage-chip ${validationFilter === 'com_alertas' ? 'is-active' : ''}`}
                onClick={() => {
                  setValidationFilter(validationFilter === 'com_alertas' ? 'todas' : 'com_alertas');
                  setPage(1);
                }}
              >
                {triage.comAlertas} com alerta de extração
              </button>
            )}
            {triage.semGabarito > 0 && (
              <button
                type="button"
                className={`triage-chip ${validationFilter === 'sem_gabarito' ? 'is-active' : ''}`}
                onClick={() => {
                  setValidationFilter(validationFilter === 'sem_gabarito' ? 'todas' : 'sem_gabarito');
                  setPage(1);
                }}
              >
                {triage.semGabarito} sem gabarito
              </button>
            )}
            {triage.comFigura > 0 && (
              <button
                type="button"
                className={`triage-chip ${validationFilter === 'com_figura' ? 'is-active' : ''}`}
                onClick={() => {
                  setValidationFilter(validationFilter === 'com_figura' ? 'todas' : 'com_figura');
                  setPage(1);
                }}
              >
                {triage.comFigura} referenciam figura
              </button>
            )}
          </div>
          <span className="triage-note">Abra a questão e use Editar para corrigir.</span>
        </div>
      )}

      {/* Search and Main Toolbar */}
      <div className="bank-toolbar">
        <div className="search-field">
          <Search size={18} />
          <input
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Buscar enunciado, assunto, ano ou tags..."
            aria-label="Buscar questões no banco"
          />
          {query && (
            <button
              type="button"
              className="clear-search"
              onClick={() => handleQueryChange('')}
              aria-label="Limpar campo de busca"
            >
              <X size={15} />
            </button>
          )}
        </div>

        <div className="toolbar-controls">
          <select
            className="select-field"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as QuestionSortOption)}
            aria-label="Ordenar questões"
            title="Critério de ordenação"
          >
            <option value="recentes">Mais recentes primeiro</option>
            <option value="antigas">Mais antigas primeiro</option>
            <option value="numero">Número da questão (crescente)</option>
            <option value="materia">Matéria (A-Z)</option>
            <option value="dificuldade">Dificuldade</option>
          </select>

          <button
            type="button"
            className={`filter-toggle ${showAdvancedFilters || activeFiltersCount > 0 ? 'filter-active' : ''}`}
            onClick={() => setShowAdvancedFilters((v) => !v)}
            aria-expanded={showAdvancedFilters}
            aria-label="Filtros avançados"
          >
            <SlidersHorizontal size={16} /> Filtros
            {activeFiltersCount > 0 && <span className="filter-count">{activeFiltersCount}</span>}
          </button>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {showAdvancedFilters && (
        <div className="filter-panel">
          <label>
            Matéria
            <select value={subjectFilter} onChange={(e) => handleSubjectChange(e.target.value)}>
              <option value="Todas">Todas</option>
              {SUBJECTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <label>
            Assunto
            <select
              value={topicFilter}
              onChange={(e) => {
                setTopicFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="Todos">Todos</option>
              {availableTopics.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <label>
            Ano
            <select
              value={yearFilter}
              onChange={(e) => {
                setYearFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="Todos">Todos</option>
              {availableYears.map((y) => (
                <option key={y} value={String(y)}>
                  {y}
                </option>
              ))}
            </select>
          </label>

          <label>
            Dificuldade
            <select
              value={difficultyFilter}
              onChange={(e) => {
                setDifficultyFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="Todas">Todas</option>
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>

          <label>
            Origem
            <select
              value={sourceFilter}
              onChange={(e) => {
                setSourceFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="Todas">Todas</option>
              {availableSources.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <label>
            Estado de Resolução
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as QuestionStatusFilter);
                setPage(1);
              }}
            >
              <option value="todas">Todos os estados</option>
              <option value="nao_resolvidas">Não resolvidas</option>
              <option value="resolvidas">Resolvidas</option>
              <option value="acertos">Acertos</option>
              <option value="erros">Erros</option>
              <option value="para_revisar">Marcadas para revisão</option>
            </select>
          </label>

          <label>
            Validação
            <select
              value={validationFilter}
              onChange={(e) => {
                setValidationFilter(e.target.value as QuestionValidationFilter);
                setPage(1);
              }}
            >
              <option value="todas">Todas</option>
              <option value="com_alertas">Com alerta de extração</option>
              <option value="sem_gabarito">Sem gabarito</option>
              <option value="com_figura">Referenciam figura</option>
              <option value="incompleta">Incompletas</option>
              <option value="valida">Validadas</option>
            </select>
          </label>

          <button type="button" className="text-button clear-filters" onClick={handleClearFilters}>
            <RotateCcw size={13} /> Limpar filtros
          </button>
        </div>
      )}

      {/* Active Filter Chips */}
      {activeFiltersCount > 0 && (
        <div className="filter-chips-row">
          <span className="chips-label">Filtros ativos:</span>
          <div className="chips-list">
            {query.trim() && (
              <span className="filter-chip">
                Busca: <b>"{query}"</b>
                <button
                  type="button"
                  onClick={() => handleQueryChange('')}
                  aria-label="Remover filtro de busca"
                >
                  <X size={12} />
                </button>
              </span>
            )}

            {subjectFilter !== 'Todas' && (
              <span className="filter-chip">
                Matéria: <b>{subjectFilter}</b>
                <button
                  type="button"
                  onClick={() => handleSubjectChange('Todas')}
                  aria-label="Remover filtro de matéria"
                >
                  <X size={12} />
                </button>
              </span>
            )}

            {topicFilter !== 'Todos' && (
              <span className="filter-chip">
                Assunto: <b>{topicFilter}</b>
                <button
                  type="button"
                  onClick={() => {
                    setTopicFilter('Todos');
                    setPage(1);
                  }}
                  aria-label="Remover filtro de assunto"
                >
                  <X size={12} />
                </button>
              </span>
            )}

            {yearFilter !== 'Todos' && (
              <span className="filter-chip">
                Ano: <b>{yearFilter}</b>
                <button
                  type="button"
                  onClick={() => {
                    setYearFilter('Todos');
                    setPage(1);
                  }}
                  aria-label="Remover filtro de ano"
                >
                  <X size={12} />
                </button>
              </span>
            )}

            {difficultyFilter !== 'Todas' && (
              <span className="filter-chip">
                Dificuldade: <b>{difficultyFilter}</b>
                <button
                  type="button"
                  onClick={() => {
                    setDifficultyFilter('Todas');
                    setPage(1);
                  }}
                  aria-label="Remover filtro de dificuldade"
                >
                  <X size={12} />
                </button>
              </span>
            )}

            {sourceFilter !== 'Todas' && (
              <span className="filter-chip">
                Origem: <b>{sourceFilter}</b>
                <button
                  type="button"
                  onClick={() => {
                    setSourceFilter('Todas');
                    setPage(1);
                  }}
                  aria-label="Remover filtro de origem"
                >
                  <X size={12} />
                </button>
              </span>
            )}

            {statusFilter !== 'todas' && (
              <span className="filter-chip">
                Status:{' '}
                <b>
                  {statusFilter === 'nao_resolvidas'
                    ? 'Não resolvidas'
                    : statusFilter === 'resolvidas'
                    ? 'Resolvidas'
                    : statusFilter === 'acertos'
                    ? 'Acertos'
                    : statusFilter === 'erros'
                    ? 'Erros'
                    : 'Para revisão'}
                </b>
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('todas');
                    setPage(1);
                  }}
                  aria-label="Remover filtro de status"
                >
                  <X size={12} />
                </button>
              </span>
            )}

            {validationFilter !== 'todas' && (
              <span className="filter-chip">
                Validação:{' '}
                <b>
                  {validationFilter === 'com_alertas'
                    ? 'Com alerta'
                    : validationFilter === 'sem_gabarito'
                    ? 'Sem gabarito'
                    : validationFilter === 'com_figura'
                    ? 'Referencia figura'
                    : validationFilter === 'incompleta'
                    ? 'Incompletas'
                    : 'Validadas'}
                </b>
                <button
                  type="button"
                  onClick={() => {
                    setValidationFilter('todas');
                    setPage(1);
                  }}
                  aria-label="Remover filtro de validação"
                >
                  <X size={12} />
                </button>
              </span>
            )}

            {sortBy !== 'recentes' && (
              <span className="filter-chip">
                Ordem:{' '}
                <b>
                  {sortBy === 'antigas'
                    ? 'Mais antigas'
                    : sortBy === 'numero'
                    ? 'Número'
                    : sortBy === 'materia'
                    ? 'Matéria'
                    : 'Dificuldade'}
                </b>
                <button
                  type="button"
                  onClick={() => setSortBy('recentes')}
                  aria-label="Redefinir ordenação"
                >
                  <X size={12} />
                </button>
              </span>
            )}

            <button
              type="button"
              className="clear-all-chips"
              onClick={handleClearAllSearch}
            >
              Limpar todos
            </button>
          </div>
        </div>
      )}

      {/* Summary and Pagination Info */}
      <div className="bank-summary">
        <span>
          <b>{filteredQuestions.length}</b>{' '}
          {filteredQuestions.length === 1 ? 'questão encontrada' : 'questões encontradas'}
          {questions.length > 0 && filteredQuestions.length !== questions.length && (
            <span style={{ color: '#7d837b', fontWeight: 400 }}> (de {questions.length} no banco)</span>
          )}
        </span>

        <div className="summary-controls">
          <label className="page-size-selector">
            <span>Por página:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
              <option value="0">Todas</option>
            </select>
          </label>
        </div>
      </div>

      {/* Question List / Empty States */}
      {questions.length === 0 ? (
        <div className="empty-state" style={{ padding: '40px 24px', textAlign: 'center' }}>
          <div className="empty-illustration">
            <Database size={28} />
          </div>
          <h3 style={{ fontSize: 18, marginTop: 10 }}>Banco de questões zerado</h3>
          <p style={{ maxWidth: 480, margin: '6px auto 18px', color: '#687268', fontSize: 13, lineHeight: 1.6 }}>
            Nenhuma questão cadastrada no momento. Você pode iniciar a inserção dos dados extraindo um caderno PDF com a IA Gemini, importando arquivos JSON/CSV ou cadastrando questões manualmente.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            {onOpenGeminiModal && (
              <button type="button" className="button button-primary" onClick={onOpenGeminiModal}>
                <Upload size={16} /> Extrair Prova PDF (IA Gemini)
              </button>
            )}
            <button type="button" className="button button-secondary" onClick={onOpenImportModal}>
              <Upload size={16} /> Importar JSON / CSV
            </button>
            <button type="button" className="button button-secondary" onClick={onOpenAddQuestionModal}>
              <Plus size={16} /> Nova questão
            </button>
          </div>
        </div>
      ) : filteredQuestions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-illustration">
            <Search size={24} />
          </div>
          <h3>Nenhuma questão encontrada</h3>
          <p>Tente outros termos ou remova algum filtro da busca.</p>
          <button type="button" className="button button-secondary" onClick={handleClearAllSearch}>
            Limpar busca e filtros
          </button>
        </div>
      ) : (
        <div className="question-list">
          {pagedQuestions.map((q) => (
            <QuestionRow
              key={q.id}
              question={q}
              selected={selectedQuestionIds.includes(q.id)}
              onToggle={() => onToggleSelect(q.id)}
              onResolve={() => onStartSingleQuestion(q.id)}
              onPreview={() => setPreviewQuestion(q)}
              studentStatus={statusMap.get(q.id)}
            />
          ))}
        </div>
      )}

      {/* Pagination Bar */}
      {filteredQuestions.length > 0 && totalPages > 1 && (
        <div className="pagination-bar" aria-label="Navegação de páginas">
          <button
            type="button"
            className="pagination-btn"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            aria-label="Página anterior"
          >
            <ChevronLeft size={16} /> Anterior
          </button>

          <div className="pagination-numbers">
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 2)
              .map((p, idx, arr) => {
                const prev = arr[idx - 1];
                const showEllipsis = prev && p - prev > 1;
                return (
                  <span key={p} style={{ display: 'inline-flex', alignItems: 'center' }}>
                    {showEllipsis && <span className="pagination-ellipsis">…</span>}
                    <button
                      type="button"
                      className={`pagination-num-btn ${safePage === p ? 'pagination-num-active' : ''}`}
                      onClick={() => setPage(p)}
                      aria-current={safePage === p ? 'page' : undefined}
                    >
                      {p}
                    </button>
                  </span>
                );
              })}
          </div>

          <button
            type="button"
            className="pagination-btn"
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            aria-label="Próxima página"
          >
            Próxima <ChevronRight size={16} />
          </button>

          <span className="pagination-status">
            Página {safePage} de {totalPages} ({filteredQuestions.length} questões)
          </span>
        </div>
      )}

      {/* Sticky Bottom Contextual Selection Bar */}
      {selectedQuestionIds.length > 0 && (
        <div className="sticky-selection-bar" role="toolbar" aria-label="Ações para questões selecionadas">
          <div className="selection-info">
            <CheckCircle2 size={18} />
            <b>{selectedQuestionIds.length} {selectedQuestionIds.length === 1 ? 'questão selecionada' : 'questões selecionadas'}</b>
            <span className="selection-sub">Prontas para montar uma sessão</span>
          </div>

          <div className="selection-actions">
            <button
              type="button"
              className="button button-primary"
              onClick={() => onOpenSessionModal(selectedQuestionIds)}
            >
              Montar sessão com {selectedQuestionIds.length} <ArrowRight size={15} />
            </button>
            <button
              type="button"
              className="button button-ghost"
              onClick={onClearSelection}
              aria-label="Limpar seleção"
              title="Limpar seleção atual"
            >
              <X size={16} /> Limpar
            </button>
          </div>
        </div>
      )}

      {/* Bank Footer */}
      <div className="bank-footer">
        <span>
          Você está vendo o acervo disponível localmente ({questions.length} questões).
          {lastBatch && (
            <>
              {' '}Última importação: {new Date(lastBatch.createdAt).toLocaleDateString('pt-BR')} ·{' '}
              {lastBatch.created.length} questão(ões)
              {lastBatch.document?.label ? ` de ${lastBatch.document.label}` : ''}.
            </>
          )}
        </span>
        <div style={{ display: 'flex', gap: 14 }}>
          {lastBatch && onUndoImport && (
            <button
              type="button"
              className="text-button"
              onClick={() => {
                const confirmed = window.confirm(
                  `Desfazer a importação de ${new Date(lastBatch.createdAt).toLocaleString('pt-BR')}?\n\n` +
                    `${lastBatch.created.length} questão(ões) criada(s) por ela serão removidas` +
                    (lastBatch.replaced.length
                      ? ` e ${lastBatch.replaced.length} voltará(ão) à versão anterior.`
                      : '.') +
                    '\n\nEdições feitas depois da importação não são revertidas.'
                );
                if (confirmed) onUndoImport();
              }}
              title="Remover as questões criadas pela última importação"
            >
              <Undo2 size={15} /> Desfazer última importação
            </button>
          )}
          {questions.length > 0 && onClearQuestions && (
            <button
              type="button"
              className="text-button"
              style={{ color: '#9a4c38' }}
              onClick={() => {
                const confirmed = window.confirm(
                  `Tem certeza de que deseja zerar todas as ${questions.length} questão(ões) do banco local? Essa ação não pode ser desfeita.`
                );
                if (confirmed) onClearQuestions();
              }}
            >
              <Trash2 size={15} /> Zerar banco
            </button>
          )}
          <button type="button" className="text-button" onClick={onExportQuestions}>
            <Download size={15} /> Exportar banco
          </button>
        </div>
      </div>

      {/* Broad Preview Modal */}
      {previewQuestion && (
        <QuestionPreviewModal
          question={previewQuestion}
          selected={selectedQuestionIds.includes(previewQuestion.id)}
          onToggleSelect={() => onToggleSelect(previewQuestion.id)}
          onResolve={() => onStartSingleQuestion(previewQuestion.id)}
          onEdit={
            onEditQuestion
              ? () => {
                  const target = previewQuestion;
                  setPreviewQuestion(null);
                  onEditQuestion(target);
                }
              : undefined
          }
          onClose={() => setPreviewQuestion(null)}
          studentStatus={statusMap.get(previewQuestion.id)}
        />
      )}
    </>
  );
}
