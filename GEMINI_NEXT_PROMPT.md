# Prompt para continuar o Rotina ITA com Gemini

Você está dando continuidade ao projeto existente **Rotina ITA**. Não recrie a aplicação do zero e não substitua a identidade visual sem motivo técnico.

Antes de editar, leia integralmente `README.md` e `GEMINI_HANDOFF.md`, depois inspecione `src/types.ts`, `src/data/seed.ts`, `src/App.tsx` e `src/styles.css`. Preserve as decisões de produto e o estilo editorial acadêmico definido nos documentos.

## Primeiro trabalho: consolidar a base (Sprint 1)

1. Instale as dependências e execute `npm run typecheck` e `npm run build`. Corrija todos os erros reais antes de avançar. Registre claramente os resultados dos comandos.
2. Refatore a implementação monolítica de `src/App.tsx` em componentes e módulos coesos (layout, banco de questões, resolução, sessões, resultados, revisão, formulários e modais), mantendo todos os fluxos funcionais e o design atual.
3. Mova validação/normalização de questões, parsing CSV/JSON, deduplicação, cálculos de pontuação e persistência para módulos de domínio/serviço com testes unitários.
4. Implemente exportação e restauração completas de backup JSON, incluindo questões, sessões, ordem da sessão, respostas, anotações, marcações de revisão e resultados. Inclua versão do formato e valide o arquivo antes de substituir qualquer dado existente. A restauração deve oferecer estratégia para mesclar ou substituir e nunca apagar silenciosamente o banco local.
5. Crie uma camada de armazenamento com tratamento de falhas de `localStorage`, versionamento/migração de esquema e mensagem clara quando houver falta de espaço ou corrupção de dados.
6. Adicione testes para: importação de JSON/CSV; entradas inválidas; deduplicação; gabarito e pontuação; questão discursiva; seleção e ordem da sessão; cronômetro e pausa/retomada; conclusão; restauração de backup.
7. Verifique que digitar no enunciado discursivo ou nos campos de modal não perca foco/cursor durante as atualizações de estado. Confirme também navegação por teclado e layout em viewport móvel.

## Limites

- Não implementar ainda a integração Gemini/PDF nesta sprint; apenas deixe interfaces limpas para futura integração.
- Nunca incluir secrets/chaves API no bundle do navegador.
- Não apresentar questões demonstrativas como questões oficiais. Não inventar gabarito ou procedência.
- Não substituir o estilo por um dashboard genérico: sem gradientes chamativos, glassmorphism ou excesso de cards.
- Não remover funcionalidades existentes para simplificar o refactor.
- Faça mudanças em etapas pequenas e verificáveis. Ao final, resuma arquivos alterados, decisões, testes executados, limitações remanescentes e próximos passos.
