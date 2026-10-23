# Organização do acervo e aquisição de questões

**Escopo:** `~/rotina-ita-app` (React 19 + Vite + Express/Gemini). Diagnóstico do que existe hoje
para *organizar* o banco de questões e *obter* questões para alimentá-lo, com as correções
priorizadas.

**Como reproduzir as medições deste documento:**

```bash
cd ~/rotina-ita-app && npx tsx scripts/probe-diagnostico.ts
```

Todo achado marcado com **[medido]** foi exercitado contra os módulos reais, não inferido por
leitura. O que não foi verificado está declarado na seção 8.

---

## 1. Onde está a aplicação

A pasta não está na Área de Trabalho (`~/Área de trabalho` só tem atalhos de jogos). Ela está na
raiz do home:

| Caminho | O que é |
|---|---|
| `~/rotina-ita-app` | **A aplicação viva.** `node_modules` instalado, `dist/` buildado, `server/.env` com chave. |
| `~/Downloads/rotina-ita-app` | Cópia antiga (18/10, sem `server/` nem `services/`). Ignorar. |
| `~/rotina-ita` | Protótipo anterior em HTML único (145 KB, com `.git`). Origem do projeto, não é a app. |

Mapa do que importa para este diagnóstico:

```
src/types.ts                        Question, QuestionSource, StudySession
src/services/questionService.ts     normalização, validação, DEDUP, filtros  <- núcleo
src/services/importService.ts       CSV/JSON -> Question
src/services/storageService.ts      localStorage, quota, migração
server/geminiService.ts             extração PDF + reconciliação com gabarito  <- núcleo
server/jobManager.ts                fila de jobs em memória
server/index.ts                     /api/extract/jobs
src/components/views/BankPage.tsx   filtros, paginação, seleção
src/components/modals/GeminiImportModal.tsx  upload, polling, revisão pré-import
```

## 2. Estado medido

- `npx tsc --noEmit`: limpo.
- `npx vitest run`: **57 testes, 10 arquivos, todos verdes** (1,5 s).
- **Não é repositório git.** Nenhum histórico, nenhum diff, nenhum rollback. Isso é relevante:
  as mudanças propostas abaixo não têm rede de segurança.

Ou seja: a base está sã. O problema não é código quebrado — é **modelo de dados incompleto**.
As duas funções centrais (`deduplicateQuestions`, `reconcileExtractedData`) fazem o que prometem,
mas prometem menos do que o acervo precisa.

---

## 3. Diagnóstico — Aquisição de questões

> **Leia também o Apêndice (ao final).** Ele audita a prova real do ITA 2025 e revisa a
> arquitetura de aquisição recomendada aqui: a resposta certa não é "modelo ou parser", é
> parser para a estrutura + modelo só para o enunciado + gabarito como oráculo.

### F1 [P0] Questão sem número rouba o gabarito da vizinha **[medido]**

`server/geminiService.ts:386` — `const qNum = raw.questionNumber ?? idx + 1;`

Quando o modelo não lê o número impresso (enunciado em duas colunas, número na margem, digitalização
ruim), o sistema **inventa** `idx + 1`. Se a questão 2 não tem número, ela recebe 2... e a questão 3,
que tem número, também é 3. Duas questões com o mesmo número:

```
nº1 | Q1                                 | gabarito=A   (correto)
nº3 | Q3                                 | gabarito=C   (correto)
nº3 | Q2 sem numero (o modelo nao leu...) | gabarito=C   <- ERRADO: é o gabarito da Q3
```

A Q2 fica com o gabarito da Q3, sem alerta, com `hasOfficialKey: true`. O aluno estuda com
gabarito errado e o sistema não tem como saber. Este é o pior tipo de defeito possível num banco
de estudo: **falha silenciosa com aparência de dado verificado**.

Correção: separar duas identidades que hoje são uma só.

```ts
source.order?: number          // ordinal no documento, sempre presente
source.questionNumber?: number // número impresso, pode ser undefined
```

Reconciliar gabarito por `questionNumber` **somente quando ele existe**; quando não existe, casar
por `order` apenas se `rawQuestions.length === answerKeys.length` (aí a correspondência é
bijetiva por construção). Em qualquer outro caso: `validationState: 'incompleta'` e quarentena.
E uma asserção explícita: `new Set(nums).size === nums.length`, senão o job falha com diagnóstico.

