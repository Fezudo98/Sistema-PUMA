// Importa os bancos de questões pré-elaborados (com gabarito comentado) de
// C:\Users\Sergio\Downloads\bloco de questoes pro Bloco de Provas de cada apostila
// correspondente. Diferente das questões DAILY (geradas pela IA), estas entram
// direto como Question no Simulado tipo BLOCO_PROVA — sourceQuestionId fica null,
// já que não são cópias de uma questão diária existente.
//
// Cada questão já veio classificada manualmente num Question.topico da lista oficial
// Apostila.provaTopics (ver scripts/data/*.json) — não em todo tópico da apostila
// necessariamente, já que os bancos de origem não cobrem 100% da lista.
//
// Seguro de rodar de novo: antes de inserir, verifica se o enunciado já existe no
// Bloco de Provas de destino e pula os que já foram importados.
//
// Uso: npx tsx scripts/import_banco_questoes.ts

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface BancoQuestion {
  number: number;
  heading: string | null;
  enunciado: string;
  alternativas: string[];
  correta: number;
  justificativa: string;
  topico: string | null;
}

const TEMPO_LIMITE_PADRAO = 60; // segundos — mesmo valor usado nas questões DAILY

const BANCOS: { apostilaTitle: string; dataFile: string }[] = [
  {
    apostilaTitle: 'Apostilas CFSd PM 2026 - T01 - Deontologia Historia PMCE.pdf',
    dataFile: 'banco_deontologia_historia.json',
  },
  {
    apostilaTitle: 'Apostilas CFSd PM 2026 - T01 - Portugues Instrumental Redacao Oficial.pdf',
    dataFile: 'banco_portugues_instrumental.json',
  },
  {
    apostilaTitle: 'Apostilas CFSd PM 2026 - T01 - Tecnologia Informacao Comunicacao Operacional.pdf',
    dataFile: 'banco_tic_operacional.json',
  },
];

async function importBanco(apostilaTitle: string, dataFile: string) {
  console.log(`\n--- ${apostilaTitle} ---`);

  const apostila = await prisma.apostila.findFirst({ where: { title: apostilaTitle } });
  if (!apostila) {
    console.error(`  ERRO: apostila "${apostilaTitle}" não encontrada. Pulando.`);
    return;
  }

  const filePath = path.join(__dirname, 'data', dataFile);
  const questions: BancoQuestion[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  // Garante que o Bloco de Provas existe, no mesmo padrão de
  // src/app/actions/blocoProva.ts:syncBlocoDeProvaForApostila.
  let bloco = await prisma.simulado.findFirst({
    where: { tipo: 'BLOCO_PROVA', apostilaName: apostila.title },
  });
  if (!bloco) {
    bloco = await prisma.simulado.create({
      data: {
        tipo: 'BLOCO_PROVA',
        status: 'ACTIVE',
        instructorId: apostila.instructorId,
        apostilaName: apostila.title,
        difficulty: 'AVANCADO',
      },
    });
    console.log(`  Bloco de Provas criado (id ${bloco.id}).`);
  } else {
    console.log(`  Bloco de Provas já existia (id ${bloco.id}).`);
  }

  const existentes = await prisma.question.findMany({
    where: { simuladoId: bloco.id },
    select: { enunciado: true },
  });
  const jaImportados = new Set(existentes.map((q) => q.enunciado));

  const paraCriar = questions.filter((q) => !jaImportados.has(q.enunciado));
  const puladas = questions.length - paraCriar.length;

  if (paraCriar.length === 0) {
    console.log(`  Nada a importar — todas as ${questions.length} questões já estão no Bloco.`);
    return;
  }

  const LETRAS = ['A', 'B', 'C', 'D', 'E'];

  await prisma.question.createMany({
    data: paraCriar.map((q) => ({
      simuladoId: bloco!.id,
      enunciado: q.enunciado,
      // A convenção do resto do sistema (questões geradas pela IA) embute a letra no
      // próprio texto da alternativa ("A) ..."); a tela não desenha a letra separada.
      alternativas: JSON.stringify(q.alternativas.map((alt, idx) => `${LETRAS[idx]}) ${alt}`)),
      correta: q.correta,
      justificativa: q.justificativa,
      tempoLimite: TEMPO_LIMITE_PADRAO,
      topico: q.topico,
    })),
  });

  console.log(`  ${paraCriar.length} questões importadas (${puladas} já existiam e foram puladas).`);
}

async function main() {
  console.log('=========================================================');
  console.log('📚 IMPORTAÇÃO DE BANCOS DE QUESTÕES PARA OS BLOCOS DE PROVAS');
  console.log('=========================================================');

  for (const banco of BANCOS) {
    await importBanco(banco.apostilaTitle, banco.dataFile);
  }

  console.log('\n=========================================================');
  console.log('✅ Importação concluída.');
  console.log('=========================================================');
}

main()
  .catch((e) => {
    console.error('Erro fatal na importação:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
