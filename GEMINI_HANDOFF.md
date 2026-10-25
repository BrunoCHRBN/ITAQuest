# Handoff de Engenharia e Continuidade

[English version](docs/DEVELOPMENT_GUIDE.md) | [Documentação de Arquitetura](docs/ARQUITETURA.md)

Este documento resume o estado técnico e as garantias do projeto **Rotina ITA** para engenheiros e agentes de IA que assumirem o desenvolvimento.

---

## Estado Atual da Base

- **Linha de base:** 114 testes automatizados em 18 arquivos (Vitest), todos aprovados. Verificação estática de tipos (`tsc --noEmit`) limpa e build de produção (`vite build`) funcional.
- **Frontend:** React 19 + TypeScript + Vite. Interface baseada em sistema de design editorial acadêmico (marfim, verde-petróleo, terracota, tipografia serifada, KaTeX para fórmulas matemáticas).
- **Backend:** Node.js + Express 5 em `server/`. Suporta extração de cadernos de prova em PDF via API Gemini 3.8 Flash (`@google/genai`) com reconciliação determinística contra o gabarito oficial.
- **Persistência atual:** `localStorage` com tratamento de falhas de quota, versionamento de chaves e normalização canônica Unicode NFC.

---

## Invariantes Obrigatórias

1. **Separação de Identidade:** `source.order` representa a sequência ordinal no documento; `source.questionNumber` representa o número impresso no caderno. Sem número impresso, a questão permanece com `questionNumber: undefined` e entra em quarentena (`validationState: 'incompleta'`), prevenindo deslocamento e apropriação indevida de gabaritos vizinhos.
2. **Oráculo de Gabarito:** Gabaritos oficiais vêm exclusivamente do documento de gabarito fornecido pela banca. Modelos de linguagem jamais inventam ou inferem gabaritos oficiais. A contagem de itens do gabarito é o oráculo de completude (`expectedCount`).
3. **Anulações:** Questões com `annulled: true` contam como acerto e integram numerador e denominador na pontuação (`scoringService`).
4. **Normalização:** Todo texto armazenado é convertido para Unicode NFC. Buscas e deduplicações operam sobre projeção canônica sem diacríticos (`foldText`).
5. **Gestão de Conflitos:** A reimportação de versões corrigidas de questões não descarta dados silenciosamente; conflitos são encaminhados para o modal de decisão do usuário.
6. **Lotes e Reversibilidade:** Importações geram registros `ImportBatch` com checksum SHA-256, permitindo desfazer o último lote importado de forma atômica.
7. **Segurança de Credenciais:** `GEMINI_API_KEY` reside unicamente no ambiente do servidor (`server/.env`), nunca no bundle do cliente.
8. **Integridade de Foco:** Campos de digitação de respostas discursivas e formulários de edição mantêm foco contínuo do cursor durante re-renderizações.

---

## Próximos Passos de Desenvolvimento

Consulte os roteiros detalhados:
- [Diagnóstico Técnico e Roadmap](docs/PROPOSTA_ORGANIZACAO_E_AQUISICAO_DE_QUESTOES.md)
- [Diretrizes de Desenvolvimento](docs/GUIA_DESENVOLVIMENTO.md)

Principais itens do backlog:
1. **F7:** Suporte a delimitador ponto e vírgula (`;`) no `importService` e suporte a planilhas `.xlsx`.
2. **F5:** Retenção local de PDFs e geração de recortes PNG por página para visualização de figuras.
3. **O7:** Migração da camada de persistência para IndexedDB.
4. **O4:** Catálogo hierárquico de tópicos do edital oficial do ITA.
5. **F4:** Extração fatiada em blocos de páginas com persistência incremental no job.