### F2 [P0] Nada verifica quantas questões deveriam ter sido extraídas

O gabarito oficial é um **oráculo de contagem de graça**: se tem 60 linhas, a prova tem 60
questões. Hoje, se o modelo devolver 52, o job termina com "Extração concluída: 52 questões
identificadas" e ninguém percebe que 8 desapareceram. A prova do ITA 1ª fase tem 60 questões —
uma perda de 13% passaria como sucesso.

Correção: `expectedCount` (do gabarito, ou informado no formulário) e comparação explícita:

```ts
if (expectedCount && questions.length !== expectedCount) {
  job.status = 'completed_with_gaps';  // não 'completed'
  job.alerts.push(`Extraídas ${questions.length} de ${expectedCount} esperadas. Faltam: ${missing.join(', ')}`);
}
```

`missing` é calculável: `1..expectedCount` menos os `questionNumber` presentes. Dá a lista exata
para re-extrair só aquelas páginas.

### F3 [P0] Correção é impossível — e a reimportação da versão corrigida é descartada **[medido]**

Duas peças se encaixam mal:

1. **Não existe edição de questão.** `grep -rn "onEdit\|updateQuestion\|editQuestion" src/` → zero
   resultados. O banco é *write-once*. Uma questão importada com alternativa faltando nunca pode
   ser consertada dentro do app.
2. **A chave de dedup recusa a correção.** `questionDeduplicationKey` = `label|year|num|statement`.
   Completar as alternativas não muda nenhum dos quatro campos:

```
chave original : ita|2024|12|um bloco desliza sobre um plano inclinado...
chave corrigida: ita|2024|12|um bloco desliza sobre um plano inclinado...
aceitas: 0 | recusadas como duplicata: 1
-> a correção entrou? NAO (silenciosamente descartada)
```

O caminho de trabalho que sobra é: editar o JSON à mão, reimportar, e ver o app dizer
"1 duplicata ignorada" — sem dizer *qual*, nem que a versão boa foi jogada no lixo. A fila de
revisão por exceção é, na prática, um beco sem saída.

Correção: dedup deixa de ser booleano e passa a ser um **diagnóstico**.

```ts
deduplicateQuestions(existing, incoming): {
  fresh: Question[];
  conflicts: Array<{ incoming: Question; existingId: string; sameStatement: boolean }>;
}
```

A UI mostra os conflitos com diff (o que mudou: alternativas? gabarito? enunciado?) e oferece
*Substituir* / *Manter ambos* / *Ignorar*. E a identidade deve ser `(documento, questionNumber)`
quando ambos existem — não o texto do enunciado.

### F4 [P1] Um truncamento de JSON derruba a extração inteira

`extractExamFromPdf` manda o PDF completo numa chamada e faz `JSON.parse(text)` direto
(`geminiService.ts:266`). Com `maxOutputTokens: 65536` e uma prova de 60 questões com fórmulas, a
resposta truncada é um JSON inválido → `JSON.parse` lança → job `failed` → **90% do trabalho
perdido**. Não há persistência parcial nem retomada.

Correção: fatiar por faixa de páginas (ex.: 8 páginas por chamada), persistir cada fatia no job
conforme chega, e mesclar no fim. Custa mais chamadas, mas transforma "tudo ou nada" em
"reprocessar só a fatia que falhou". Guardar também o texto cru de cada fatia permite reparsear
sem chamar a API de novo.

### F5 [P1] O PDF é apagado e não há como re-extrair ou auditar

`jobManager.ts:74` — `cleanup()` faz `unlinkSync` do PDF da prova e do gabarito no `finally`. O que
sobrevive é o SHA-256. Consequências: não dá para revisar a figura original de uma questão
marcada como "referencia figura"; não dá para re-extrair com um prompt melhor; não dá para
conferir se o texto extraído corresponde ao impresso.

Para um acervo que se pretende auditável, apagar a fonte é a decisão errada. Correção: um
diretório `documents/` com o PDF e um PNG por página (a página é o que você precisa mostrar ao
lado da questão na revisão), e retenção por padrão. Se houver preocupação de direitos, reter
local e nunca redistribuir — que é o caso de uso.

### F6 [P1] A procedência do gabarito morre no job **[medido]**

