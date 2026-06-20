import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getUser } from "@/app/actions/auth";
import { promises as fs } from "fs";
import path from "path";

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const predefinedName = formData.get("predefined") as string | null;

    let avatarUrl = "";

    if (predefinedName) {
      // User selected a predefined avatar (e.g., "03.png")
      avatarUrl = `/avatars/predefined/${predefinedName}`;
    } else if (file) {
      // User uploaded a custom file
      const uploadsDir = path.join(process.cwd(), "public", "avatars", "custom");
      try {
        await fs.access(uploadsDir);
      } catch {
        await fs.mkdir(uploadsDir, { recursive: true });
      }

      // Validate file type
      if (!file.type.startsWith("image/")) {
        return NextResponse.json({ error: "O arquivo deve ser uma imagem." }, { status: 400 });
      }

      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.name) || ".png";
      const filename = `${uniqueSuffix}${ext}`;
      const filePath = path.join(uploadsDir, filename);

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      await fs.writeFile(filePath, buffer);

      avatarUrl = `/avatars/custom/${filename}`;
    } else {
      return NextResponse.json({ error: "Nenhuma imagem fornecida" }, { status: 400 });
    }

    // Update DB
    await prisma.user.update({
      where: { id: user.userId },
      data: { avatarUrl }
    });

    return NextResponse.json({ success: true, avatarUrl });

  } catch (error: any) {
    console.error("Erro no upload do avatar:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
