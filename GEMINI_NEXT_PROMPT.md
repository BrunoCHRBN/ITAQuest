# Prompt de Continuidade de Desenvolvimento — ITAQuest

Este documento contém o contexto de entrada e instruções para orientar agentes autônomos ou desenvolvedores na continuidade das tarefas do projeto **ITAQuest**.

---

## Contexto do Projeto

Você está dando continuidade ao desenvolvimento do projeto **ITAQuest**. Não recrie a aplicação do zero e preserve rigorosamente o sistema visual editorial acadêmico (fundo marfim, verde-petróleo, terracota em detalhes pontuais, tipografia serifada nos títulos, ausência de glassmorphism e gradientes chamativos).

Antes de implementar qualquer alteração, leia integralmente:
1. `README.md`
2. `docs/ARQUITETURA.md` (ou `docs/ARCHITECTURE.md`)
3. `docs/PROPOSTA_ORGANIZACAO_E_AQUISICAO_DE_QUESTOES.md` (ou `docs/QUESTION_ACQUISITION_AND_ORGANIZATION.md`)
4. `docs/GUIA_DESENVOLVIMENTO.md` (ou `docs/DEVELOPMENT_GUIDE.md`)

Execute a verificação de sanidade técnica antes de iniciar qualquer trabalho:

```bash
npm run typecheck
npm test
```

O projeto possui **114 testes automatizados em 18 arquivos**, todos verdes. Nenhuma regressão é tolerada.

---

## Tarefa Imediata Recomendada: Onda 2 (Ingestão e Armazenamento)

Escolha e execute um dos itens prioritários do backlog abaixo:

### Tarefa 1: Suporte a CSV com Ponto e Vírgula (`;`) e Arquivos `.xlsx` (F7)
- **Objetivo:** Permitir a importação direta de arquivos CSV gerados pelo Excel no padrão brasileiro (delimitador `;`), além de suportar leitura de arquivos `.xlsx`.
- **Módulos:** `src/services/importService.ts`, `src/__tests__/importService.test.ts`.
- **Requisitos:**
  1. Detectar o delimitador da linha de cabeçalho (`,`, `;`, `\t`).
  2. Preservar o parsing com aspas e quebras de linha em enunciados longos.
  3. Adicionar testes unitários para CSV com ponto e vírgula e arquivos com delimitadores mistos ou ausentes.

### Tarefa 2: Retenção Local de PDFs e Renderização de Páginas PNG (F5)
- **Objetivo:** Preservar os arquivos de prova PDF enviados para permitir a inspeção visual de diagramas e circuitos elétricos durante a triagem de questões.
- **Módulos:** `server/index.ts`, `server/jobManager.ts`, `server/geminiService.ts`.
- **Requisitos:**
  1. Salvar os arquivos enviados em diretório persistente (`server/documents/`), indexados pelo checksum SHA-256.
  2. Implementar endpoint para servir a página específica em imagem PNG para conferência visual lado a lado na UI.

### Tarefa 3: Migração de Armazenamento para IndexedDB (O7)
- **Objetivo:** Superar a barreira física de 5 MB do `localStorage` para viabilizar o armazenamento de múltiplos anos de exames completos com figuras.
- **Módulos:** `src/services/storageService.ts`, `src/__tests__/storageService.test.ts`.
- **Requisitos:**
  1. Criar adaptador assíncrono para IndexedDB mantendo compatibilidade de API com os serviços existentes.
  2. Manter migração transparente dos dados atualmente salvos em `localStorage`.
  3. Validar operações com testes automatizados em ambiente jsdom.

---

## Regras de Entrega

1. Nenhuma chave de API ou credencial deve ser exposta no código cliente (`src/`).
2. Textos de entrada continuam exigindo normalização canônica NFC e buscas com `foldText`.
3. Nunca invente gabaritos oficiais; o documento de gabarito é o único oráculo de respostas.
4. Execute `npm run typecheck` e `npm test` antes de concluir a entrega.