`answerKeyChecksum` é calculado (`jobManager.ts:25`), guardado no job, exposto no tipo do cliente
(`GeminiImportModal.tsx:53`) — e **nunca gravado na questão**. `reconcileExtractedData` não recebe
esse parâmetro. O que fica na questão é `gabaritoOficialSource: 'Gabarito Oficial'`, uma string
constante.

Então a afirmação "procedência explícita" (regra 7 do `GEMINI_HANDOFF.md`) vale para a prova, não
para o gabarito. Correção:

```ts
answerKey?: {
  letter: string;
  source: { fileName: string; checksum: string; itemNumber: number };
};
```

### F7 [P1] CSV exportado pelo Excel em português não importa **[medido]**

`csvToRows` só divide por vírgula (`importService.ts:23`). O Excel pt-BR salva com ponto e vírgula.
Resultado:

```
CSV: "enunciado;materia;gabarito;A;B" + linha
colunas detectadas: ["enunciado;materia;gabarito;a;b"]
```

Uma coluna só. Todas as linhas caem em "enunciado ausente ou vazio" e são ignoradas. O usuário vê
"0 questões importadas" e não faz ideia do motivo. Correção: detecção de delimitador na primeira
linha (`,` `;` `\t` `|`, vence o que aparecer mais fora de aspas), e suporte a `.xlsx` — que é o
formato em que as planilhas de questões realmente existem.

### F8 [P2] `phase` é texto livre

`'1ª fase'`, `'Primeira fase'`, `'1a fase'`, `'1 FASE'` são quatro valores distintos no filtro.
Vira enum (`'1a_fase' | '2a_fase' | '3a_fase' | 'caderno_unico'`) e o texto original vai para um
campo `phaseLabel`.

### F9 [P2] Preenchimento disfarçado de conteúdo

`geminiService.ts:465` — `explanation: isDiscursive ? 'Questão discursiva' : undefined`. Um
placeholder é gravado como se fosse resolução. O tipo de questão (objetiva/discursiva) deveria ser
campo explícito (`type`), e `explanation` ficaria vazia de verdade.

---

## 4. Diagnóstico — Organização do acervo

### O1 [P0] O estado de validação é gravado e nunca lido **[medido]**

`validationState` aparece em `types.ts` e é apenas *transportado* pelo `GeminiImportModal`. Nenhum
componente lê o campo. `alerts` e `hasOfficialKey` viram badges na linha, mas **não há filtro por
eles** — os filtros do `BankPage` são matéria, assunto, ano, dificuldade, origem e estado de
resolução.

Efeito: a "fila de revisão por exceção" existe só dentro do modal, antes de importar. Depois de
importar, 47 questões com alerta e 13 questões limpas são indistinguíveis na lista. O trabalho de
triagem que o sistema se deu ao trabalho de calcular é jogado fora no exato momento em que passa a
importar.

Correção: o estado de validação é um **eixo de organização de primeira classe**:

- filtros: *com alertas*, *sem gabarito oficial*, *referencia figura*, *incompleta*;
- contador persistente na sidebar ("12 pendências de revisão"), como já existe para `reviewCount`;
- uma tela de triagem que lista as pendências e leva à questão.

### O2 [P0] Write-once: não há edição, logo não há manutenção

Sem `updateQuestion`, todo defeito de extração é permanente, e a única saída é "Zerar banco". Um
acervo que cresce por extração de PDF **precisa** de edição — é onde 80% do tempo humano vai.
Mínimo viável: editar enunciado, alternativas, gabarito, matéria/assunto, e revalidar
(`validateQuestion`) ao salvar, limpando os alertas que deixaram de valer.

### O3 [P0] Não existe a entidade "documento"

Não há registro de *quais provas foram ingeridas*. `source.label/year/phase/questionNumber` são
campos soltos repetidos em cada questão; o `checksum` existe mas não é usado para nada.

Três consequências práticas:
1. Não sei o que já ingeri → risco de importar a mesma prova duas vezes.
2. Não posso desfazer uma importação → se 90 questões de uma extração ruim entraram, só resta
   zerar tudo.
3. Não posso re-extrair quando o prompt melhorar.

Correção: entidade `Document` (instituição, ano, fase, arquivo, checksum, nº de questões
esperadas, data, job de origem) e `importBatchId` em cada questão. Isso habilita de graça:
"desfazer último lote", "reprocessar documento", "quais provas já tenho".

