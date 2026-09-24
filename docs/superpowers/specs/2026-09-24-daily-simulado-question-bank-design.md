# Banco híbrido de questões para simulados diários

**Data:** 2026-09-24  
**Status:** design aprovado em conversa; aguardando revisão final antes da implementação

## Objetivo

Eliminar a dependência de geração por IA no caminho crítico do painel do aluno, reduzir o consumo de tokens e garantir que cada apostila ativa tenha um simulado diário disponível mesmo quando os provedores de IA estiverem indisponíveis.

O comportamento aprovado é:

- banco inicial mínimo de 150 questões por apostila;
- 25 questões em cada simulado diário;
- até 5 questões inéditas por apostila a cada dia;
- as outras 20 questões vêm do banco existente;
- uma questão não deve reaparecer antes de sete dias;
- indisponibilidade da IA nunca pode impedir a criação do simulado diário.

## Diagnóstico que orienta o desenho

O fluxo atual envia cada PDF completo à IA no primeiro acesso do aluno, gera 25 questões por apostila sequencialmente e repete a tentativa enquanto o painel detecta simulados faltando. Isso combina quatro problemas:

1. a geração ocorre no caminho crítico do usuário;
2. o conteúdo completo da apostila é reenviado diariamente e em cada fallback;
3. o polling do painel pode iniciar novas rodadas após falhas parciais;
4. erros transitórios, modelos inválidos e chaves sem saldo ampliam a quantidade de tentativas.

Em produção, as quatro chaves Gemini configuradas foram validadas. A chave Anthropic sem saldo foi removida do ambiente. O identificador `gemini-3.1-flash` usado pelo fluxo atual não existe; a variante disponível é `gemini-3.1-flash-lite`.

## Arquitetura proposta

O fluxo será dividido em três responsabilidades independentes:

1. **Montador diário:** cria o simulado apenas com questões já armazenadas. Não chama IA.
2. **Reabastecedor do banco:** gera questões em segundo plano, fora do caminho do aluno.
3. **Agendador:** dispara montagem e reabastecimento em horários definidos, com estado persistente e idempotência.

```text
Questões históricas ──┐
                     ├──> Banco por apostila ──> Montagem diária ──> Simulado ativo
Lote semanal da IA ──┘              │
                                    └── métricas de uso e rotação
```

## Modelo de dados

### `QuestionBankItem`

Nova tabela para armazenar questões reutilizáveis independentemente de um simulado:

- `id`: UUID;
- `apostilaId`: identidade estável da apostila;
- `apostilaTitleSnapshot`: título no momento da criação;
- `contentHash`: hash normalizado de enunciado, alternativas e resposta, usado para deduplicação;
- `enunciado`, `alternativas`, `correta`, `justificativa`, `tempoLimite`, `topico`;
- `origin`: `HISTORICAL` ou `AI`;
- `status`: `ACTIVE`, `REJECTED` ou `ARCHIVED`;
- `generatedAt`: data de geração/importação;
- `firstUsedAt`, `lastUsedAt` e `useCount`;
- `createdAt` e `updatedAt`.

Índices:

- único por `(apostilaId, contentHash)`;
- seleção por `(apostilaId, status, lastUsedAt)`;
- seleção de inéditas por `(apostilaId, status, firstUsedAt, generatedAt)`.

### Alterações em `Question`

Adicionar `sourceBankItemId` opcional para registrar de qual item do banco a questão do simulado foi copiada. O conteúdo continua copiado para `Question`, preservando respostas e revisões históricas mesmo que o item do banco seja posteriormente arquivado.

### Alterações em `Simulado`

Adicionar:

- `apostilaId` opcional, evitando usar o título como identidade;
- `dailyDate` opcional no formato `YYYY-MM-DD` em `America/Fortaleza`;
- unicidade por `(tipo, apostilaId, dailyDate)` para impedir duplicatas diárias.

### `DailyGenerationJob`

Nova tabela para estado operacional persistente:

