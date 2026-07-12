import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getUser } from "@/app/actions/auth";
import { promises as fs } from "fs";
import path from "path";

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user || user.role !== "INSTRUCTOR") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("pdf") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo fornecido" }, { status: 400 });
    }

    // Prepare uploads directory
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    try {
      await fs.access(uploadsDir);
    } catch {
      await fs.mkdir(uploadsDir, { recursive: true });
    }

    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const originalName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '');
    const filename = `${uniqueSuffix}-${originalName}`;
    const filePath = path.join(uploadsDir, filename);

    // Save to disk
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await fs.writeFile(filePath, buffer);

    // Check if an apostila with the same name already exists for this instructor
    const existingApostila = await prisma.apostila.findFirst({
      where: {
        title: file.name,
        instructorId: user.userId
      }
    });

    let apostila;
    if (existingApostila) {
      // Delete old file from disk to save space (optional, but good practice)
      try {
        const oldPath = path.join(process.cwd(), "public", existingApostila.filePath);
        await fs.unlink(oldPath);
      } catch (e) {
        // Ignora erro se o arquivo antigo não existir
      }

      // Update existing record
      apostila = await prisma.apostila.update({
        where: { id: existingApostila.id },
        data: {
          filePath: `/uploads/${filename}`,
          createdAt: new Date() // Bump to top
        }
      });
    } else {
      // Create new record
      apostila = await prisma.apostila.create({
        data: {
          title: file.name,
          filePath: `/uploads/${filename}`,
          instructorId: user.userId
        }
      });
    }

    // Trigger daily simulated exam generation for the new/updated booklet immediately in background
    try {
      const { generateDailySimuladoForSingleApostila, queueGenerationTask } = await import("@/app/actions/dailySimulado");
      queueGenerationTask(async () => {
        return generateDailySimuladoForSingleApostila(apostila);
      }).then((res) => {
        console.log(`[APOSTILA UPLOAD] Geração proativa para "${apostila.title}" concluída:`, res);
      }).catch((err) => {
        console.error(`[APOSTILA UPLOAD] Erro na geração proativa para "${apostila.title}":`, err);
      });
    } catch (cronErr: any) {
      console.error("[APOSTILA UPLOAD] Falha ao importar gerador de simulado:", cronErr.message);
    }

    return NextResponse.json({ success: true, apostila });

  } catch (error: any) {
    console.error("Erro no upload da apostila:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user || user.role !== "INSTRUCTOR") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const apostilas = await prisma.apostila.findMany({
      where: { instructorId: user.userId },
      orderBy: { createdAt: "desc" },
      distinct: ['title']
    });

    return NextResponse.json({ apostilas });

  } catch (error: any) {
    console.error("Erro ao listar apostilas:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