### O4 [P1] A taxonomia de assuntos fragmenta

`Subject` é um enum fixo de 7 valores — correto para o vestibular. Mas `topic` é texto livre com
dois defaults perigosos: `'Sem assunto definido'` (falha) e `'Assunto sugerido por IA'` (o modelo
não sugeriu nada). O filtro de assunto do `BankPage` deriva de `new Set(questions.map(q => q.topic))`
— ou seja, filtra pelas strings cruas. Na prática: "Álgebra", "Álgebra Linear", "algebra",
"Álgebra linear" e "Álgebra (matrizes)" viram cinco filtros diferentes.

Para o ITA isso é evitável: o programa oficial por matéria é publicado e estável. Correção:
catálogo de assuntos (`id, subject, parent, aliases[]`), o modelo **mapeia para um id** do catálogo,
e o texto livre do modelo vai para `topicRaw` (preservado para auditoria, não para filtrar). Isso
também dá o que falta hoje: saber a **cobertura do edital** — quantas questões existem por tópico,
e quais tópicos do programa não têm nenhuma questão. Num app de rotina de estudo, essa é
provavelmente a informação mais valiosa que o banco pode produzir.

### O5 [P1] A busca não ignora acento **[medido]**

```
"algebra"  -> 0 resultado(s)
"álgebra"  -> 1 resultado(s)
```

`toLocaleLowerCase('pt-BR')` não remove diacríticos, e o filtro é `haystack.includes(query)`.
Num acervo em português isso é uma armadilha constante: "funcao", "potencia", "energia mecanica"
não encontram nada. Correção: normalizar os dois lados (`normalize('NFD').replace(/\p{Diacritic}/gu, '')`).

### O6 [P1] A dedup erra nos dois sentidos

Já visto em F3 que ela recusa a correção legítima. O outro lado: como a identidade inclui o
enunciado inteiro, a mesma questão re-extraída com um símbolo diferente (`$v_0$` vs `v₀`, ou um
`·` virando `*`) **não** é detectada como duplicata, e entra duas vezes.

A identidade certa é o par `(documento, número da questão)`, que é estável por definição. O texto
serve como *sinal secundário* para o caso de documento diferente — e aí a resposta certa não é
descartar, é enfileirar como "provável duplicata" para decisão humana.

### O7 [P1] O teto do `localStorage` e a falha que não reverte o estado **[medido]**

Custo medido de uma questão realista (enunciado de 700 caracteres, 5 alternativas, resolução de
300):

```
1620 bytes/questão
-> ~1.600 a ~3.200 questões até o teto de 5 MB (depende de o navegador contar caracteres ou bytes)
```

Um acervo de ITA (10 anos × 2 fases × ~60 questões ≈ 1.200) cabe apertado; com o IME e outros
vestibulares, estoura. E o modo de falha é ruim: `writeStorage` devolve `false` e emite um toast,
mas **`setQuestions` já aconteceu**. A questão aparece no banco, o usuário vê o erro, e no próximo
reload ela desapareceu. Estado e persistência divergem.

Correção de curto prazo: IndexedDB (assíncrono, sem teto de 5 MB, suporta índices por matéria/ano
— os filtros deixam de varrer o array inteiro). Isso é uma tarde de trabalho e resolve O7 e a
maior parte do problema de escala antes mesmo do banco relacional da Sprint 3.

### O8 [P2] `difficulty` é palpite do modelo, nunca calibrado

O modelo sugere Básica/Intermediária/Avançada a partir do enunciado, e esse valor nunca é revisto.
Mas o app **tem** o dado empírico: histórico de acertos por questão. Dificuldade observada
(`acertos/ tentativas`, com suavização para amostra pequena) é mensurável e deveria substituir ou
acompanhar a sugerida. É o que permite montar sessão "no seu nível" em vez de "no nível que o
modelo achou".

### O9 [P2] Notas por questão ficam presas à sessão

`ResponseRecord.notes` vive dentro de `StudySession`. A mesma questão resolvida em três sessões
gera três cadernos separados, sem visão consolidada. Um `QuestionNote` independente da sessão (com
histórico de tentativas ao lado) é o que transforma o banco num caderno de erros de verdade.

---

