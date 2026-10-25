# Guia de Desenvolvimento e Contribuição

[English version](DEVELOPMENT_GUIDE.md)

Este documento orienta desenvolvedores e agentes autônomos na manutenção e evolução do projeto **Rotina ITA**.

---

## 1. Princípios de Engenharia e Design

1. **Direção Visual Editorial Acadêmica:**
   - Paleta de cores: marfim (`#faf8f5`), verde-petróleo escuro (`#1a3a3a`), terracota (`#c85a32`) em acentos controlados, cinza neutro nas bordas.
   - Tipografia: serifada nos títulos principais, sans-serif legível e neutra para blocos de enunciados e tabelas.
   - Componentes: foco em densidade de informação, ausência de cartões desnecessários, sem gradientes chamativos e sem efeitos de vidro (*glassmorphism*).

2. **Garantia de Não Regressão:**
   - Antes de qualquer commit, execute:
     ```bash
     npm run typecheck
     npm test
     ```
   - O projeto mantém 114 testes automatizados em 18 arquivos. Nenhuma alteração deve quebrar os testes existentes. Novas regras de negócio exigem novos testes unitários com validação defensiva.

3. **Retenção de Foco em Elementos Interativos:**
   - O formulário de resolução discursiva e os campos de edição em modais não podem perder o foco do cursor ou reiniciar o estado durante atualizações de digitação (`componentsFocus.test.tsx`).

4. **Isolamento de Segredos e Credenciais:**
   - Nunca importe variáveis de ambiente com chaves de API dentro do código executado no navegador (`src/`).
   - Toda integração com provedores de IA deve ocorrer via backend Node.js (`server/`), lendo credenciais de `server/.env`.

5. **Integridade Canônica de Dados:**
   - Textos inseridos ou extraídos devem ser normalizados para a forma canônica Unicode NFC (`normalize('NFC')`).
   - Buscas devem utilizar `foldText` para garantir correspondência insensível a acentuação.
   - O gabarito oficial é imutável e autoritativo; nenhum modelo de linguagem deve deduzir ou substituir o gabarito oficial.

---

## 2. Fluxo de Trabalho e Comandos

### Instalação de Dependências

```bash
npm install
```

### Desenvolvimento Local

```bash
# Executar frontend em modo desenvolvimento (porta 5173 com proxy para backend)
npm run dev

# Executar backend de extração multimodal (porta 3001)
npm run server
```

### Verificação de Qualidade e Testes

```bash
# Verificação de tipos TypeScript sem emitir arquivos
npm run typecheck

# Execução da suíte completa de testes unitários e de integração
npm test

# Execução em modo contínuo de observação
npm run test:watch

# Execução do script de diagnóstico de integridade
npx tsx scripts/probe-diagnostico.ts
```

### Build e Pré-visualização

```bash
npm run build
npm run preview
```

---

## 3. Backlog Técnico Priorizado

### Prioridade 1: Ingestão e Formatos (Onda 2)
- **F7: Suporte a CSV com `;` e Planilhas Excel (.xlsx):**
  - Atualizar `importService.ts` para detectar o delimitador da linha de cabeçalho (`,`, `;`, `\t`).
  - Adicionar biblioteca leve para leitura de `.xlsx`, padrão comum em planilhas de cursinhos preparatórios.
- **F5: Retenção Local de PDFs e Renderização PNG:**
  - Persistir o PDF original em pasta dedicada no backend (`server/documents/`).
  - Gerar miniaturas PNG das páginas para permitir revisão visual lado a lado de questões com figuras.

### Prioridade 2: Escalabilidade de Armazenamento
- **O7: Migração para IndexedDB:**
  - Substituir o backend de `storageService.ts` por driver assíncrono em IndexedDB.
  - Eliminar o teto de 5 MB do `localStorage`, permitindo armazenar décadas completas de provas com segurança.

### Prioridade 3: Organização Pedagógica
- **O4: Catálogo Estruturado de Assuntos do ITA:**
  - Criar taxonomia hierárquica oficial (`src/data/itaTopics.ts`) baseada no edital do concurso.
  - Mapear tópicos extraídos para identificadores canônicos, viabilizando métricas de cobertura programática.

### Prioridade 4: Extração Fatiada (Onda 3)
- **F4: Extração por Janelas de Páginas:**
  - Fracionar exames de 30 a 60 páginas em lotes de 6 a 8 páginas por requisição.
  - Gravar resultados parciais no `jobManager` para permitir retomada em caso de falha de conexão.
