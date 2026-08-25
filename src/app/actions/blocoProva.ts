"use server";

import { prisma } from "@/lib/prisma";
import type { Apostila } from "@prisma/client";

/**
 * Monta/atualiza o Bloco de Provas de uma apostila: garante que exista um
 * Simulado tipo BLOCO_PROVA para ela e copia para dentro dele as questões dos
 * simulados DAILY dessa apostila que ainda não foram copiadas. Nunca apaga ou
 * substitui questões já copiadas, para não perder o progresso do aluno.
 */
export async function syncBlocoDeProvaForApostila(apostila: Apostila) {
  let bloco = await prisma.simulado.findFirst({
    where: { tipo: "BLOCO_PROVA", apostilaName: apostila.title }
  });

  if (!bloco) {
    bloco = await prisma.simulado.create({
      data: {
        tipo: "BLOCO_PROVA",
        status: "ACTIVE",
        instructorId: apostila.instructorId,
        apostilaName: apostila.title,
        difficulty: "AVANCADO"
      }
    });
  }

  const sourceQuestions = await prisma.question.findMany({
    where: { simulado: { tipo: "DAILY", apostilaName: apostila.title } },
    select: {
      id: true,
      enunciado: true,
      alternativas: true,
      correta: true,
      justificativa: true,
      tempoLimite: true
    }
  });

  if (sourceQuestions.length === 0) {
    return bloco;
  }

  const alreadyCopied = await prisma.question.findMany({
    where: { simuladoId: bloco.id, sourceQuestionId: { not: null } },
    select: { sourceQuestionId: true }
  });
  const alreadyCopiedIds = new Set(alreadyCopied.map((q) => q.sourceQuestionId));

  const toCopy = sourceQuestions.filter((q) => !alreadyCopiedIds.has(q.id));

  if (toCopy.length > 0) {
    await prisma.question.createMany({
      data: toCopy.map((q) => ({
        simuladoId: bloco!.id,
        enunciado: q.enunciado,
        alternativas: q.alternativas,
        correta: q.correta,
        justificativa: q.justificativa,
        tempoLimite: q.tempoLimite,
        sourceQuestionId: q.id
      }))
    });
  }

  return bloco;
}

/** Atualiza o Bloco de Provas de todas as apostilas marcadas como matéria de prova. */
export async function syncBlocosDeProva() {
  const provaApostilas = await prisma.apostila.findMany({
    where: { isProvaSubject: true }
  });

  for (const apostila of provaApostilas) {
    try {
      await syncBlocoDeProvaForApostila(apostila);
    } catch (err) {
      console.error(`[BLOCO DE PROVAS] Falha ao sincronizar bloco da apostila "${apostila.title}":`, err);
    }
  }
}