## 5. Modelo de dados proposto

O ponto central: hoje `Question` carrega sozinha três coisas que deveriam ser entidades —
documento, lote de importação e taxonomia. Separar isso é o que destrava todo o resto.

```sql
documents (          -- a prova, uma vez
  id, institution, year, phase, phase_label,
  file_name, file_path, checksum UNIQUE, page_count,
  expected_count, extracted_count, created_at
)

import_batches (     -- uma execução de extração
  id, document_id, job_id, prompt_version, model,
  started_at, finished_at, status, notes
)

topics (             -- vocabulário controlado, por matéria
  id, subject, parent_id, name, aliases TEXT[]
)

questions (
  id,
  document_id, question_number, source_order,   -- identidade estável
  batch_id,                                     -- permite desfazer o lote
  type,                                         -- objetiva | discursiva
  subject, topic_id, topic_raw, difficulty_suggested, difficulty_observed,
  statement, explanation,
  validation_state,                             -- indexado: a triagem precisa disto
  superseded_by                                 -- revisão, em vez de sobrescrever
)

alternatives (question_id, letter, text, is_correct)
answer_key   (question_id, letter, source_file, source_checksum, source_item)
figures      (question_id, document_id, page, bbox, image_path, caption)
```

`UNIQUE (document_id, question_number)` é a defesa estrutural contra F1: duas questões não podem
reivindicar o mesmo número. O banco recusa, em vez de o app fingir que está tudo bem.

Enquanto a Sprint 3 não chega, o mesmo desenho vale em IndexedDB com object stores equivalentes.

## 6. Plano em três ondas

**Onda 1 — parar de corromper dados (dias, não semanas).** Nada disso é refactor grande:

1. `source_order` separado de `questionNumber`; asserção de unicidade; quarentena quando o número
   falta (F1).
2. `expectedCount` vindo do gabarito + `missing[]` no job (F2).
3. Dedup devolve conflitos em vez de descartar; UI com *Substituir / Manter ambos* (F3).
4. Busca normalizada (O5).
5. Detecção de delimitador no CSV (F7).
6. `answerKey.checksum` persistido (F6).

**Onda 2 — tornar o acervo mantenível (1–2 semanas):**

7. Edição de questão + revalidação ao salvar (O2).
8. Entidade `Document` + `batchId` + "desfazer último lote" (O3).
9. Filtros e tela de triagem por `validationState`/alertas (O1).
10. Catálogo de assuntos + relatório de cobertura do edital (O4).
11. IndexedDB no lugar de `localStorage` (O7).

**Onda 3 — aquisição robusta (2–3 semanas):**

12. Extração fatiada por páginas, persistência incremental, retomada (F4).
13. Retenção do PDF + PNG por página para revisão de figuras (F5).
14. `xlsx` além de CSV (F7).
15. Dificuldade observada a partir do histórico (O8).

## 7. Critérios de aceite

Cada item precisa de um teste que **falhe com o defeito reintroduzido** — teste verde nos dois
estados não prova nada. Concretamente:

| Correção | Teste que a prova |
|---|---|
| F1 | Extração com 1 questão sem número → job falha ou quarentena; `new Set(nums).size === nums.length` |
| F2 | Gabarito com 60, extração com 52 → `missing = [13..20]`, status ≠ `completed` |
| F3 | Reimportar versão com alternativas completas → `conflicts.length === 1`, `fresh.length === 0` **e** a UI oferece substituição |
| F6 | Questão importada carrega `answerKey.source.checksum` igual ao do arquivo de gabarito |
| F7 | CSV com `;` → 3 colunas reconhecidas; CSV com `,` continua funcionando |
| O5 | `query: 'algebra'` acha `topic: 'Álgebra'`; e `'Álgebra'` também |

## 8. O que eu não verifiquei

- **Não chamei a API Gemini.** Não rodei uma extração real de PDF. Os defeitos F1–F6 foram medidos
  na função de reconciliação e no fluxo de importação, com dados no formato que a API produz — mas
  a frequência com que o modelo omite `questionNumber` numa prova real do ITA é desconhecida. Se
  for raro, F1 é latente e não ativo; a correção continua valendo, porque o custo do erro é um
  gabarito errado com selo de "oficial".
