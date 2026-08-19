import { NextRequest, NextResponse } from "next/server";
import { prisma } from '@/lib/prisma';
import { getUser } from "@/app/actions/auth";
import { promises as fs } from "fs";
import path from "path";
import sharp from "sharp";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5MB
const PREDEFINED_NAME_REGEX = /^[a-zA-Z0-9_-]+\.(png|jpg|jpeg|webp)$/;

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
      // Só aceita nomes de arquivo simples (sem barras/"..") que realmente existam
      // na pasta de avatares predefinidos, pra evitar path traversal.
      if (!PREDEFINED_NAME_REGEX.test(predefinedName)) {
        return NextResponse.json({ error: "Avatar predefinido inválido." }, { status: 400 });
      }
      const predefinedDir = path.join(process.cwd(), "public", "avatars", "predefined");
      const predefinedPath = path.join(predefinedDir, predefinedName);
      if (!predefinedPath.startsWith(predefinedDir)) {
        return NextResponse.json({ error: "Avatar predefinido inválido." }, { status: 400 });
      }
      try {
        await fs.access(predefinedPath);
      } catch {
        return NextResponse.json({ error: "Avatar predefinido não encontrado." }, { status: 400 });
      }

      avatarUrl = `/avatars/predefined/${predefinedName}`;
    } else if (file) {
      if (file.size > MAX_AVATAR_BYTES) {
        return NextResponse.json({ error: "Imagem muito grande (máximo 5MB)." }, { status: 400 });
      }

      const uploadsDir = path.join(process.cwd(), "public", "avatars", "custom");
      try {
        await fs.access(uploadsDir);
      } catch {
        await fs.mkdir(uploadsDir, { recursive: true });
      }

      const bytes = await file.arrayBuffer();
      const inputBuffer = Buffer.from(bytes);

      // Nunca confia no Content-Type/nome enviado pelo cliente: decodifica o
      // arquivo como imagem de verdade (sharp) e re-codifica em WebP. Se não for
      // uma imagem legítima, isso falha — bloqueando upload de HTML/script
      // disfarçado de imagem (XSS armazenado servido pela mesma origem).
      let outputBuffer: Buffer;
      try {
        outputBuffer = await sharp(inputBuffer)
          .resize(512, 512, { fit: "cover" })
          .webp({ quality: 85 })
          .toBuffer();
      } catch {
        return NextResponse.json({ error: "O arquivo enviado não é uma imagem válida." }, { status: 400 });
      }

      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const filename = `${uniqueSuffix}.webp`;
      const filePath = path.join(uploadsDir, filename);

      await fs.writeFile(filePath, outputBuffer);

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
