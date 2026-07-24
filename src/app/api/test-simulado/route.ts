import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  try {
    const instructor = await prisma.user.findFirst({ where: { role: "INSTRUCTOR" } });
    if (!instructor) return NextResponse.json({ error: "No instructor found" });

    const simulado = await prisma.simulado.create({
      data: {
        codigoSala: "TEST99",
        instructorId: instructor.id,
        status: "WAITING",
        apostilaName: "Test",
        topics: "Test",
        difficulty: "AVANCADO",
        isTeamCompetition: true,
        teamNames: JSON.stringify(["Equipe 1", "Equipe 2"]),
        questions: {
          create: [
            {
              enunciado: "Test?",
              alternativas: JSON.stringify(["A", "B", "C", "D", "E"]),
              correta: 0,
              justificativa: "Because",
              tempoLimite: 60,
              status: "PENDING"
            }
          ]
        }
      }
    });

    // Cleanup
    await prisma.question.deleteMany({ where: { simuladoId: simulado.id } });
    await prisma.simulado.delete({ where: { id: simulado.id } });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, stack: e.stack });
  }
}
