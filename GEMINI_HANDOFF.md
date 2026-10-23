# Handoff para continuidade com Gemini

Leia primeiro `README.md`, `src/types.ts`, `src/data/seed.ts` e `src/App.tsx`. Preserve a direção visual editorial acadêmica já implementada: fundo marfim, verde-petróleo, terracota em pequenos acentos, títulos serifados, interface sóbria e responsiva. Evite gradientes chamativos, glassmorphism, excesso de cards e componentes genéricos de “AI slop”.

## Estado atual

A aplicação React + TypeScript + Vite já tem navegação de visão geral, banco de questões, sessões/simulados, revisão, desempenho, resolução individual e resultados. O estado de questões e sessões é persistido em `localStorage`. A importação em lote aceita JSON e CSV estruturados; o seed contém apenas questões sintéticas de demonstração.

## Regras funcionais que devem permanecer

1. `Question` é o registro de conteúdo; a resposta do estudante vive em `ResponseRecord` vinculada à questão dentro de `StudySession`.
2. A seleção e a ordem das questões são próprias de cada sessão.
3. No modo `treino`, o estudante pode conferir gabarito e explicação após registrar uma alternativa.
4. No modo `simulado`, não revelar gabarito ou explicação antes do término.
5. Toda alternativa, anotação discursiva, marcação de revisão e navegação deve ser salva automaticamente.
6. Importação não deve substituir silenciosamente dados existentes. Preserve origem, ano, fase, número da questão, arquivo e página quando fornecidos.
7. O gabarito oficial deve ser guardado como dado da fonte, com procedência explícita; conteúdo gerado por IA não deve se passar por oficial.
8. Nunca colocar chave da API Gemini no bundle cliente. A integração com modelos deve passar por endpoints de backend e variáveis de ambiente.
9. Não assumir que uma questão foi importada corretamente só porque o JSON é válido. Registrar alertas estruturais e deixar rastreável o documento de origem.
10. Antes de implementar um grande refactor, explicar um plano curto e executar testes/build após cada etapa concluída.

## Próximas etapas recomendadas

### Sprint 1 — Separar camadas e persistência (CONCLUÍDA)

- [x] Extraídos componentes de `App.tsx` para arquivos modulares independentes (`components/layout`, `components/views`, `components/modals`, `components/question`, `components/session`).
- [x] Criada camada `services` para armazenamento com resiliência, validação de questões, importação CSV/JSON, deduplicação, estatísticas de pontuação e backup.
- [x] Implementada exportação e restauração completa de backup JSON (questões, sessões, ordem, respostas, anotações, revisões e resultados) com suporte a mesclagem segura (`merge`) e substituição explícita (`replace`).
- [x] Adicionados 35 testes automatizados (Vitest + Testing Library) cobrindo parsing CSV/JSON, normalização, deduplicação, pontuação e discursivas, ciclo de vida de sessões e timers, backup/restore e retenção de foco ao digitar.
- [x] Documentado `.env.example` sem exposição de credenciais cliente.

### Sprint 2 — Importador de provas via Gemini (CONCLUÍDA)

- [x] Backend com endpoints em Node.js/Express (`server/index.ts`, `server/jobManager.ts`, `server/geminiService.ts`).
- [x] Endpoints implementados: `GET /api/health`, `POST /api/extract/jobs`, `GET /api/extract/jobs/:id`, `POST /api/extract/jobs/:id/cancel`.
- [x] Recebimento de PDFs da prova e do gabarito oficial como fontes estritamente separadas.
- [x] Extração multimodal com saída estruturada usando a SDK oficial `@google/genai` e modelo `gemini-3.8-flash`.
- [x] Metadados persistidos: checksum SHA-256 do arquivo original, página no PDF, número da questão, estado de validação, confiança e versão do prompt (`ita-extractor-v1.0`).
- [x] Reconciliação e validação determinística: gabaritos são estritamente atribuídos pelo documento oficial (procedência explícita); nenhum gabarito é inventado ou inferido.
- [x] Fila de revisão por exceção (`reviewQueue`): itens com alertas estruturais ou menções a diagramas/figuras são destacados sem bloquear a importação em lote de questões válidas.
- [x] Upload protegido com limite de tamanho (50 MB), cancelamento, tratamento de erros e limpeza segura de arquivos temporários.
- [x] Isolamento seguro de `GEMINI_API_KEY` exclusivamente no ambiente de servidor (`server/.env`), protegido por `.gitignore`.
- [x] Interface de usuário editorial acadêmica com modal de upload, acompanhamento em tempo real do progresso da extração e visualização de exceções antes da importação para o banco local.

### Sprint 3 — Banco persistente (Próxima etapa)

### Sprint 3 — Banco persistente

- Escolher banco relacional após validar as necessidades de arquivos/imagens.
- Criar tabelas distintas para questões, alternativas, fontes/edições de prova, imagens/arquivos, sessões, itens da sessão, respostas e revisões.
- Definir migrações, índices de deduplicação e contratos da API.
- Não misturar o histórico de respostas com o cadastro canônico da questão.

### Sprint 4 — Questões com mídia e matemática

- Preservar imagens e diagramas extraídos ou recortados por página, com referência e licença/fonte.
- Adotar renderização segura para matemática (por exemplo, KaTeX) e sanitização de HTML/Markdown.
- Tratar questões discursivas e redações como tipos de resposta próprios, sem obrigar alternativas múltiplas.

## Critério de aceite do próximo trabalho

O projeto deve instalar, iniciar e compilar com sucesso. A resolução individual deve continuar responsiva e não perder foco/cursor em atualizações de estado. Acrescentar testes para regressões. Documentar env vars em `.env.example` sem valores secretos.
