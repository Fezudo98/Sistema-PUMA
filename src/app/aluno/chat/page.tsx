import { redirect } from "next/navigation";
import { PrismaClient } from "@prisma/client";
import { getUser } from "@/app/actions/auth";
import ChatClient from "./ChatClient";

const prisma = new PrismaClient();

export default async function AlunoChatPage() {
  const user = await getUser();
  if (!user || user.role !== "STUDENT") {
    redirect("/auth/login");
  }

  // Load user data
  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      numero: true,
      suspendedUntil: true,
    }
  });

  if (!dbUser) {
    redirect("/api/auth/force-logout");
  }

  // Calculate stats from completed simulados
  const answers = await prisma.answer.findMany({
    where: { studentId: user.userId },
    include: {
      question: {
        include: {
          simulado: {
            include: { _count: { select: { questions: true } } }
          }
        }
      }
    }
  });
  const totalQuestions = answers.length;
  
  const simuladoStatsMap = new Map<string, { expectedQ: number; answeredCount: number; correctAnswers: number; tipo: string; status: string }>();
  answers.forEach(a => {
    const simuladoId = a.question.simuladoId;
    if (!simuladoStatsMap.has(simuladoId)) {
      const totalQ = a.question.simulado._count.questions || 0;
      simuladoStatsMap.set(simuladoId, {
        expectedQ: totalQ,
        answeredCount: 0,
        correctAnswers: 0,
        tipo: (a.question.simulado as any).tipo || "STUDY",
        status: (a.question.simulado as any).status || "FINISHED"
      });
    }
    const s = simuladoStatsMap.get(simuladoId)!;
    s.answeredCount++;
    if (a.isCorrect) s.correctAnswers++;
  });

  let completedTotalQ = 0;
  let completedCorrectQ = 0;
  simuladoStatsMap.forEach(s => {
    const isCompleted = s.tipo === "LIVE" ? s.status === "FINISHED" : s.answeredCount >= s.expectedQ && s.expectedQ > 0;
    if (isCompleted) {
      completedTotalQ += s.expectedQ;
      completedCorrectQ += s.correctAnswers;
    }
  });

  const accuracy = completedTotalQ > 0 ? Math.round((completedCorrectQ / completedTotalQ) * 100) : (totalQuestions > 0 ? Math.round((answers.filter(a => a.isCorrect).length / totalQuestions) * 100) : 0);
  
  const stats = {
    totalQuestions,
    accuracy,
  };

  // Load active booklets
  const activeApostilas = await prisma.apostila.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" }
  });

  // Query distinct booklets from chat logs that have message history
  const historicBooklets = await prisma.chatMessage.findMany({
    where: { 
      studentId: user.userId,
      NOT: { apostilaId: null }
    },
    distinct: ["apostilaId"],
    select: {
      apostilaId: true,
      apostilaTitle: true
    }
  });

  // Map active booklets
  const activeIds = new Set(activeApostilas.map(a => a.id));
  const activeList = activeApostilas.map((a: any) => ({
    id: a.id,
    title: a.title,
    isActive: true
  }));

  // Build list of inactive/deleted booklets that have chat history
  const inactiveList: any[] = [];
  for (const h of historicBooklets) {
    if (h.apostilaId && !activeIds.has(h.apostilaId)) {
      inactiveList.push({
        id: h.apostilaId,
        title: h.apostilaTitle || "Apostila Removida",
        isActive: false
      });
    }
  }

  // Combine them into a single list of booklet chats
  const allApostilas = [...activeList, ...inactiveList];

  // Default selected booklet is the first one in the list (if any exists)
  const defaultApostilaId = allApostilas[0]?.id || null;
  const isDefaultActive = allApostilas[0]?.isActive ?? false;

  // Load initial messages for the default selected booklet
  let initialMessages: any[] = [];
  if (defaultApostilaId) {
    initialMessages = await prisma.chatMessage.findMany({
      where: { studentId: user.userId, apostilaId: defaultApostilaId },
      orderBy: { createdAt: "asc" }
    });
  }

  // Map messages to serializable format
  const messages = initialMessages.map((m: any) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    createdAt: m.createdAt.toISOString()
  }));

  // Check if user is suspended
  const isSuspended = dbUser.suspendedUntil && dbUser.suspendedUntil > new Date();
  const suspendedUntilStr = isSuspended ? dbUser.suspendedUntil!.toISOString() : null;

  // Check if general chat is enabled by the instructor
  const chatSetting = await prisma.systemSetting.findUnique({
    where: { key: "chatEnabled" }
  });
  const isChatEnabled = chatSetting?.value !== "false";

  return (
    <ChatClient 
      user={dbUser} 
      stats={stats} 
      apostilas={allApostilas} 
      initialMessages={messages} 
      initialApostilaId={defaultApostilaId}
      initialApostilaActive={isDefaultActive}
      isSuspended={!!isSuspended}
      suspendedUntil={suspendedUntilStr}
      isChatEnabled={isChatEnabled}
    />
  );
}
