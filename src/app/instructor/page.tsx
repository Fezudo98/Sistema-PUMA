import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import Image from "next/image";
import { Play, LogOut, PlusCircle, Users, Target, Clock, Trophy } from "lucide-react";
import { getUser, logout } from "@/app/actions/auth";
import { redirect } from "next/navigation";
import { PrismaClient } from "@prisma/client";
import HeaderAvatar from "@/components/HeaderAvatar";
import { computeStudentPerformanceStats } from "@/lib/stats";
import EndSimuladoButton from "./EndSimuladoButton";
import DeleteSimuladoButton from "./DeleteSimuladoButton";
import StudentListClient from "./StudentListClient";
import ApostilaManagerClient from "./ApostilaManagerClient";
import SettingsClient from "./SettingsClient";
import InventoryClient from "@/components/InventoryClient";
import { formatApostilaTitle } from "@/lib/utils";

const prisma = new PrismaClient();

export default async function InstructorDashboard() {
  const user = await getUser();
  if (!user || user.role !== "INSTRUCTOR") {
    redirect("/auth/login");
  }

  const dbUser = await prisma.user.findUnique({ where: { id: user.userId } });
  if (!dbUser) {
    redirect("/api/auth/force-logout");
  }

  // Fetch if AI chat is enabled globally
  const chatSetting = await prisma.systemSetting.findUnique({
    where: { key: "chatEnabled" }
  });
  const isChatEnabled = chatSetting?.value !== "false";

  // Fetch if maintenance mode is enabled globally
  const maintenanceSetting = await prisma.systemSetting.findUnique({
    where: { key: "MAINTENANCE_MODE" }
  });
  const isMaintenanceEnabled = maintenanceSetting?.value === "true";

  // Primeiro login do dia do instrutor: se houver apostilas ativas sem simulado gerado hoje, dispara em background
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const activeApostilasCount = await prisma.apostila.count({
    where: { isActive: true }
  });

  const dailySimuladosCount = await prisma.simulado.count({
    where: {
      tipo: "DAILY",
      createdAt: {
        gte: todayStart,
        lte: todayEnd
      }
    }
  });

  if (activeApostilasCount > 0 && dailySimuladosCount < activeApostilasCount) {
    const { checkAndGenerateDailySimulados } = await import("@/app/actions/dailySimulado");
    checkAndGenerateDailySimulados().catch((err) => {
      console.error("[INSTRUCTOR DASHBOARD] Geração em background falhou:", err);
    });
  }

  // Trigger missing Vade Mecum generation in the background
  const { checkAndGenerateMissingVadeMecums } = await import("@/app/actions/vadeMecum");
  checkAndGenerateMissingVadeMecums().catch((err) => {
    console.error("[INSTRUCTOR DASHBOARD] Geração de Vade Mecum em background falhou:", err);
  });

  // Fetch Simulados for this instructor (LIVE only)
  const simulados = await prisma.simulado.findMany({
    where: { 
      instructorId: user.userId,
      tipo: "LIVE"
    },
    include: { _count: { select: { questions: true } } },
    orderBy: { createdAt: "desc" }
  });

  // Fetch All Apostilas (shared among all instructors)
  const apostilas = await prisma.apostila.findMany({
    orderBy: { createdAt: "desc" }
  });

  // Fetch Students and aggregate their performance
  const students = await prisma.user.findMany({
    where: { role: "STUDENT" },
    include: {
      answers: {
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
        }
      }
    }
  });
  // Get all raffle answers to compute expected questions accurately
  const raffleAnswers = await prisma.answer.findMany({
    where: { isRaffle: true },
    select: {
      studentId: true,
      question: { select: { simuladoId: true } }
    }
  });

  // Group raffle answers: total raffle questions per simulado, and raffle questions won per (student, simulado)
  const totalRaffleInSimulado = new Map<string, number>();
  const studentRaffleInSimulado = new Map<string, number>();

  raffleAnswers.forEach(ra => {
    const sId = ra.question.simuladoId;
    const uId = ra.studentId;
    
    totalRaffleInSimulado.set(sId, (totalRaffleInSimulado.get(sId) || 0) + 1);
    
    const key = `${uId}_${sId}`;
    studentRaffleInSimulado.set(key, (studentRaffleInSimulado.get(key) || 0) + 1);
  });

  const studentsPerformance = students.map(student => {
    const sPerf = computeStudentPerformanceStats(student.answers, student.id, totalRaffleInSimulado, studentRaffleInSimulado);
    return {
      id: student.id,
      name: student.name,
      numero: (student as any).numero,
      avatarUrl: student.avatarUrl,
      totalAnswers: sPerf.totalAnswers,
      accuracy: sPerf.accuracy,
      totalScore: sPerf.totalScore,
      avgTime: sPerf.avgTime,
      streakDays: sPerf.streakDays,
      todayPoints: sPerf.todayPoints,
      suspendedUntil: student.suspendedUntil ? student.suspendedUntil.toISOString() : null
    };
  }).sort((a, b) => b.totalScore - a.totalScore); // Sort by highest score

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-10 border-b border-slate-800 pb-6">
          <div className="flex items-center gap-4">
            <Image src="/logo.png" alt="Logo PUMA" width={56} height={56} className="drop-shadow-[0_0_15px_rgba(245,158,11,0.35)] object-contain shrink-0 hover:scale-105 transition-transform duration-300" />
            <div>
              <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-widest text-white drop-shadow-[0_0_10px_rgba(59,130,246,0.3)]">CENTRO DE COMANDO</h1>
              <p className="text-blue-400 font-bold uppercase tracking-widest text-[10px] sm:text-xs mt-1">Painel do Instrutor • Sistema PUMA</p>
            </div>
          </div>
          <div className="flex items-center justify-between sm:justify-end gap-4 border-t border-slate-900 pt-4 sm:border-0 sm:pt-0">
            <div className="flex items-center gap-3">
              <HeaderAvatar 
                initials={user.name.substring(0, 2).toUpperCase()} 
                avatarUrl={dbUser?.avatarUrl || null} 
              />
              <span className="text-xs font-bold text-slate-300 sm:hidden">{user.name}</span>
            </div>
            <form action={logout}>
              <Button variant="ghost" type="submit" size="sm" className="text-slate-400 hover:text-red-500 hover:bg-red-950/30 font-bold text-xs uppercase tracking-wider h-10 px-4">
                <LogOut className="w-4 h-4 mr-2" />
                Sair
              </Button>
            </form>
          </div>
        </header>

        <Tabs defaultValue="simulados" className="w-full">
          <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 mb-6">
            <TabsList className="grid grid-cols-2 md:grid-cols-3 lg:flex sm:!h-14 bg-slate-900 border border-slate-800 p-1 !h-auto gap-1 rounded-xl">
              <TabsTrigger value="simulados" className="text-xs sm:text-base px-3 sm:px-6 !h-10 data-[state=active]:bg-blue-600 data-[state=active]:text-white font-bold text-slate-400">Simulados</TabsTrigger>
              <TabsTrigger value="alunos" className="text-xs sm:text-base px-3 sm:px-6 !h-10 data-[state=active]:bg-blue-600 data-[state=active]:text-white font-bold text-slate-400">Combatentes</TabsTrigger>
              <TabsTrigger value="materiais" className="text-xs sm:text-base px-3 sm:px-6 !h-10 data-[state=active]:bg-blue-600 data-[state=active]:text-white font-bold text-slate-400">Materiais</TabsTrigger>
              <TabsTrigger value="inventario" className="text-xs sm:text-base px-3 sm:px-6 !h-10 data-[state=active]:bg-blue-600 data-[state=active]:text-white font-bold text-slate-400">Inventário</TabsTrigger>
              <TabsTrigger value="config" className="text-xs sm:text-base px-3 sm:px-6 !h-10 data-[state=active]:bg-blue-600 data-[state=active]:text-white font-bold text-slate-400">Configurações</TabsTrigger>
            </TabsList>
            
            <Link href="/instructor/simulado/new" className="w-full lg:w-auto">
              <Button className="w-full lg:w-auto bg-blue-600 hover:bg-blue-500 h-12 lg:h-14 font-black text-xs sm:text-sm uppercase tracking-wider shadow-[0_0_20px_rgba(37,99,235,0.4)]">
                <PlusCircle className="w-5 h-5 mr-2" />
                Novo Simulado com IA
              </Button>
            </Link>
          </div>

          <TabsContent value="simulados" className="mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {simulados.length === 0 && (
                <div className="col-span-full py-20 bg-slate-900/50 border border-slate-800 rounded-xl text-center shadow-[0_0_30px_rgba(0,0,0,0.5)]">
                  <Target className="w-16 h-16 text-slate-700 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-white mb-2 uppercase tracking-widest">Nenhum Simulado Ativo</h3>
                  <p className="text-slate-400 mb-6">Faça o upload de um PDF e inicie o treinamento de combate da tropa.</p>
                  <Link href="/instructor/simulado/new">
                    <Button className="bg-blue-600 hover:bg-blue-500 font-bold shadow-[0_0_20px_rgba(37,99,235,0.3)] h-12 px-8">
                      Criar Operação
                    </Button>
                  </Link>
                </div>
              )}

              {simulados.map(simulado => (
                <Card key={simulado.id} className="border-slate-800 bg-slate-900/40 backdrop-blur-sm shadow-[0_0_15px_rgba(0,0,0,0.5)] hover:border-blue-500/50 hover:bg-slate-900/60 transition-all group">
                  <CardHeader className="pb-3 border-b border-slate-800 mb-3 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 group-hover:bg-blue-400 transition-colors"></div>
                    <div className="flex justify-between items-start pl-2">
                      <div>
                        <CardDescription className="text-xs font-black tracking-widest uppercase text-blue-500 mb-1">CÓDIGO DA SALA</CardDescription>
                        <CardTitle className="text-4xl font-mono font-black tracking-[0.2em] text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">
                          {simulado.codigoSala}
                        </CardTitle>
                      </div>
                      <span className={`text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider border ${
                        simulado.status === "WAITING" ? "bg-amber-900/30 text-amber-400 border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.2)]" :
                        simulado.status === "ACTIVE" ? "bg-emerald-900/30 text-emerald-400 border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.2)] animate-pulse" :
                        "bg-slate-900 text-slate-500 border-slate-800"
                      }`}>
                        {simulado.status === "WAITING" ? "Prontidão" : simulado.status === "ACTIVE" ? "Em Combate" : "Encerrado"}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between text-sm text-slate-300 font-medium">
                      <span className="flex items-center"><Target className="w-4 h-4 mr-2 text-blue-500"/> {simulado._count.questions} Alvos (Questões)</span>
                    </div>
                    {simulado.apostilaName && (
                      <div className="flex flex-col gap-1 text-xs text-slate-400 bg-slate-950 border border-slate-800 rounded px-3 py-2">
                        <span className="font-bold line-clamp-2" title={simulado.apostilaName}>Base: {formatApostilaTitle(simulado.apostilaName)}</span>
                        {simulado.topics && (
                          <span className="text-blue-400 font-medium truncate">Tópicos: {simulado.topics}</span>
                        )}
                      </div>
                    )}
                    
                    <div className="flex gap-2 pt-2">
                      <Link href={simulado.status === "FINISHED" ? `/instructor/painel/${simulado.id}/review` : `/instructor/painel/${simulado.id}`} className="flex-1">
                        <Button className={`w-full font-bold shadow-[0_0_15px_rgba(0,0,0,0.5)] ${simulado.status === "ACTIVE" ? "bg-emerald-600 hover:bg-emerald-500 text-white animate-pulse" : "bg-blue-600 hover:bg-blue-500 text-white"}`}>
                          {simulado.status === "FINISHED" ? "Ver Relatório" : <><Play className="w-4 h-4 mr-2" /> Comandar Sala</>}
                        </Button>
                      </Link>
                      {simulado.status !== "FINISHED" && (
                        <EndSimuladoButton simuladoId={simulado.id} roomCode={simulado.codigoSala || ""} />
                      )}
                      {simulado.status === "FINISHED" && (
                        <DeleteSimuladoButton simuladoId={simulado.id} />
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="alunos" className="mt-0">
            <StudentListClient studentsPerformance={studentsPerformance} />
          </TabsContent>

          <TabsContent value="materiais" className="mt-0">
            <ApostilaManagerClient initialApostilas={apostilas as any[]} />
          </TabsContent>

          <TabsContent value="inventario" className="mt-0">
            <InventoryClient role="INSTRUCTOR" user={{ id: dbUser.id, name: dbUser.name, role: dbUser.role }} />
          </TabsContent>

          <TabsContent value="config" className="mt-0">
            <SettingsClient initialChatEnabled={isChatEnabled} initialMaintenanceEnabled={isMaintenanceEnabled} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