- `id`, `jobType`, `apostilaId`, `dayKey`;
- `status`: `PENDING`, `RUNNING`, `SUCCEEDED`, `PARTIAL` ou `FAILED`;
- `attempts`, `nextRetryAt`, `startedAt`, `finishedAt`;
- `selectedCount`, `generatedCount` e `lastError` sanitizado;
- unicidade por `(jobType, apostilaId, dayKey)`.

Esse estado substitui locks exclusivamente em memória e permite que a interface mostre progresso real.

## Migração e preenchimento inicial sem IA

Antes de gerar qualquer conteúdo novo:

1. percorrer questões dos simulados `DAILY` históricos;
2. resolver a apostila por `apostilaName` e gravar seu `apostilaId`;
3. normalizar enunciado, alternativas e resposta para calcular `contentHash`;
4. inserir cada questão única como `QuestionBankItem(origin = HISTORICAL)`;
5. preencher `lastUsedAt` com a data mais recente em que a questão apareceu;
6. preencher `useCount` com o total de ocorrências equivalentes;
7. associar `sourceBankItemId` quando a correspondência for inequívoca.

Se uma apostila já tiver mais de 150 questões únicas, todas permanecem disponíveis. O número 150 é um mínimo, não um limite. Isso melhora a rotação sem custo adicional de tokens.

## Montagem diária

O montador roda por apostila ativa e é idempotente:

1. verificar a unicidade `(DAILY, apostilaId, dailyDate)`;
2. selecionar até 5 itens `AI` nunca usados, priorizando os mais antigos disponíveis;
3. selecionar o restante entre itens ativos não usados nos últimos sete dias;
4. equilibrar os tópicos quando `provaTopics` estiver configurado;
5. completar até 25 com os itens há mais tempo sem uso;
6. se o banco não comportar a janela estrita, relaxar a janela progressivamente, sem bloquear o simulado;
7. criar `Simulado` e suas 25 cópias de `Question` em uma única transação;
8. atualizar `firstUsedAt`, `lastUsedAt` e `useCount` dos itens selecionados na mesma transação.

A montagem não chama nenhum provedor de IA e deve terminar em poucos segundos.

## Reabastecimento com IA

Para amortizar o custo de entrada, o sistema não pedirá cinco questões diariamente. Em vez disso, gerará **35 questões por apostila em um lote semanal**, suficientes para introduzir até cinco inéditas por dia durante a semana.

Política:

- executar após a montagem diária, nunca antes dela;
- iniciar quando houver menos de dez itens `AI` nunca usados ou no dia semanal configurado;
- gerar 35 questões numa chamada bem-sucedida por apostila;
- usar a lista fixa de tópicos existente quando disponível;
- rejeitar itens inválidos, duplicados ou com menos de cinco alternativas;
- inserir apenas itens válidos e únicos;
- se a IA falhar, manter o simulado diário funcionando com o banco atual e reagendar o lote.

O conteúdo da apostila será obtido pelo cache textual já usado pelo Vade Mecum, evitando converter e reenviar o PDF em cada tentativa. Uma futura etapa poderá usar cache de contexto do provedor, mas não é necessária para a primeira versão.

## Modelos, chaves e tentativas

Cadeia inicial recomendada:

1. `gemini-3.7-flash`;
2. `gemini-3.5-flash`;
3. `gemini-3.5-flash-lite`;
4. `gemini-3.1-flash-lite`.

Regras:

- usar uma chave por tentativa, em round-robin;
- limitar cada lote a quatro tentativas totais, não multiplicar todos os modelos por todas as chaves;
- `400 API_KEY_INVALID` ou `403`: desativar a chave para o processo e registrar alerta;
- `404` de modelo: desativar o modelo para a rodada inteira, sem repeti-lo nas outras chaves;
- `429`: respeitar `Retry-After` e aplicar cooldown à chave/modelo;
- `503`: aplicar cooldown ao modelo e tentar o próximo;
- timeout explícito por requisição;
- nunca registrar valores de chaves ou conteúdo sensível.

## Agendamento

Configurar cron real na VPS:

