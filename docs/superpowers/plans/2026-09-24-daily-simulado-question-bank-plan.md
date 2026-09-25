# Plano de implementação — banco híbrido de simulados diários

Status: aprovado para execução em 2026-09-24.

## 1. Persistência

- Adicionar `QuestionBankItem`, `DailyGenerationJob` e relações com `Apostila`, `Simulado` e `Question`.
- Identificar cada diário por `dailyDate` no fuso `America/Fortaleza` e garantir unicidade por apostila/data.
- Criar migração SQL compatível com o SQLite em produção.

## 2. Banco de questões

- Extrair a seleção para funções puras e testáveis.
- Fazer backfill das questões DAILY históricas, deduplicando por hash de conteúdo.
- Montar 25 questões por apostila: até 5 inéditas, depois itens não usados há 7 dias e, por último, LRU.
- Atualizar uso dos itens e criar o simulado na mesma transação.

## 3. Reposição por IA

- Gerar lotes de 35 questões usando texto da apostila já cacheado, sem reenviar o PDF.
- Usar no máximo quatro tentativas totais na cadeia: `gemini-3.7-flash`, `gemini-3.5-flash`, `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`.
- Distribuir tentativas pelas chaves ativas em round-robin, com cooldown; não usar Anthropic.
- Repor apenas bancos abaixo do mínimo de 150 e nunca bloquear a montagem diária.

## 4. Orquestração

- Tornar a rota de cron responsável pela montagem diária idempotente.
- Criar rota separada para reposição semanal.
- Persistir status, contagens, duração e último erro dos jobs.
- Manter os botões do instrutor, mas fazê-los remontar a partir do banco em vez de chamar IA.

## 5. Interface

- Remover geração acionada pelas páginas do aluno e instrutor.
- Remover o polling de 5 segundos do painel.
- Exibir apenas o estado observado no banco; ausência de um diário não dispara trabalho caro.

## 6. Verificação e implantação

- Testar seleção, janela de sete dias, limite de inéditas e fallback LRU.
- Executar `prisma validate`, testes, checagem TypeScript e build.
- Na VPS: backup do banco, atualizar código, aplicar migração, executar backfill, montar o diário, configurar cron e reiniciar o PM2.
- Validar contagens, tempos e logs sem imprimir chaves.
