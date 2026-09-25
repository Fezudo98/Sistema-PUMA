import { NextResponse } from "next/server";
import { replenishAllQuestionBanks } from "@/lib/questionBank";

function isAuthorized(request: Request): boolean {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key") || "";
  const token = (request.headers.get("authorization") || "").replace("Bearer ", "").trim();
  const secret = process.env.CRON_SECRET || "";
  return Boolean(secret) && (token === secret || key === secret);
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const details = await replenishAllQuestionBanks();
    return NextResponse.json({ success: details.success, details }, { status: details.success ? 200 : 207 });
  } catch (error) {
    console.error("[QUESTION BANK REPLENISH CRON]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro interno" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return POST(request);
}
