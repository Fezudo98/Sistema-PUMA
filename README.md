# Sistema PUMA - Treinamento Tático de Concurso (PMCE)

Bem-vindo ao **Sistema PUMA**, uma plataforma web revolucionária e gamificada para treinamento de turmas de concurso policial, projetada especificamente para simular pressão, avaliar tempos de reação e elevar o preparo tático dos alunos através de dinâmicas ao vivo.

## 🎯 Sobre o Projeto

O Sistema PUMA permite que Instrutores criem salas interativas (simulados) onde os Alunos respondem questões projetadas em um "telão". O grande diferencial do sistema é o uso de Inteligência Artificial (Google Gemini 3.5 Flash) tanto para gerar questões automaticamente com base em arquivos PDF, quanto para realizar análises comportamentais e de desempenho individualizado para cada aluno.

## 🚀 Principais Funcionalidades

### 👨‍✈️ Painel do Instrutor
- **Geração de Simulados via IA:** Faça o upload de PDFs (Apostilas, Leis, Manuais) e deixe a IA gerar questões com enunciados, 5 alternativas e justificativas embasadas no material.
- **Controle de Sala Ao Vivo:** Comande a progressão das questões como um mestre de sala. Avance, pause o tempo, anule questões, encerre prematuramente e revele o gabarito no telão principal.
- **Roleta Tática (Sorteio de Alvo):** Ative o modo "Sorteio" para escolher aleatoriamente um único recruta que deverá responder a questão perante todos os outros, sob alta pressão.
- **Pódio e Relatórios:** Acompanhe a pontuação ao vivo, gere o "Top 3 Combatentes" ao final do simulado e analise as estatísticas completas de acertos e tempo por questão da turma.

### 🪖 Painel do Aluno (Recruta)
- **Dashboard Pessoal:** Um Quartel General com estatísticas vitais: quantidade de simulados, taxa de acerto global e tempo médio de reação.
- **Mentor Policial IA:** Uma IA integrada com jargões militares analisa seu último desempenho e fornece conselhos táticos (com cache inteligente para não desperdiçar tokens).
- **Mural de Brevês (Gamificação):** Ganhe medalhas de mérito ("Recruta", "Veterano", "Sniper", "Pronto Resposta Raio", etc.) baseadas em conquistas reais no campo de batalha virtual.
- **Simulado no Celular/PC:** Participe em tempo real usando um código de sala, com proteção dupla de botões para evitar "tiros acidentais" (selecionar alternativas sem querer).

## 🛠️ Stack Tecnológica

O sistema foi construído utilizando as melhores práticas do desenvolvimento moderno web:

- **Next.js 15+ (App Router):** Framework React full-stack.
- **TypeScript:** Tipagem estática para um código robusto e seguro.
- **Prisma ORM:** Integração elegante e type-safe com o banco de dados.
- **SQLite:** Banco de dados relacional leve e embutido (fácil portabilidade).
- **Socket.io:** WebSockets para o painel de controle ao vivo do instrutor e sincronização milissegundo com os alunos.
- **Tailwind CSS & shadcn/ui:** Componentização ágil com design arrojado, Dark Mode refinado e animações táticas (pulse, spin, fade-ins).
- **Google Generative AI (Gemini 3.5 Flash):** Cérebro da plataforma para geração de questões e análise de perfis, implementado com failover via Chave de Fallback.

## ⚙️ Como Executar o Sistema Localmente

1. **Clone o Repositório ou Extraia os Arquivos:**
   Navegue até a pasta do sistema.

2. **Instale as Dependências:**
   Abra um terminal (cmd/powershell) e digite:
   ```bash
   npm install
   ```

3. **Configure as Chaves da IA (Variáveis de Ambiente):**
   Crie um arquivo `.env` na raiz do projeto (se não existir) e adicione suas chaves da API do Google Gemini:
   ```env
   GEMINI_API_KEY="SUA_CHAVE_PRINCIPAL_AQUI"
   GEMINI_API_KEY_FALLBACK="SUA_CHAVE_RESERVA_AQUI"
   DATABASE_URL="file:./dev.db"
   ```

4. **Sincronize o Banco de Dados:**
   Execute a atualização das tabelas locais:
   ```bash
   npx prisma db push
   ```

5. **Inicie o Servidor:**
   Você pode usar o arquivo executável prático que criamos ou o comando:
   ```bash
   npm run dev
   ```
   *Alternativa Windows:* Clique duas vezes no arquivo `Iniciar sistema.bat`.

6. **Acesse o Sistema:**
   Abra seu navegador em: `http://localhost:3000`

## 🛡️ Dicas de Operação

- **Login Instrutor Padrão:** Geralmente, os primeiros usuários registrados ganham a role de `INSTRUCTOR`. Use o Painel Inicial para cadastrar alunos com role `STUDENT`.
- **Limites de Tempo:** Questões geradas pela IA geralmente vêm com 60s padrão, você pode alterar isso no código se necessário.
- **Reconexão Rápida:** O sistema possui proteção contra recarregamentos de página; o socket é estabilizado pela ID de usuário (evitando amnésia da sala).
- **Recuperação de Senha (Offline):** Caso um aluno (`STUDENT`) esqueça sua senha, o instrutor pode redefini-la instantaneamente através da aba **Combatentes** do Painel do Instrutor, abrindo o **Dossiê Operacional** do aluno e utilizando a redefinição rápida com a senha padrão (`PMCE123`) ou uma personalizada.
- **Recuperação de Senha do Instrutor:** Caso o instrutor perca sua credencial, a senha pode ser restaurada localmente no notebook executando o Prisma Studio (`npx prisma studio`) ou rodando um script de atualização direta no banco de dados SQLite (`dev.db`).

---

> *"Treinamento duro, combate fácil. Bem-vindo à força, soldado!"*