- `00:05 America/Fortaleza`: montar os simulados de todas as apostilas ativas;
- após a montagem: avaliar e enfileirar reabastecimentos necessários;
- uma varredura adicional no período de baixa utilização pode retomar jobs com `nextRetryAt` vencido.

A rota cron continua protegida por `CRON_SECRET`, mas passa a responder com quantidade de sucessos, parciais e falhas. Uma falha de IA no reabastecimento não transforma a montagem diária em falha.

## Interface do aluno

O painel deixa de iniciar geração de IA durante a renderização.

- remover a chamada a `checkAndGenerateDailySimulados()` acionada pelo déficit de contagem;
- remover o polling de cinco segundos como mecanismo de agendamento;
- consultar `DailyGenerationJob` apenas quando o simulado realmente não existir;
- mostrar estados reais: “agendado”, “montando”, “disponível” ou “falha — nova tentativa programada”;
- manter os simulados já disponíveis utilizáveis durante qualquer reabastecimento.

## Concorrência e idempotência

- a unicidade no banco é a proteção principal contra duplicatas;
- cada apostila é montada em transação curta e independente;
- jobs vencidos em `RUNNING` podem ser retomados após reinício do PM2;
- Chat, Vade Mecum e banco de questões não compartilham a mesma promessa global;
- o reabastecedor usa concorrência limitada, inicialmente uma apostila por vez;
- uma falha não impede o processamento das outras apostilas.

## Observabilidade

Registrar por job, sem dados sensíveis:

- modelo e rótulo da chave utilizados;
- tamanho do contexto e contagem estimada de tokens;
- duração da chamada;
- status HTTP e classe do erro;
- questões recebidas, aceitas, duplicadas e rejeitadas;
- quantidade de questões disponíveis e nunca usadas por apostila;
- tempo de montagem diária.

Os logs devem permitir responder quanto cada lote consumiu e por que uma reposição foi adiada.

## Testes

### Unidade

- hash e deduplicação de questões;
- seleção de cinco inéditas e vinte rotacionadas;
- bloqueio de repetição por sete dias;
- relaxamento progressivo quando o estoque é insuficiente;
- equilíbrio por tópico;
- classificação de erros `400`, `403`, `404`, `429`, `503` e timeout;
- cálculo de cooldown e `nextRetryAt`.

### Integração

- backfill histórico idempotente;
- duas montagens concorrentes produzem apenas um simulado;
- criação das 25 questões e atualização de uso na mesma transação;
- falha total da IA não impede a montagem;
- reinício do processo permite retomar jobs pendentes;
- apostila renomeada continua vinculada por `apostilaId`.

### Aceitação

- oito apostilas ativas produzem oito simulados sem chamar IA no caminho da montagem;
- cada simulado contém exatamente 25 questões;
- até cinco são inéditas quando há estoque;
- nenhuma questão reaparece em sete dias quando o estoque é suficiente;
- o painel não dispara geração nem atualiza a cada cinco segundos;
- nenhum valor de chave aparece em logs ou respostas.

## Implantação

1. aplicar o esquema aditivo e gerar o Prisma Client;
2. executar o backfill idempotente em cópia do banco e validar contagens;
3. executar o backfill na produção com backup verificado;
4. habilitar o montador diário usando o banco, ainda sem remover o fluxo antigo;
5. montar um dia de teste e comparar conteúdo/contagem;
6. habilitar o cron real;
7. desativar o gatilho de geração do painel e o polling;
8. habilitar o reabastecimento semanal;
9. observar uma semana antes de remover definitivamente o gerador diário antigo.

Rollback: desabilitar o novo cron e reativar temporariamente o fluxo antigo. As novas tabelas e colunas são aditivas e não alteram respostas históricas.

## Fora de escopo

- alterar regras de pontuação, sequência ou brevês;
- mudar a experiência de resolução do simulado;
- reescrever Chat ou Vade Mecum;
- adotar cache pago de contexto na primeira versão;
- apagar questões ou simulados históricos.

