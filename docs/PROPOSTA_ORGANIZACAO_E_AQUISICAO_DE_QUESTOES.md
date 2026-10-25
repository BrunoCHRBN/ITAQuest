# Diagnóstico, Modelo de Dados e Plano de Aquisição de Questões

[English version](QUESTION_ACQUISITION_AND_ORGANIZATION.md)

**Escopo:** ITAQuest (React 19 + TypeScript + Vite + Express/Gemini).  
Diagnóstico técnico sobre a organização do acervo e ingestão de exames, acompanhado do modelo de dados normalizado, auditoria empírica contra prova real do ITA e registro de execuções.

Para reproduzir as medições executadas neste documento:

```bash
npx tsx scripts/probe-diagnostico.ts
```

Todos os achados assinalados com **[medido]** foram validados diretamente contra a implementação de código e dados reais.

---

## Sumário

1. [Localização e Módulos do Sistema](#1-localização-e-módulos-do-sistema)
2. [Linha de Base Técnica](#2-linha-de-base-técnica)
3. [Diagnóstico — Aquisição de Questões (F1 a F9)](#3-diagnóstico--aquisição-de-questões-f1-a-f9)
4. [Diagnóstico — Organização do Acervo (O1 a O9)](#4-diagnóstico--organização-do-acervo-o1-a-o9)
5. [Modelo de Dados Normalizado](#5-modelo-de-dados-normalizado)
6. [Plano de Implementação em Três Ondas](#6-plano-de-implementação-em-três-ondas)
7. [Critérios de Aceite Automatizados](#7-critérios-de-aceite-automatizados)
8. [Auditoria contra Exame Real: ITA 2025 (1ª Fase)](#8-auditoria-contra-exame-real-ita-2025-1ª-fase)
9. [Histórico de Execuções e Testes](#9-histórico-de-execuções-e-testes)
10. [Itens Pendentes e Próximos Passos](#10-itens-pendentes-e-próximos-passos)

---

## 1. Localização e Módulos do Sistema

O projeto reside em `rotina-ita-app`:

| Caminho | Função |
|---|---|
| `rotina-ita-app` | Aplicação completa (Frontend React, Backend Express em `server/`, serviços em `src/services/`). |
| `rotina-ita` | Repositório legado do protótipo em arquivo único HTML. Mantido como referência histórica. |

Mapeamento dos módulos essenciais:

```text
src/types.ts                        # Contratos de Question, QuestionSource, StudySession
src/services/questionService.ts     # Normalização, validação, deduplicação e filtros
src/services/importService.ts       # Parsers de CSV e JSON
src/services/storageService.ts      # Armazenamento em localStorage com gestão de quota
src/services/batchService.ts        # Gerenciamento e reversão de lotes de importação
server/geminiService.ts             # Extração multimodal e reconciliação determinística
server/jobManager.ts                # Fila de processamento em memória
server/index.ts                     # Rotas de API REST (/api/extract/jobs)
src/components/views/BankPage.tsx   # Tabela do banco, filtros de triagem e seleção
src/components/modals/GeminiImportModal.tsx  # Upload, acompanhamento e revisão
src/components/modals/ImportConflictsModal.tsx # Resolução de conflitos de importação
```

---

## 2. Linha de Base Técnica

- **Verificação Estática (`tsc --noEmit`):** sem erros.
- **Suíte Automatizada (`vitest`):** 114 testes em 18 arquivos, todos aprovados.
- **Controle de Versão:** repositório Git com histórico atômico cobrindo cada correção implementada.

---

## 3. Diagnóstico — Aquisição de Questões (F1 a F9)

### F1 [Crítico] Omissão de Número Impresso Desloca o Gabarito Oficial **[medido]**
- **Problema:** Quando o modelo não detectava o número da questão em diagramações de duas colunas, o sistema utilizava fallback ordinal `idx + 1`. Havendo omissão de uma questão intermediária, itens subsequentes herdavam gabaritos deslocados, gerando erros silenciosos com aparência de dado oficial validado.
- **Solução Implementada:** Separação estrita entre `source.order` (ordinal de leitura) e `source.questionNumber` (número impresso no documento). Sem número impresso, a questão não recebe gabarito automático por posição e é colocada em quarentena (`validationState: 'incompleta'`), exigindo asserção de unicidade (`Set(numbers).size === numbers.length`).

### F2 [Crítico] Falta de Verificação de Cobertura Total
- **Problema:** O gabarito oficial contém a contagem exata de questões do exame. Caso o modelo extraísse apenas uma parcela do caderno (ex.: 40 de 48 questões), o sistema encerrava com sucesso aparente, ocultando a perda de questões.
- **Solução Implementada:** Utilização do gabarito oficial como oráculo de contagem (`expectedCount`). Discrepâncias alteram o status do job para `completed_with_gaps` e registram a lista exata de questões ausentes (`missing`).

### F3 [Crítico] Impossibilidade de Correção e Descarte Silencioso de Versões Atualizadas **[medido]**
- **Problema:** A aplicação operava em regime write-once (sem interface de edição). Adicionalmente, a chave de deduplicação incluía o texto integral do enunciado; corrigir uma alternativa incompleta não alterava a chave, fazendo com que a versão corrigida fosse descartada silenciosamente como duplicata.
- **Solução Implementada:** Implementação de edição in-place (`AddQuestionModal` em modo edição) e evolução da função de deduplicação, que agora detecta conflitos de versão e abre o `ImportConflictsModal` para decisão humana explícita (*Substituir*, *Manter ambos* ou *Ignorar*).

### F4 [Alto] Truncamento de Respostas JSON em Cadernos Longos
- **Problema:** Envio de cadernos inteiros (30 a 60 páginas) em uma única chamada à API pode exceder limites de tokens de saída ou truncar a resposta JSON.
- **Mitigação Planejada:** Fatiamento da extração por blocos de páginas (ex.: 6 a 8 páginas por requisição), salvamento incremental no job e junção determinística final.

### F5 [Alto] Descarte Imediato dos Arquivos PDF Originais
- **Problema:** A limpeza síncrona dos arquivos temporários impede a auditoria visual de questões que fazem referência a gráficos e figuras.
- **Mitigação Planejada:** Retenção local dos PDFs e renderização de imagens PNG por página para inspeção lado a lado durante a triagem.

### F6 [Alto] Perda da Rastreabilidade do Checksum do Gabarito **[medido]**
- **Problema:** O checksum SHA-256 do arquivo de gabarito era calculado no job, mas não era gravado na entidade `Question`.
- **Solução Implementada:** Propagação do campo `answerKeyChecksum` para a estrutura `QuestionSource` de cada questão reconciliada.

### F7 [Médio] Delimitador de CSV Padrão Excel pt-BR
- **Problema:** Arquivos CSV gerados em sistemas operacionais e ferramentas brasileiras utilizam ponto e vírgula (`;`) como separador. A divisão rígida por vírgula faz com que a linha inteira seja tratada como uma única coluna, falhando na importação.
- **Mitigação Planejada:** Detecção heurística de delimitador na primeira linha (vírgula, ponto e vírgula, tabulação) e suporte nativo a planilhas `.xlsx`.

### F8 [Baixo] Inconsistência Textual no Campo de Fase
- **Problema:** Variações como `'1ª fase'`, `'Primeira fase'` e `'1a fase'` criavam categorias redundantes nos filtros.
- **Solução:** Padronização canônica via enum (`1a_fase`, `2a_fase`, `caderno_unico`), preservando o rótulo original em campo secundário.

### F9 [Baixo] Marcador Falso em Resolução Comentada
- **Problema:** Inserção de texto genérico (como `"Questão discursiva"`) no campo `explanation`.
- **Solução:** Utilização de campo explícito de tipagem de questão (`type: 'objetiva' | 'discursiva'`), mantendo `explanation` nulo na ausência de resolução autêntica.

---

## 4. Diagnóstico — Organização do Acervo (O1 a O9)

### O1 [Crítico] Estado de Validação Ignorado na Interface **[medido]**
- **Problema:** Metadados como `alerts` e `validationState` eram calculados na extração, mas não podiam ser filtrados na tela de listagem do banco de questões.
- **Solução Implementada:** Adição da barra de triagem na `BankPage`, permitindo filtrar o acervo instantaneamente por categorias: limpas, com alertas, sem gabarito, referenciando figuras, incompletas e anuladas.

### O2 [Crítico] Ausência de Mecanismo de Edição
- **Problema:** Sem a capacidade de atualizar uma questão existente, qualquer erro pontual de digitação ou formatação exigiria a exclusão e reinserção manual de todo o acervo.
- **Solução Implementada:** Ação de edição integrada à listagem, permitindo ajustar enunciado, alternativas, gabarito e metadados, revalidando a questão ao salvar.

### O3 [Crítico] Ausência de Identidade de Lote de Ingestão
- **Problema:** Sem agrupamento por lote, a importação acidental de um caderno corrompido não podia ser desfeita de forma seletiva.
- **Solução Implementada:** Criação do serviço `batchService` e do tipo `ImportBatch`. Cada importação recebe um identificador único, permitindo acionar a operação "Desfazer última importação" com reversão atômica.

### O4 [Alto] Fragmentação da Taxonomia de Assuntos
- **Problema:** O campo `topic` aceita strings arbitrárias. Variações como `"Álgebra"`, `"algebra"` e `"Álgebra Linear"` geravam múltiplos filtros desconexos.
- **Mitigação Planejada:** Catálogo hierárquico fixo baseado no edital oficial do ITA, permitindo aferir a cobertura programática real do acervo de estudos.

### O5 [Alto] Busca Incompatível com Acentuação **[medido]**
- **Problema:** A busca direta por substring rejeitava consultas comuns sem acento (ex.: `"algebra"` não encontrava `"Álgebra"`).
- **Solução Implementada:** Introdução do `textService` com a função `foldText` (decomposição NFD com remoção de diacríticos e caixa baixa), garantindo paridade em ambas as direções.

### O6 [Alto] Falsos Positivos e Negativos na Deduplicação
- **Problema:** A chave de deduplicação baseada no texto integral do enunciado falhava quando havia variações tipográficas em fórmulas (ex.: `$v_0$` vs `v₀`), duplicando a questão.
- **Solução Implementada:** A identidade primária é definida pelo par `(documento, número impresso)`. O texto do enunciado atua como critério secundário para detecção de conflitos, abrindo o modal de decisão em vez de rejeitar ou duplicar cegamente.

### O7 [Alto] Limite Físico e Modo de Falha do `localStorage` **[medido]**
- **Problema:** Uma questão completa do ITA com fórmulas ocupa em média 1.620 bytes. O limite padrão de 5 MB comporta entre 1.600 e 3.200 questões. Falhas de quota podiam dessincronizar o estado da memória com o disco local.
- **Solução Atual e Futura:** Implementação de guarda defensiva em `storageService` que reverte o estado em caso de falha de gravação. Migração para IndexedDB programada para acomodar dezenas de exames completos com imagens.

### O8 [Médio] Dificuldade Subjetiva Não Calibrada
- **Problema:** O nível de dificuldade (Básica, Intermediária, Avançada) era atribuído exclusivamente pelo modelo de linguagem.
- **Mitigação Planejada:** Cálculo de dificuldade observada com base no histórico real de taxa de acerto do estudante ao longo das sessões.

### O9 [Médio] Notas Discursivas Confinadas à Sessão
- **Problema:** As anotações do estudante ficavam restritas ao registro daquela sessão específica, impedindo a visualização cumulativa de anotações no caderno da questão.
- **Mitigação Planejada:** Desacoplamento de `QuestionNote` como entidade global associada à questão, exibindo o histórico de resoluções anteriores.

---

## 5. Modelo de Dados Normalizado

Para a futura migração para banco relacional (Sprint 3 / PostgreSQL), foi especificado o seguinte esquema:

```sql
CREATE TABLE documents (
  id VARCHAR(64) PRIMARY KEY,
  institution VARCHAR(32) NOT NULL,
  year INT NOT NULL,
  phase VARCHAR(32) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  checksum CHAR(64) UNIQUE NOT NULL,
  page_count INT,
  expected_count INT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE import_batches (
  id VARCHAR(64) PRIMARY KEY,
  document_id VARCHAR(64) REFERENCES documents(id) ON DELETE CASCADE,
  job_id VARCHAR(64),
  prompt_version VARCHAR(32),
  model VARCHAR(64),
  status VARCHAR(32) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE topics (
  id VARCHAR(64) PRIMARY KEY,
  subject VARCHAR(32) NOT NULL,
  parent_id VARCHAR(64) REFERENCES topics(id),
  name VARCHAR(128) NOT NULL,
  aliases TEXT[]
);

CREATE TABLE questions (
  id VARCHAR(64) PRIMARY KEY,
  document_id VARCHAR(64) REFERENCES documents(id) ON DELETE CASCADE,
  question_number INT,
  source_order INT NOT NULL,
  batch_id VARCHAR(64) REFERENCES import_batches(id) ON DELETE SET NULL,
  type VARCHAR(16) NOT NULL DEFAULT 'objetiva',
  subject VARCHAR(32) NOT NULL,
  topic_id VARCHAR(64) REFERENCES topics(id),
  topic_raw VARCHAR(128),
  difficulty_suggested VARCHAR(16),
  difficulty_observed NUMERIC(3, 2),
  statement TEXT NOT NULL,
  explanation TEXT,
  validation_state VARCHAR(32) NOT NULL DEFAULT 'limpa',
  annulled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_document_question_number UNIQUE (document_id, question_number)
);

CREATE TABLE alternatives (
  id SERIAL PRIMARY KEY,
  question_id VARCHAR(64) REFERENCES questions(id) ON DELETE CASCADE,
  letter CHAR(1) NOT NULL,
  text TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT uq_question_letter UNIQUE (question_id, letter)
);

CREATE TABLE answer_keys (
  question_id VARCHAR(64) PRIMARY KEY REFERENCES questions(id) ON DELETE CASCADE,
  letter CHAR(1) NOT NULL,
  source_file VARCHAR(255) NOT NULL,
  source_checksum CHAR(64) NOT NULL,
  item_number INT NOT NULL
);
```

---

## 6. Plano de Implementação em Três Ondas

### Onda 1: Integridade Estrutural e Prevenção de Corrupção (CONCLUÍDA)
1. Desacoplamento entre `source.order` e `source.questionNumber`; quarentena para itens sem numeração (F1).
2. Verificação de completude contra contagem oficial do gabarito (`expectedCount` e `missing`) (F2).
3. Gestão de conflitos de deduplicação com modal interativo de decisão (F3).
4. Busca de texto canônica com normalização e remoção de acentos via `foldText` (O5).
5. Propagação do checksum SHA-256 do gabarito oficial na questão (F6).
6. Barra de triagem do banco por estado de validação (`validationState`) (O1).
7. Edição de questões com validação de esquema ao salvar (O2).
8. Rastreamento e reversão atômica de lotes de importação via `ImportBatch` (O3).
9. Tratamento de questões anuladas (`annulled: true`) com computação de acerto (A4).

### Onda 2: Manutenibilidade e Escalabilidade de Armazenamento
1. Migração da camada cliente para IndexedDB, eliminando restrições de 5 MB do `localStorage` (O7).
2. Suporte a delimitador `;` em CSV e importador nativo de planilhas `.xlsx` (F7).
3. Catálogo hierárquico de assuntos oficiais do edital do ITA com relatório de cobertura (O4).
4. Retenção de PDFs originais e rasterização de páginas PNG para conferência visual de diagramas (F5).

### Onda 3: Ingestão Fracionada e Calibração
1. Extração do PDF fatiada por janelas de páginas com persistência incremental no job (F4).
2. Cálculo de dificuldade observada baseada no histórico de tentativas dos simulados (O8).
3. Caderno de erros global (`QuestionNote`) independente de sessões individuais (O9).

---

## 7. Critérios de Aceite Automatizados

Cada correção de integridade possui teste automatizado correspondente:

| Item | Condição Testada |
|---|---|
| **F1** | Questão sem número impresso não herda número adjacente; duplicidade de número é impedida por `Set`. |
| **F2** | Gabarito oficial com 48 itens e extração com 40 resulta em status `completed_with_gaps` e `missing` preenchido. |
| **F3** | Reimportação de questão com alternativas corrigidas gera 1 conflito e 0 novas no retorno da deduplicação. |
| **F6** | O campo `source.answerKeyChecksum` coincide rigorosamente com o hash do gabarito. |
| **O1** | Componente de triagem filtra corretamente questões limpas, com alertas e sem gabarito. |
| **O5** | Termo de busca sem acento (`"algebra"`) localiza questão cadastrada com acento (`"Álgebra"`). |
| **A4** | Questão com `annulled: true` soma ponto no total de acertos e conta no divisor da nota. |

---

## 8. Auditoria contra Exame Real: ITA 2025 (1ª Fase)

Auditoria realizada sobre os arquivos oficiais do concurso: `2025_fase1.pdf` (28 páginas, 1,8 MB) e `gabarito_2025.pdf` (1 página).

### A1. Contagem Efetiva de Questões
O exame é composto por **48 questões de múltipla escolha** (12 de Matemática, 12 de Física, 12 de Química e 12 de Inglês), numeradas de 1 a 48. Uma série histórica de 10 anos de 1ª fase totaliza 480 a 576 questões, cabendo confortavelmente nas projeções de armazenamento.

### A2. Discrepância de Normalização Unicode no PDF Oficial **[medido]**
O arquivo PDF digital oficial mistura internamente duas formas de normalização Unicode:
- Ocorrências de `"Questão"` em forma pré-composta (NFC): **24** (Matemática e Química).
- Ocorrências de `"Questão"` em forma decomposta (NFD): **24** (Física e Inglês).

Um leitor ingênuo de texto que busque `"Questão"` recupera apenas 50% do exame. A normalização canônica mandatória implementada no `textService` soluciona essa fragmentação.

### A3. Limites de Extração de Texto Puro em Notação Matemática
O fluxo de extração de texto direto decompõe fórmulas complexas (frações, potências e radicais tornam-se ilegíveis ou perdem operadores). Portanto, a estruturação multimodal via modelo visual (Gemini) é mandatória para a integridade dos enunciados científicos.

### A4. Dados Estruturais Fornecidos pelo Gabarito Oficial
O gabarito oficial oferece três elementos autoritativos que dispensam inferência de modelo:
1. Contagem exata de 48 questões.
2. Fronteiras de matéria rigorosamente definidas por número (1–12 Matemática, 13–24 Física, 25–36 Química, 37–48 Inglês).
3. Identificação de questões anuladas: questões 9 e 18 constavam com marcação `(*)` e nota oficial de validação para todos os candidatos.

### A5. Ocorrência de Imagens e Diagramas
No exame auditado, **8 das 48 questões (~17%)** fazem referência explícita a diagramas, esquemas ou circuitos elétricos. Embora essencial para a resolução dessas questões, a ausência da figura não impede a triagem e o cadastro das demais 40 questões, confirmando que a gestão de figuras deve ser tratada como processo de enriquecimento visual progressivo.

---

## 9. Histórico de Execuções e Testes

A tabela abaixo resume os commits implementados e seus respectivos escopos:

| Commit | Escopo | Descrição da Mudança |
|---|---|---|
| `f2d5831` | Baseline | Inicialização do repositório Git e criação do ponto de restauração inicial. |
| `9e0b44b` | Normalização | `textService`: armazenamento em NFC e busca com remoção de diacríticos (`foldText`). |
| `83fe28c` | Identidade | Separação entre `source.order` e `source.questionNumber`; propagação do checksum de gabarito. |
| `ad87aa0` | Cobertura | Auditoria de completude com gabarito como oráculo e emissão de status `completed_with_gaps`. |
| `32bc4e7` | Conflitos/Edição | Modal interativo de conflitos na reimportação e modal de edição direta de questões. |
| `af8dad9` | Triagem | Barra de filtros rápidos por `validationState` no banco de questões. |
| `56e63c5` | Lotes | Entidade `ImportBatch`, aviso de PDF já processado e reversão atômica de importação. |
| `4bd92e7` | Anuladas | Campo `annulled: true` computado como acerto em todas as regras de pontuação. |
| `387d5cd` | Documentação | Registro de testes executados e medições empíricas. |

**Estado da Suíte Automatizada:** 114 testes aprovados (18 arquivos), `typecheck` limpo e build de produção sem pendências.

---

## 10. Itens Pendentes e Próximos Passos

1. **F4 (Extração Fatiada):** dividir o envio de PDFs volumosos em blocos de páginas com persistência incremental no job.
2. **F5 (Retenção de Arquivos):** persistir o PDF original e gerar recortes PNG por página para consulta na interface de triagem.
3. **F7 (Delimitador `;` e XLSX):** estender o `importService` para reconhecer delimitadores do Excel em português e arquivos `.xlsx`.
4. **O4 (Catálogo de Assuntos):** criar taxonomia controlada baseada no programa do vestibular do ITA.
5. **O7 (Migração IndexedDB):** implementar driver IndexedDB para superar a barreira de 5 MB do `localStorage`.
