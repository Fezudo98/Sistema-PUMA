import { redirect } from "next/navigation";
import { PrismaClient } from "@prisma/client";
import { getUser } from "@/app/actions/auth";
import ChatClient from "./ChatClient";
import { computeStudentPerformanceStats } from "@/lib/stats";

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

  // Calculate stats from completed simulados using reusable stats engine
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
  const perf = computeStudentPerformanceStats(answers, user.userId);
  const stats = {
    totalQuestions: perf.totalAnswers,
    accuracy: perf.accuracy,
    streakDays: perf.streakDays,
    todayPoints: perf.todayPoints
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
