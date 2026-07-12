import { NextResponse } from "next/server";
import { checkAndGenerateDailySimulados } from "@/app/actions/dailySimulado";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key") || "";

  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();

  const secret = process.env.CRON_SECRET || "";

  // Se houver um segredo configurado em produção, valida
  if (secret && token !== secret && key !== secret) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    console.log("[CRON] Iniciando geração proativa automática de simulados diários...");
    const res = await checkAndGenerateDailySimulados();
    return NextResponse.json({ success: true, details: res });
  } catch (err: any) {
    console.error("[CRON ERROR]", err);
    return NextResponse.json(
      { error: err.message || "Erro interno do servidor durante a geração." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
