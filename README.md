# Rotina ITA

[English version](README.en.md)

Aplicação web para organização de acervo, montagem de sessões de estudo e resolução de questões focadas no vestibular do Instituto Tecnológico de Aeronáutica (ITA).

A interface adota direção visual editorial acadêmica: fundo marfim, verde-petróleo, acentos terracota, tipografia serifada nos títulos, alta densidade de informação e renderização nativa de fórmulas matemáticas via KaTeX.

---

## Sumário

- [Visão Geral](#visão-geral)
- [Arquitetura](#arquitetura)
- [Funcionalidades Implementadas](#funcionalidades-implementadas)
- [Pré-requisitos e Instalação](#pré-requisitos-e-instalação)
- [Execução](#execução)
- [Validação e Testes](#validação-e-testes)
- [Configuração de Ambiente](#configuração-de-ambiente)
- [Estrutura do Repositório](#estrutura-do-repositório)
- [Documentação Detalhada](#documentação-detalhada)

---

## Visão Geral

O projeto foi construído para atender às especificidades da preparação para o ITA:
- Questões de alta complexidade com fórmulas matemáticas e enunciados densos.
- Diferenciação estrita entre questões objetivas e discursivas.
- Resolução com rastreabilidade da fonte (ano, fase, caderno, número impresso).
- Garantia de que gabaritos oficiais nunca sejam gerados ou alucinados por inteligência artificial.

---

## Arquitetura

O sistema é dividido em três camadas:

1. **Frontend (SPA):**
   - React 19 + TypeScript 5.9 + Vite 8.
   - Renderização matemática com KaTeX (`katex`).
   - Ícones com Lucide React (`lucide-react`).
   - Persistência no navegador via `localStorage` com tratamento de quota, normalização canônica Unicode (NFC) e versionamento de esquema.

2. **Backend de Extração (Node.js/Express):**
   - Express 5 + TypeScript (`tsx`).
   - SDK oficial `@google/genai` (modelo Gemini 3.8 Flash).
   - Gerenciamento de tarefas em memória (`server/jobManager.ts`) com suporte a cancelamento e progresso.
   - Auditoria e reconciliação determinística entre o caderno de questões e o gabarito oficial (`server/geminiService.ts`).
   - Proteção de credenciais: a chave `GEMINI_API_KEY` reside exclusivamente no ambiente do servidor.

3. **Garantias de Integridade de Dados:**
   - **Identidade Estável:** separação entre ordinal de extração (`source.order`) e número impresso da questão (`source.questionNumber`).
   - **Oráculo do Gabarito Oficial:** a contagem e as respostas oficiais são extraídas do documento de gabarito; divergências geram status `completed_with_gaps` e quarentena de itens faltantes.
   - **Normalização Unicode:** armazenamento em NFC e busca com remoção de diacríticos (`foldText`), evitando que caracteres equivalentes fiquem invisíveis.
   - **Gestão de Conflitos:** reimportação não sobrescreve silenciosamente questões alteradas; exibe modal com diff para decisão do usuário (Substituir, Manter ambos ou Ignorar).
   - **Reversibilidade:** importações criam registros de lote (`ImportBatch`) com checksum SHA-256 e opção de desfazer a operação completa.

---

## Funcionalidades Implementadas

### Banco e Triagem de Questões
- Busca textual normalizada (ignora maiúsculas, minúsculas e acentuação).
- Filtros estruturais por matéria, dificuldade, origem e ano.
- **Barra de Triagem de Validação (`validationState`):** contadores e filtros rápidos para questões limpas, com alertas, sem gabarito oficial, com referência a figuras, incompletas ou anuladas.
- Edição direta de questões existentes no banco com revalidação de campos obrigatórios ao salvar.
- Exclusão individual de questões e limpeza total do banco sob confirmação.

### Sessões de Estudo e Simulados
- Montagem de sessão por seleção livre ou filtros do banco.
- **Modo Treino:** gabarito oficial e resolução comentada disponíveis imediatamente após a tentativa.
- **Modo Simulado:** gabarito oculto até a finalização, cronômetro regressivo com encerramento automático no tempo limite.
- Navegação rápida por grade numérica e atalhos de teclado:
  - `1` a `5` ou `A` a `E`: seleção de alternativa.
  - `Setas (Esquerda / Direita)` ou `J / K`: questão anterior e seguinte.
  - `M`: alternar marcação para revisão.
- Folha de constantes físicas e químicas oficiais do ITA acessível diretamente durante a resolução.
- Salvamento automático contínuo de respostas, progresso e notas discursivas.
- Relatório pós-sessão detalhado com tempo por questão, taxa de acerto e revisão direcionada.

### Importação e Ingestão de Provas
- **Importação via Gemini (PDF):**
  - Upload separado do PDF da prova e do PDF do gabarito oficial.
  - Extração de texto e estruturação multimodal.
  - Comparação com a contagem esperada do gabarito oficial.
  - Detecção de questões anuladas (marcadas com `annulled: true` e computadas corretamente na pontuação).
  - Cálculo de checksum SHA-256 para evitar reingestão acidental de provas já processadas.
  - Modal de resolução de conflitos quando houver sobreposição com questões existentes.
- **Importação JSON / CSV:**
  - Suporte a schema em português e inglês.
  - Validação estrita de alternativas e campos mínimos.
- **Desfazer Importação:** remoção atômica do último lote importado sem afetar sessões ou questões cadastradas previamente.

### Backup e Restauração
- Exportação completa em JSON contendo questões, histórico de sessões, notas, respostas e lotes.
- Restauração com suporte a estratégias de **Mesclagem** (`merge`) ou **Substituição total** (`replace`).

---

## Pré-requisitos e Instalação

- **Node.js:** versão 22.12.0 ou superior.
- **npm:** versão 10 ou superior.

Clone o repositório e instale as dependências:

```bash
git clone https://github.com/BrunoCHRBN/rotina-ita-app.git
cd rotina-ita-app
npm install
```

---

## Execução

### Modo Somente Frontend (Simulações e Banco Local)

Inicia o servidor de desenvolvimento na porta `5173`:

```bash
npm run dev
```

Acesse no navegador: `http://localhost:5173`

### Modo Completo (Frontend + Backend de Extração Gemini)

Em terminais separados:

```bash
# Terminal 1: Servidor de extração de PDFs (porta 3001)
npm run server

# Terminal 2: Servidor Vite (porta 5173 com proxy reverso configurado para /api)
npm run dev
```

---

## Validação e Testes

O projeto conta com suíte automatizada de 114 testes cobrindo serviços, componentes e integração de backend:

```bash
# Validação estática de tipos
npm run typecheck

# Execução da suíte completa de testes (Vitest)
npm test

# Build de produção
npm run build

# Pré-visualização do bundle de produção
npm run preview
```

Para executar o script de diagnóstico de integridade e medições empíricas:

```bash
npx tsx scripts/probe-diagnostico.ts
```

---

## Configuração de Ambiente

Para habilitar a extração de cadernos PDF com a API Gemini:

1. Crie o arquivo `server/.env` a partir do modelo:
   ```bash
   cp .env.example server/.env
   ```
2. Defina a variável de ambiente:
   ```env
   GEMINI_API_KEY=sua_chave_aqui
   PORT=3001
   ```

> **Aviso de Segurança:** O arquivo `server/.env` está listado no `.gitignore` e jamais deve ser incluído no controle de versão. Nenhuma chave de API deve ser exposta no código cliente (`src/`).

---

## Estrutura do Repositório

```text
rotina-ita-app/
├── index.html                  # Ponto de entrada HTML
├── package.json                # Dependências e scripts npm
├── vite.config.ts              # Configuração Vite com proxy para /api
├── tsconfig.json               # Configuração TypeScript
├── .env.example                # Modelo de variáveis de ambiente do servidor
├── docs/                       # Documentação técnica detalhada
│   ├── ARQUITETURA.md          # Arquitetura e invariantes de dados (PT)
│   ├── ARCHITECTURE.md         # Architecture and data invariants (EN)
│   ├── PROPOSTA_ORGANIZACAO_E_AQUISICAO_DE_QUESTOES.md # Diagnóstico e roadmap (PT)
│   ├── QUESTION_ACQUISITION_AND_ORGANIZATION.md        # Technical proposal (EN)
│   ├── GUIA_DESENVOLVIMENTO.md # Diretrizes para desenvolvedores e agentes (PT)
│   └── DEVELOPMENT_GUIDE.md    # Developer and agent workflow guide (EN)
├── scripts/
│   └── probe-diagnostico.ts    # Script de teste e medição empírica de integridade
├── server/                     # Backend de extração multimodal
│   ├── index.ts                # Servidor Express e rotas /api
│   ├── jobManager.ts           # Gerenciador de fila de processamento em memória
│   ├── geminiService.ts        # Extração, reconciliação e oráculo de gabarito
│   ├── integrity.ts            # Cálculo de checksum SHA-256
│   └── types.ts                # Tipos de dados específicos do servidor
├── src/                        # Aplicação cliente (React)
│   ├── main.tsx                # Bootstrap da aplicação
│   ├── App.tsx                 # Roteamento interno e composição de estado
│   ├── styles.css              # Sistema de design editorial acadêmico
│   ├── types.ts                # Definições de tipos centrais de domínio
│   ├── components/             # Componentes modulares de UI
│   │   ├── layout/             # Shell, sidebar, cabeçalho e navegação
│   │   ├── views/              # Telas (Banco, Sessão, Resolução, Visão Geral)
│   │   ├── modals/             # Modais (Upload Gemini, Conflitos, Edição)
│   │   ├── question/           # Renderizador KaTeX, alternativas, badges
│   │   └── session/            # Cronômetro, folha de constantes, grade
│   ├── services/               # Regras de negócio e persistência
│   │   ├── textService.ts      # Normalização NFC e busca foldText
│   │   ├── questionService.ts  # Deduplicação, validação e filtros
│   │   ├── sessionService.ts   # Ciclo de vida de sessões e pontuação
│   │   ├── scoringService.ts   # Cálculo de desempenho e anuladas
│   │   ├── storageService.ts   # Camada localStorage resiliente
│   │   ├── batchService.ts     # Gerenciamento e reversão de lotes
│   │   ├── backupService.ts    # Exportação e importação de backups
│   │   └── importService.ts    # Parsers de JSON e CSV
│   └── __tests__/              # 18 suítes com 114 testes automatizados
└── examples/
    └── import-template.json    # Exemplo canônico de arquivo JSON para importação
```

---

## Documentação Detalhada

- [Arquitetura e Invariantes de Dados](docs/ARQUITETURA.md)
- [Diagnóstico, Proposta e Auditoria da Prova do ITA](docs/PROPOSTA_ORGANIZACAO_E_AQUISICAO_DE_QUESTOES.md)
- [Guia de Desenvolvimento e Roadmap](docs/GUIA_DESENVOLVIMENTO.md)
- [English Documentation Index](README.en.md)
