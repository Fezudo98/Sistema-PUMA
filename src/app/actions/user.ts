"use server";

import { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getUser } from "./auth";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

export async function updateUserAvatar(avatarUrl: string) {
  const user = await getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  try {
    await prisma.user.update({
      where: { id: user.userId },
      data: { avatarUrl }
    });

    revalidatePath("/aluno/painel");
    revalidatePath("/instructor/painel");
    
    return { success: true };
  } catch (error) {
    console.error("Error updating avatar:", error);
    return { success: false, error: "Failed to update avatar" };
  }
}

export async function resetStudentPassword(studentId: string, newPassword: string) {
  const user = await getUser();
  if (!user || user.role !== "INSTRUCTOR") {
    return { success: false, error: "Acesso negado. Apenas instrutores autorizados." };
  }

  if (!newPassword || newPassword.trim().length < 4) {
    return { success: false, error: "A senha deve conter no mínimo 4 caracteres." };
  }

  try {
    const student = await prisma.user.findFirst({
      where: { id: studentId, role: "STUDENT" }
    });

    if (!student) {
      return { success: false, error: "Combatente não encontrado." };
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id: studentId },
      data: { senha: hashedPassword }
    });

    return { success: true };
  } catch (error) {
    console.error("Error resetting student password:", error);
    return { success: false, error: "Erro interno ao redefinir senha." };
  }
}

export async function updateUserName(name: string) {
  const user = await getUser();
  if (!user) return { success: false, error: "Não autenticado." };

  if (!name || name.trim().length < 2) {
    return { success: false, error: "O nome deve conter pelo menos 2 caracteres." };
  }

  try {
    await prisma.user.update({
      where: { id: user.userId },
      data: { name: name.trim() }
    });

    revalidatePath("/aluno/painel");
    revalidatePath("/instructor/painel");
    
    return { success: true };
  } catch (error) {
    console.error("Error updating user name:", error);
    return { success: false, error: "Erro ao atualizar o nome." };
  }
}

// Instructor: Get full chat audit log of a student
export async function getStudentChatAuditAction(studentId: string) {
  const user = await getUser();
  if (!user || user.role !== "INSTRUCTOR") {
    return { success: false, error: "Acesso negado. Apenas instrutores autorizados." };
  }

  try {
    const student = await prisma.user.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        name: true,
        suspendedUntil: true
      }
    });

    if (!student) {
      return { success: false, error: "Combatente não encontrado." };
    }

    const messages = await prisma.chatMessage.findMany({
      where: { studentId },
      orderBy: { createdAt: "asc" }
    });

    return {
      success: true,
      student: {
        id: student.id,
        name: student.name,
        suspendedUntil: student.suspendedUntil ? student.suspendedUntil.toISOString() : null
      },
      messages: messages.map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        apostilaId: m.apostilaId,
        apostilaTitle: m.apostilaTitle || "Geral / Não identificado",
        createdAt: m.createdAt.toISOString()
      }))
    };
  } catch (error: any) {
    console.error("Error fetching student chat audit:", error);
    return { success: false, error: "Falha ao carregar histórico de conversas." };
  }
}

// Instructor: Apply or remove chat suspension for a student
export async function toggleStudentChatSuspensionAction(studentId: string, suspend: boolean, durationHours: number = 24) {
  const user = await getUser();
  if (!user || user.role !== "INSTRUCTOR") {
    return { success: false, error: "Acesso negado. Apenas instrutores autorizados." };
  }

  try {
    const suspendedUntil = suspend
      ? new Date(Date.now() + durationHours * 60 * 60 * 1000)
      : null;

    await prisma.user.update({
      where: { id: studentId },
      data: { suspendedUntil }
    });

    revalidatePath("/instructor");
    revalidatePath("/aluno/chat");

    return {
      success: true,
      suspendedUntil: suspendedUntil ? suspendedUntil.toISOString() : null
    };
  } catch (error: any) {
    console.error("Error toggling suspension:", error);
    return { success: false, error: "Falha ao atualizar suspensão do combatente." };
  }
}

export async function getStudentSimuladosAction(studentId: string) {
  const user = await getUser();
  if (!user || user.role !== "INSTRUCTOR") {
    return { success: false, error: "Acesso negado. Apenas instrutores autorizados." };
  }

  try {
    const answers = await prisma.answer.findMany({
      where: { studentId },
      include: {
        question: {
          include: {
            simulado: {
              include: {
                _count: {
                  select: { questions: true }
                }
              }
            }
          }
        }
      },
      orderBy: { id: "desc" }
    });

    const simuladosMap = new Map<string, any>();

    for (const ans of answers) {
      const sim = ans.question.simulado;
      const sId = sim.id;

      if (!simuladosMap.has(sId)) {
        simuladosMap.set(sId, {
          id: sId,
          codigoSala: sim.codigoSala,
          tipo: sim.tipo,
          status: sim.status,
          apostilaName: sim.apostilaName || "Simulado de Estudo",
          difficulty: sim.difficulty || "AVANCADO",
          createdAt: sim.createdAt.toISOString(),
          questionsCount: sim._count.questions,
          correctAnswersCount: 0,
          totalScore: 0,
          answeredCount: 0,
          questionsList: []
        });
      }

      const sData = simuladosMap.get(sId);
      sData.answeredCount++;
      sData.totalScore += ans.pontuacao;
      if (ans.isCorrect) {
        sData.correctAnswersCount++;
      }

      sData.questionsList.push({
        id: ans.question.id,
        enunciado: ans.question.enunciado,
        alternativas: JSON.parse(ans.question.alternativas),
        correta: ans.question.correta,
        justificativa: ans.question.justificativa,
        alunoEscolha: ans.alternativa,
        isCorrect: ans.isCorrect,
        tempoGasto: ans.tempoGasto,
        pontuacao: ans.pontuacao
      });
    }

    const simuladosList = Array.from(simuladosMap.values());

    return {
      success: true,
      simulados: simuladosList
    };
  } catch (error: any) {
    console.error("Error fetching student simulados:", error);
    return { success: false, error: "Falha ao carregar histórico de simulados do combatente." };
  }
}

export async function updateStudentNumber(studentId: string, newNumero: number) {
  const user = await getUser();
  if (!user || user.role !== "INSTRUCTOR") {
    return { success: false, error: "Acesso negado. Apenas instrutores autorizados." };
  }

  if (isNaN(newNumero) || newNumero < 1 || newNumero > 32) {
    return { success: false, error: "O número do combatente deve ser entre 1 e 32." };
  }

  try {
    // Check if the student exists
    const student = await prisma.user.findFirst({
      where: { id: studentId, role: "STUDENT" }
    });

    if (!student) {
      return { success: false, error: "Combatente não encontrado." };
    }

    // If the number is already theirs, just return success
    if (student.numero === newNumero) {
      return { success: true };
    }

    // Check if the new number is taken by another student
    const numberTaken = await prisma.user.findFirst({
      where: { 
        role: "STUDENT", 
        numero: newNumero,
        id: { not: studentId }
      }
    });

    if (numberTaken) {
      return { success: false, error: `O número ${String(newNumero).padStart(2, '0')} já está sendo utilizado pelo combatente ${numberTaken.name}.` };
    }

    // Update
    await prisma.user.update({
      where: { id: studentId },
      data: { numero: newNumero }
    });

    // Revalidate paths to refresh the dashboard lists
    revalidatePath("/instructor");

    return { success: true };
  } catch (error: any) {
    console.error("Error updating student number:", error);
    return { success: false, error: "Erro interno ao atualizar o número do combatente." };
  }
}
