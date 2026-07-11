/**
 * POPULATE_DUMMY_DATA.TS
 * Script para popular a base de dados SQLite com alunos, simulados e respostas fictícias.
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando população de banco de dados fictício...");

  // 1. Gera senha padrão encriptada
  const salt = await bcrypt.genSalt(10);
  const defaultPassword = await bcrypt.hash("PMCE123", salt);

  // 2. Garante o Instrutor de Teste
  let instructor = await prisma.user.findFirst({
    where: { role: "INSTRUCTOR" }
  });

  if (!instructor) {
    console.log(" -> Criando instrutor fictício...");
    instructor = await prisma.user.create({
      data: {
        name: "TENENTE CORONEL",
        username: "INSTRUTOR",
        senha: defaultPassword,
        role: "INSTRUCTOR"
      }
    });
  }

  console.log(` -> Instrutor ativo para vinculação: ${instructor.name} (ID: ${instructor.id})`);

  // 3. Cadastra os Estudantes Fictícios
  const studentsToCreate = [
    { name: "CABO NETO", username: "CABONETO", numero: 2, avatarUrl: "/avatars/predefined/02.png" },
    { name: "RECRUTA SILVA", username: "RECRUTASILVA", numero: 5, avatarUrl: "/avatars/predefined/05.png" },
    { name: "RECRUTA SOUZA", username: "RECRUTASOUZA", numero: 12, avatarUrl: "/avatars/predefined/03.png" },
    { name: "SARGENTO OLIVEIRA", username: "SARGENTOOLIVEIRA", numero: 18, avatarUrl: "/avatars/predefined/04.png" }
  ];

  const dbStudents = [];
  for (const st of studentsToCreate) {
    let dbSt = await prisma.user.findUnique({
      where: { username: st.username }
    });

    if (!dbSt) {
      console.log(` -> Criando estudante: ${st.name}`);
      dbSt = await prisma.user.create({
        data: {
          name: st.name,
          username: st.username,
          senha: defaultPassword,
          role: "STUDENT",
          numero: st.numero,
          avatarUrl: st.avatarUrl
        }
      });
    } else {
      console.log(` -> Estudante já existe: ${st.name}`);
    }
    dbStudents.push(dbSt);
  }

  // 4. Cria Simulado de Teste concluído
  const roomCode = "SEED99";
  let simulado = await prisma.simulado.findUnique({
    where: { codigoSala: roomCode }
  });

  if (simulado) {
    console.log(" -> Simulado antigo SEED99 encontrado. Deletando dados para resetar pontuações limpas...");
    // Deleta respostas e questões associadas
    await prisma.answer.deleteMany({
      where: { question: { simuladoId: simulado.id } }
    });
    await prisma.question.deleteMany({
      where: { simuladoId: simulado.id }
    });
    await prisma.simulado.delete({
      where: { id: simulado.id }
    });
  }

  console.log(" -> Criando novo simulado de semente SEED99...");
  simulado = await prisma.simulado.create({
    data: {
      codigoSala: roomCode,
      status: "FINISHED",
      instructorId: instructor.id,
      difficulty: "AVANCADO",
      apostilaName: "Manual Tático da PMCE"
    }
  });

  // 5. Cria Questões do Simulado
  const questionsData = [
    { enunciado: "Em rádio-patrulhamento policial, o que significa a sigla QAP?", alternativas: '["A) Silêncio", "B) Na escuta / Pronto", "C) Entendido", "D) Repetir"]', correta: 1, justificativa: "QAP é o código Q para indicar prontidão e escuta ativa na rede de rádio.", tempoLimite: 30 },
    { enunciado: "Qual o procedimento imediato em caso de pane em armamento letal de porte em confronto?", alternativas: '["A) Desmontagem de 1º escalão", "B) Tapinha, puxa e golpeia (ciclar)", "C) Solicitar apoio via rádio", "D) Abrigo tático e recuo"]', correta: 1, justificativa: "A pane simples é resolvida pela ação imediata: golpe de segurança para ejetar e alimentar nova munição.", tempoLimite: 30 },
    { enunciado: "Nas táticas de varredura residencial (CQB), qual o nome do ponto crítico cego no canto da porta?", alternativas: '["A) Ponto zero", "B) Canto morto / Ângulo fatal", "C) Linha de tiro", "D) Terceira visão"]', correta: 1, justificativa: "Os cantos da porta são chamados de cantos mortos ou zonas fatais, exigindo entrada cruzada tática.", tempoLimite: 30 },
    { enunciado: "Qual sinal sonoro de apito (silvo) indica a ordem de PARAR em controle de trânsito policial?", alternativas: '["A) Um silvo longo", "B) Dois silvos breves", "C) Um silvo breve", "D) Três silvos longos"]', correta: 1, justificativa: "O regulamento prescreve que dois silvos breves determinam parada obrigatória pelo agente de trânsito.", tempoLimite: 30 },
    { enunciado: "A abordagem policial fundamenta-se juridicamente em qual conceito do Código de Processo Penal?", alternativas: '["A) Prisão em flagrante", "B) Busca e apreensão geral", "C) Fundada suspeita", "D) Ordem de patrulhamento"]', correta: 2, justificativa: "O CPP exige a fundada suspeita para a busca pessoal sem mandado judicial prévio.", tempoLimite: 30 }
  ];

  const dbQuestions = [];
  for (const q of questionsData) {
    const dbQ = await prisma.question.create({
      data: {
        simuladoId: simulado.id,
        enunciado: q.enunciado,
        alternativas: q.alternativas,
        correta: q.correta,
        justificativa: q.justificativa,
        tempoLimite: q.tempoLimite,
        status: "FINISHED"
      }
    });
    dbQuestions.push(dbQ);
  }

  // 6. Registra Respostas com Pontuações Variadas para montar o Ranking
  // Aluno 1: SARGENTO OLIVEIRA (Excelente desempenho: 5 acertos, tempos de reação rápidos)
  console.log(" -> Populando respostas para SARGENTO OLIVEIRA...");
  const oliveira = dbStudents.find(s => s.username === "SARGENTOOLIVEIRA")!;
  const oliveiraScores = [140, 135, 142, 138, 145]; // Pontuação base 100 + bônus de velocidade
  for (let i = 0; i < 5; i++) {
    await prisma.answer.create({
      data: {
        questionId: dbQuestions[i].id,
        studentId: oliveira.id,
        alternativa: dbQuestions[i].correta,
        tempoGasto: 5 + i,
        isCorrect: true,
        pontuacao: oliveiraScores[i]
      }
    });
  }

  // Aluno 2: RECRUTA SOUZA (Bom desempenho: 4 acertos, 1 erro)
  console.log(" -> Populando respostas para RECRUTA SOUZA...");
  const souza = dbStudents.find(s => s.username === "RECRUTASOUZA")!;
  const souzaAnswers = [
    { correta: true, alt: dbQuestions[0].correta, score: 120 },
    { correta: true, alt: dbQuestions[1].correta, score: 115 },
    { correta: false, alt: 0, score: 0 },
    { correta: true, alt: dbQuestions[3].correta, score: 130 },
    { correta: true, alt: dbQuestions[4].correta, score: 125 }
  ];
  for (let i = 0; i < 5; i++) {
    await prisma.answer.create({
      data: {
        questionId: dbQuestions[i].id,
        studentId: souza.id,
        alternativa: souzaAnswers[i].alt,
        tempoGasto: 8 + i,
        isCorrect: souzaAnswers[i].correta,
        pontuacao: souzaAnswers[i].score
      }
    });
  }

  // Aluno 3: RECRUTA SILVA (Desempenho mediano: 3 acertos, 2 erros)
  console.log(" -> Populando respostas para RECRUTA SILVA...");
  const silva = dbStudents.find(s => s.username === "RECRUTASILVA")!;
  const silvaAnswers = [
    { correta: true, alt: dbQuestions[0].correta, score: 110 },
    { correta: false, alt: 0, score: 0 },
    { correta: true, alt: dbQuestions[2].correta, score: 105 },
    { correta: false, alt: 0, score: 0 },
    { correta: true, alt: dbQuestions[4].correta, score: 112 }
  ];
  for (let i = 0; i < 5; i++) {
    await prisma.answer.create({
      data: {
        questionId: dbQuestions[i].id,
        studentId: silva.id,
        alternativa: silvaAnswers[i].alt,
        tempoGasto: 12 + i,
        isCorrect: silvaAnswers[i].correta,
        pontuacao: silvaAnswers[i].score
      }
    });
  }

  // Aluno 4: CABO NETO (Desempenho baixo: 2 acertos, 3 erros)
  console.log(" -> Populando respostas para CABO NETO...");
  const neto = dbStudents.find(s => s.username === "CABONETO")!;
  const netoAnswers = [
    { correta: false, alt: 0, score: 0 },
    { correta: true, alt: dbQuestions[1].correta, score: 105 },
    { correta: false, alt: 0, score: 0 },
    { correta: true, alt: dbQuestions[3].correta, score: 108 },
    { correta: false, alt: 0, score: 0 }
  ];
  for (let i = 0; i < 5; i++) {
    await prisma.answer.create({
      data: {
        questionId: dbQuestions[i].id,
        studentId: neto.id,
        alternativa: netoAnswers[i].alt,
        tempoGasto: 15 + i,
        isCorrect: netoAnswers[i].correta,
        pontuacao: netoAnswers[i].score
      }
    });
  }

  console.log("==================================================");
  console.log("BANCO DE DADOS POPULADO COM DADOS FICTÍCIOS DE TESTE!");
  console.log("SARGENTO OLIVEIRA: 700 pts");
  console.log("RECRUTA SOUZA: 490 pts");
  console.log("RECRUTA SILVA: 327 pts");
  console.log("CABO NETO: 213 pts");
  console.log("==================================================");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
