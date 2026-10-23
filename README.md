# Rotina ITA — aplicação inicial

Aplicação web inicial para organizar um banco de questões, montar sessões de estudo e resolver uma questão por tela. A direção visual segue um editorial acadêmico: marfim, verde-petróleo, tipografia serifada nos títulos, bordas discretas e componentes arredondados sem excesso de cartões.

> **Importante:** as questões pré-carregadas são exemplos sintéticos para testar a interface. Não são questões oficiais do ITA.

## Requisitos

- Node.js 22.12 ou superior (recomendado)
- npm 10+

## Executar localmente

```bash
npm install
npm run dev
```

Abra a URL local exibida no terminal, normalmente `http://localhost:5173`.

Para validar os arquivos e executar testes:

```bash
npm run typecheck
npm test
npm run build
npm run preview
```

## O que já funciona

- Painel de visão geral e indicadores calculados a partir das sessões concluídas.
- Banco pesquisável com filtros por matéria, dificuldade e origem.
- Seleção múltipla de questões para montar uma sessão.
- Modos **Treino** e **Simulado**, com comportamento distinto do gabarito.
- Tela individual de resolução, navegação entre questões e grade de acesso direto.
- Salvamento automático de alternativa, resolução discursiva, marcações de revisão e progresso no `localStorage`.
- Cronômetro opcional; no modo simulado, o tempo máximo encerra a sessão automaticamente.
- Resultado de sessão com resumo questão a questão e atalho para resolver novamente.
- Cadastro manual de questões.
- Importação em lote de JSON e CSV, com validação estrutural básica, alertas e deduplicação.
- **Importador de Provas via Gemini (PDF):** backend dedicado com a API Gemini 3.8 Flash (`@google/genai`), extração estruturada de cadernos em PDF, reconciliação determinística com gabarito oficial em fonte separada, rastreabilidade por checksum SHA-256 e fila de revisão por exceção.
- Exportação e restauração completa de backup JSON (questões, sessões, respostas, notas, revisões e resultados) com estratégias de mesclagem ou substituição.
- Camada de persistência segura com tratamento de quota excedida e proteção contra corrupção.
- Layout adaptado para telas menores.

## Execução com Backend Gemini

Para rodar a aplicação com suporte ao importador de provas via Gemini:

```bash
# Iniciar o servidor backend (porta 3001)
npm run server

# Iniciar o frontend Vite (porta 5173 com proxy /api)
npm run dev
```

## Persistência e limitações atuais

A aplicação opera inteiramente client-side para o banco de questões e sessões do estudante: os dados são salvos com segurança no armazenamento local do navegador (`localStorage`) com verificação de integridade e tratamento de falhas. A chave da API Gemini fica isolada estritamente no servidor (`server/.env`). A migração para banco de dados relacional (PostgreSQL/SQL) está planejada para a Sprint 3.

A correção automática depende de `answerKey` confiável. O protótipo não considera a IA como fonte de verdade e avisa na interface que a validação de estrutura não confirma a fidelidade à prova original.

## Formato JSON de importação

O arquivo pode ser um array ou um objeto com a propriedade `questions`:

```json
{
  "questions": [
    {
      "subject": "Matemática",
      "topic": "Álgebra",
      "difficulty": "Intermediária",
      "statement": "Enunciado completo...",
      "alternatives": {
        "A": "Alternativa A",
        "B": "Alternativa B",
        "C": "Alternativa C",
        "D": "Alternativa D",
        "E": "Alternativa E"
      },
      "answerKey": "C",
      "explanation": "Resolução comentada...",
      "source": {
        "label": "ITA",
        "year": 2024,
        "phase": "1ª fase",
        "questionNumber": 1,
        "fileName": "ita-2024.pdf",
        "page": 3
      },
      "tags": ["álgebra"]
    }
  ]
}
```

Também são aceitos nomes de campos em português usados com frequência, como `enunciado`, `materia`, `assunto`, `dificuldade`, `alternativas`, `gabarito`, `resolucao` e `origem`. Para CSV, utilize cabeçalhos `statement`/`enunciado`, `subject`/`materia`, `topic`/`assunto`, `difficulty`/`dificuldade`, `answerkey`/`gabarito` e colunas `A`, `B`, `C`, `D`, `E`.

## Estrutura

```text
rotina-ita-app/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── src/
│   ├── App.tsx          # Fluxo principal e telas
│   ├── styles.css       # Design responsivo
│   ├── main.tsx         # Entrada React
│   ├── types.ts         # Tipos de domínio
│   └── data/seed.ts     # Exemplos sintéticos
├── GEMINI_HANDOFF.md
├── GEMINI_NEXT_PROMPT.md
├── examples/
│   └── import-template.json
└── .gitignore
```
