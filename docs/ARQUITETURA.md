# Arquitetura e Invariantes do Sistema

[English version](ARCHITECTURE.md)

Este documento estabelece as decisões arquiteturais, o modelo de domínio e as invariantes de integridade do projeto **ITAQuest**.

---

## 1. Princípios de Projeto

1. **Separação entre Conteúdo e Resolução do Usuário:**  
   O registro `Question` contém exclusivamente o enunciado, metadados de origem e gabarito oficial. O progresso, a alternativa assinalada e as anotações do estudante residem em `ResponseRecord`, encapsulado dentro de `StudySession`.

2. **Oráculo do Gabarito Oficial:**  
   Modelos de linguagem não são fontes de verdade para gabaritos. O gabarito oficial é ingerido a partir de documento oficial separado (`answerKeyPdf`). Se uma questão não possui gabarito associado pelo documento oficial, seu estado de validação torna-se `sem_gabarito` e ela jamais recebe um palpite gerado por IA.

3. **Verificação de Cobertura por Contagem:**  
   O número de itens presentes no gabarito oficial define o total esperado de questões da prova. Qualquer discrepância entre a contagem extraída e a contagem oficial resulta no status `completed_with_gaps`, isolando as questões faltantes em lista explícita (`missing`).

4. **Identidade Estável e Não Ambiguidade:**  
   A ordem de leitura de uma questão no arquivo (`source.order`) não se confunde com o número impresso no caderno (`source.questionNumber`). Quando o número impresso não puder ser lido, a questão permanece com `questionNumber: undefined` e entra em quarentena (`incompleta`), prevenindo que assuma indevidamente o gabarito de outra questão.

5. **Tratamento Autorizado de Anulações:**  
   Questões anuladas pelo órgão aplicador (`annulled: true`) são mantidas no acervo, contam como acerto para o estudante e compõem tanto o numerador quanto o denominador em todos os cálculos de pontuação (`scoringService`).

6. **Normalização Canônica de Caracteres:**  
   Todos os textos ingeridos passam por normalização Unicode NFC (`normalize('NFC')`). A busca e os índices de deduplicação utilizam projeção canônica sem diacríticos (`foldText`), evitando fragmentação de acervo por diferenças de codificação (NFC vs NFD).

7. **Isolamento Estrito de Credenciais:**  
   A comunicação com a API do Gemini é restrita ao backend Node.js (`server/`). Nenhuma chave privada ou variável de ambiente sensível é exposta no bundle cliente do navegador.

---

## 2. Modelo de Dados

### 2.1 Entidades Principais (`src/types.ts`)

```ts
// Estado de validação estrutural da questão
export type QuestionValidationState =
  | 'limpa'           // Estrutura completa e gabarito oficial verificado
  | 'com_alertas'     // Alertas estruturais (ex: alternativas incompletas)
  | 'sem_gabarito'    // Gabarito ausente no documento oficial
  | 'referencia_figura' // Menciona imagem, diagrama ou gráfico no PDF
  | 'incompleta'      // Número impresso ausente ou erro de parse
  | 'anulada';        // Anulada oficialmente pela banca

// Registro canônico de questão
export interface Question {
  id: string;
  subject: Subject;              // Matemática, Física, Química, etc.
  topic: string;                 // Tópico específico
  difficulty: Difficulty;        // Básica, Intermediária, Avançada
  statement: string;             // Texto do enunciado (com KaTeX)
  alternatives: Record<string, string>; // { A: '...', B: '...', ... }
  answerKey?: string;            // Letra oficial (A-E)
  explanation?: string;          // Resolução comentada
  source: QuestionSource;        // Procedência e numeração
  tags: string[];
  createdAt: string;
  hasOfficialKey?: boolean;
  validationState?: QuestionValidationState;
  alerts?: string[];
  importBatchId?: string;        // ID do lote para suporte a rollback
  annulled?: boolean;            // Indicador de questão anulada
}

// Procedência e identificadores estáveis
export interface QuestionSource {
  label: string;                 // Instituição (ex: 'ITA')
  year: number;                  // Ano de aplicação
  phase?: string;                // '1ª fase', '2ª fase'
  questionNumber?: number;       // Número impresso no caderno original
  order?: number;                // Posição ordinal no documento
  fileName?: string;             // Nome do arquivo PDF processado
  page?: number;                 // Página no PDF
  examChecksum?: string;         // SHA-256 do arquivo da prova
  answerKeyChecksum?: string;    // SHA-256 do arquivo de gabarito
}

// Lote de importação rastreável
export interface ImportBatch {
  id: string;                    // batch-{timestamp}-{hash}
  timestamp: string;             // Data e hora ISO
  sourceFileName: string;        // Nome do arquivo
  sourceChecksum: string;        // SHA-256 do arquivo original
  totalImported: number;         // Total de questões no lote
  questionIds: string[];         // Lista de IDs importados
}

// Sessão de estudo
export interface StudySession {
  id: string;
  title: string;
  mode: 'treino' | 'simulado';
  questionIds: string[];
  currentQuestionIndex: number;
  responses: Record<string, ResponseRecord>;
  startedAt: string;
  completedAt?: string;
  durationSeconds: number;
  timeLimitMinutes?: number;     // Exclusivo do modo simulado
}

// Resposta do usuário por questão
export interface ResponseRecord {
  questionId: string;
  selectedAlternative?: string;
  discursiveAnswer?: string;
  isCorrect?: boolean;
  timeSpentSeconds: number;
  markedForReview: boolean;
  notes?: string;
}
```