- **Não medi o teto real do `localStorage` no Chrome.** A extrapolação (~1.600–3.200 questões) vem
  do tamanho serializado por questão; a contagem exata depende de o navegador medir caracteres ou
  bytes.
- **Não avaliei o custo da migração para IndexedDB** nem o impacto no tempo de boot com um acervo
  grande.
- **Não testei a extração de figuras.** A proposta de PNG por página assume que a rasterização do
  PDF é viável no ambiente; não verifiquei qual biblioteca está disponível.

---

# Apêndice — auditoria contra a prova real (ITA 2025, 1ª fase)

Feita depois do diagnóstico acima, com os arquivos que já estavam em `~/Downloads`. Muda a
recomendação de aquisição, por isso está separada.

**Arquivos:** `2025_fase1.pdf` (28 pág., 1,8 MB), `gabarito_2025.pdf` (1 pág.),
`programa_2026.pdf` (7 pág.). Os dois primeiros são **exatamente** os arquivos de uma extração
já tentada em 18/10 — os uploads órfãos em `server/uploads/` têm os mesmos tamanhos
(1788032 e 36514 bytes) e ficaram lá porque o `cleanup()` não roda quando o processo morre.

## A1. A prova tem 48 questões, não 60

O próprio caderno declara: *"Esta prova é composta de 48 questões de múltipla escolha (numeradas
de 1 a 48) com 12 questões de Matemática, 12 de Física, 12 de Química e 12 de Inglês"*. A
estimativa que eu havia feito antes (10 anos × 2 fases × ~60) superestima o acervo em ~20%: são
**576 questões** em 10 anos de 1ª fase, não ~1.200.

## A2. O texto é nativo — mas metade dele é invisível para um parser ingênuo **[medido]**

O PDF é digital (Adobe Acrobat Pro 11), não digitalizado. Ainda assim:

```
ocorrências NFC "Questão" precomposto: 24
ocorrências NFD "Questão" decomposto  : 24
```

O mesmo documento mistura as duas formas de normalização Unicode, 24 e 24. Matemática (1–12) e
Química (25–36) vêm em NFC; Física (13–24) e Inglês (37–48) vêm em NFD (`a` + til combinante).
Um `grep "Questão"` recupera **exatamente metade** da prova, e a outra metade desaparece sem
erro. É o modo de falha F2 na prática, num documento real.

O mesmo defeito atinge o app: a chave de dedup e a busca comparam strings cruas, então metade
deste acervo seria **invisível à busca** e **nunca detectada como duplicata**. Uma linha resolve
três problemas de uma vez:

```ts
const canonical = (s: string) => s.normalize('NFC');
// ingestão, dedup e busca passam a operar sobre a forma canônica
```

## A3. O texto nativo não basta para o enunciado

A camada de texto destrói a matemática: `i 2 = −1` (por i² = −1), `z 2`, frações viram `1p`
sobre `2`, radicais caem em linha própria. Um parser determinístico produziria estrutura correta
e conteúdo ilegível.

## A4. O gabarito entrega três coisas que o pipeline ignora

O gabarito oficial dá, de graça e de forma autoritativa:

1. **contagem esperada** — 48 linhas;
2. **fronteiras de matéria** — Matemática 1–12, Física 13–24, Química 25–36, Inglês 37–48;
3. **questões anuladas** — 9 e 18, marcadas `(*)`, com a nota *"consideradas corretas para todos
   os candidatos"*.

Hoje o código **pede ao modelo que adivinhe a matéria** (`suggestedSubject`) quando o gabarito
poderia determiná-la; não compara a contagem; e trata anulada como "sem gabarito", o que faz o
`scoringService` excluir a questão do numerador **e** do denominador (nota calculada sobre 46 em
vez de 48). Anulada não é ausência de dado: é um estado próprio (`annulled: true`).

## A5. Figuras: 8 de 48 (~17%)

Oito questões citam figura, gráfico ou esquema. É um problema real — um sexto do acervo fica
incompleto sem a imagem — mas **não é bloqueante**, e não justifica adiar a importação. Isso
rebaixa a mídia de "Sprint 4, antes de tudo" para "onda 2, junto com a revisão".

## A6. Consequência para a arquitetura de aquisição

A conclusão não é "modelo **ou** parser". É:

> **Parser determinístico para a estrutura, modelo só para o enunciado, gabarito como oráculo, e
> um diff obrigatório entre os dois.**