---

## 3. Pipeline de Ingestão de Provas

O fluxo de processamento de exames segue 4 etapas sequenciais:

```text
[PDF Prova] --------> [ Gemini 3.8 Flash ] -------> [ Questões Estruturadas ]
                                                            │
[PDF Gabarito] -----> [ Parser Determinístico ] -> [ Gabarito Oficial ]
                                                            │
                                                            ▼
                                              [ Reconciliação & Oráculo ]
                                                            │
                                              ┌─────────────┴─────────────┐
                                              ▼                           ▼
                                    [ Auditoria Cobertura ]      [ Verificação Dedup ]
                                    (Gaps & Anulações)           (Conflitos de Versão)
                                              │                           │
                                              └─────────────┬─────────────┘
                                                            ▼
                                              [ Modal de Revisão & Confirmação ]
                                                            │
                                                            ▼
                                              [ Armazenamento com Lote ]
```

### 3.1 Etapa 1: Ingestão de Arquivos
- O usuário envia dois arquivos: o PDF do caderno de questões e o PDF do gabarito oficial.
- O servidor calcula o hash SHA-256 de ambos os arquivos para garantir idempotência e rastreabilidade.
- O sistema verifica se o arquivo da prova já foi importado anteriormente, alertando o usuário sobre reprocessamento.

### 3.2 Etapa 2: Extração e Reconciliação Determinística
- O modelo multimodal extrai os enunciados, mantendo fórmulas matemáticas delimitadas para o KaTeX.
- O gabarito oficial é analisado de forma isolada, extraindo a tabela de correspondência `(número -> alternativa)`.
- A reconciliação vincula o gabarito oficial exclusivamente pelo número da questão (`questionNumber`). Se o número não foi detectado no PDF, o vínculo não é presumido por posição relativa, a menos que a contagem total de questões bata exatamente com a contagem do gabarito.

### 3.3 Etapa 3: Auditoria do Oráculo e Gestão de Conflitos
- O total de linhas do gabarito oficial é utilizado como oráculo de completude (`expectedCount`). Se houver ausência de itens, o job recebe status `completed_with_gaps` e aponta a lista de questões faltantes.
- Itens marcados com asterisco ou nota de anulação no gabarito oficial são classificados como `annulled: true`.
- Durante a conferência contra o banco local:
  - Questões com mesma chave de documento e número que possuam diferenças textuais são enviadas para o `ImportConflictsModal`.
  - O usuário decide explicitamente se deseja **Substituir**, **Manter ambos** ou **Ignorar** a nova versão.

### 3.4 Etapa 4: Gravação e Lote
- As questões aceitas são persistidas no banco local associadas a um `importBatchId`.
- Caso o usuário perceba que o lote continha erros de extração ou não deseja mantê-lo, a ação **Desfazer última importação** remove exclusivamente os registros daquele lote sem tocar nas demais questões ou no histórico de sessões.

---

## 4. Persistência e Limites Operacionais

### 4.1 Estado Atual: `localStorage`
- O armazenamento utiliza chaves versionadas (`itaquest.questions.v1`, `itaquest.sessions.v1`, etc.) com migração automática transparente de prefixos anteriores.
- Cada gravação é envolvida em bloco `try/catch` com captura de `QuotaExceededError`.
- Em caso de falha de espaço, o serviço emite alerta e impede a corrupção do estado em memória.
- Capacidade típica: ~1.600 a ~3.200 questões completas (considerando limite de 5 MB por domínio).

### 4.2 Próxima Etapa: Migração para IndexedDB / Banco Relacional
- Para acomodar múltiplos anos de provas completas (ITA, IME e simulados com figuras e recortes rasterizados), o projeto migrará o armazenamento para IndexedDB no frontend e, posteriormente, tabelas relacionais em banco SQL (PostgreSQL).
- O desenho do esquema relacional já se encontra especificado em `docs/PROPOSTA_ORGANIZACAO_E_AQUISICAO_DE_QUESTOES.md`.