O fluxo:

1. `pdftotext -layout` + normalização NFC → esqueleto: números presentes, letras de alternativa,
   contagem por matéria (do gabarito), páginas.
2. Gabarito → `expectedCount`, fronteira de matéria por número, lista de anuladas.
3. Modelo → transcreve o enunciado de cada questão (é o único que vê o sobrescrito).
4. **Verificação**: toda questão do esqueleto apareceu na saída do modelo? O número de
   alternativas bate? A matéria bate com a fronteira do gabarito? O que não bater vai para
   quarentena com página e número — não para o banco.

Com isso F1 e F2 deixam de ser "detectados" e passam a ser **estruturalmente impossíveis**: a
numeração vem do documento, não do modelo, e a contagem é conferida contra a fonte oficial.

Custo: o modelo continua sendo chamado, mas para uma tarefa menor (transcrever, não estruturar),
o que reduz truncamento e alucinação — e o resultado fica verificável.

---

# 10. O que foi executado

Os sete itens da ordem recomendada, um commit cada, com testes validados por mutação (o teste
tem de falhar quando o defeito volta).

| # | Item | Commit | O que mudou |
|---|---|---|---|
| 0 | Ponto de restauração | `f2d5831` | `git init` + baseline (o projeto não era repositório) |
| 1 | Normalização | `9e0b44b` | `textService`: NFC no armazenamento, `foldText` na busca e na dedup. Fecha a metade invisível do acervo e a busca sem acento |
| 2 | Identidade | `83fe28c` | `source.order` separado de `questionNumber`; número duplicado perde a identidade; casamento por ordinal só com contagens iguais; id determinístico; checksum do gabarito propagado |
| 3 | Cobertura | `ad87aa0` | `auditCoverage`: contagem do gabarito como oráculo; status `completed_with_gaps`; lista compacta das ausentes no modal |
| 4 | Conflitos + edição | `32bc4e7` | dedup devolve `conflicts` com diferenças; `ImportConflictsModal`; `AddQuestionModal` em modo edição; `revalidateQuestion` |
| 5 | Triagem | `af8dad9` | `QuestionValidationFilter`; faixa de triagem no Banco com contagens clicáveis |
| 6 | Lote | `56e63c5` | `ImportBatch` + `undoBatch`; "Desfazer última importação"; aviso de PDF já ingerido por checksum |
| 7 | Anulada | `4bd92e7` | `annulled: true`; conta como acerto e entra no denominador nos quatro sítios de pontuação |

**Estado:** 57 → **114 testes** (18 arquivos), typecheck limpo, build de produção OK.

## O que continua pendente, e por quê

- **F4 — extração fatiada por páginas.** É a mudança que exige mexer no `extractExamFromPdf` e no
  ciclo do job. Continua sendo "tudo ou nada" por chamada.
- **F5 — retenção do PDF e PNG por página.** Depende de decidir onde guardar os arquivos; hoje o
  `cleanup()` apaga. Sem isso, revisar figura continua impossível.
- **F7 — CSV com `;` (Excel pt-BR).** Ainda colapsa em uma coluna. É pequeno e independente; ficou
  fora da ordem de sete itens, mas é o próximo da fila por custo/benefício.
- **O4 — catálogo de assuntos.** O filtro de assunto ainda deriva de strings cruas.
- **O7 — IndexedDB.** O teto de 5 MB e a falta de índices continuam. `writeStorage` ainda falha
  depois do `setState` (a questão aparece e desaparece no reload).
- **Entidade `Document` completa.** O `ImportBatch` cobre "desfazer lote" e "quais provas já
  ingeri", mas a tabela de documentos (com `expected_count`, páginas, arquivo) fica para quando o
  armazenamento mudar.

## O que eu não verifiquei

**Não olhei a interface num navegador de verdade.** Tentei: o Chromium headless deste ambiente
morre na inicialização (`GPU process isn't usable`, mesmo com SwiftShader), então a verificação
visual por CDP não rodou. O que existe é teste de render em jsdom cobrindo o comportamento — a
faixa de triagem aparece e filtra, o "Desfazer" pede confirmação — mas **layout e espaçamento não
foram vistos**. Antes de confiar na aparência, abra `npm run dev` e olhe o Banco com algumas
questões com alerta.
