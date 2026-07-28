import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import Image from "next/image";
import { Play, LogOut, PlusCircle, Users, Target, Clock, Trophy, Shield } from "lucide-react";
import { getUser, logout } from "@/app/actions/auth";
import { redirect } from "next/navigation";
import { prisma } from '@/lib/prisma';
import HeaderAvatar from "@/components/HeaderAvatar";
import { computeStudentPerformanceStats } from "@/lib/stats";
import { getCachedGeneralRanking } from "@/lib/ranking";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import EndSimuladoButton from "./EndSimuladoButton";
import DeleteSimuladoButton from "./DeleteSimuladoButton";
import StudentListClient from "./StudentListClient";
import ApostilaManagerClient from "./ApostilaManagerClient";
import SettingsClient from "./SettingsClient";
import InventoryClient from "@/components/InventoryClient";
import ReportsDashboardClient from "./ReportsDashboardClient";
import { formatApostilaTitle } from "@/lib/utils";
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

  // Fetch Especiais for this instructor
  const especiais = await prisma.simulado.findMany({
    where: { 
      instructorId: user.userId,
      tipo: "SPECIAL"
    },
    include: { _count: { select: { questions: true } } },
    orderBy: { createdAt: "desc" }
  });

  // Fetch All Apostilas (shared among all instructors)
  const apostilas = await prisma.apostila.findMany({
    orderBy: { createdAt: "desc" }
  });

  // Load general ranking using the heavily cached function to prevent DB spikes
  const studentsPerformance = await getCachedGeneralRanking();

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-10 border-b border-border pb-6">
          <div className="flex items-center gap-4">
            <Image src="/logo.png" alt="Logo PUMA" width={56} height={56} className="drop-shadow-[0_0_15px_rgba(245,158,11,0.35)] object-contain shrink-0 hover:scale-105 transition-transform duration-300" />
            <div>
              <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-widest text-heading drop-shadow-[0_0_10px_rgba(59,130,246,0.3)]">CENTRO DE COMANDO</h1>
              <p className="text-blue-400 font-bold uppercase tracking-widest text-[10px] sm:text-xs mt-1">Painel do Instrutor • Sistema PUMA</p>
            </div>
          </div>
          <div className="flex items-center justify-between sm:justify-end gap-3 border-t border-border pt-4 sm:border-0 sm:pt-0 flex-wrap">
            <Link href="/quem-somos">
              <Button variant="outline" size="sm" className="border-amber-500/40 text-amber-400 bg-amber-950/20 hover:bg-amber-900/50 hover:text-amber-200 font-bold text-xs uppercase tracking-wider h-10 px-4 shadow-[0_0_10px_rgba(245,158,11,0.15)]">
                <Shield className="w-4 h-4 mr-2" />
                Quem Somos Nós
              </Button>
            </Link>
            <ThemeSwitcher />
            <div className="flex items-center gap-3">
              <HeaderAvatar 
                initials={user.name.substring(0, 2).toUpperCase()} 
                avatarUrl={dbUser?.avatarUrl || null} 
              />
              <span className="text-xs font-bold text-muted-foreground sm:hidden">{user.name}</span>
            </div>
            <form action={logout}>
              <Button variant="ghost" type="submit" size="sm" className="text-muted-foreground hover:text-red-500 hover:bg-red-950/30 font-bold text-xs uppercase tracking-wider h-10 px-4">
                <LogOut className="w-4 h-4 mr-2" />
                Sair
              </Button>
            </form>
          </div>
        </header>

        <Tabs defaultValue="relatorios" className="w-full">
          <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 mb-6">
            <TabsList className="grid grid-cols-2 md:grid-cols-4 lg:flex sm:!h-14 bg-card border border-border p-1 !h-auto gap-1 rounded-xl">
              <TabsTrigger value="relatorios" className="text-xs sm:text-base px-3 sm:px-4 !h-10 data-[state=active]:bg-purple-600 data-[state=active]:text-heading font-bold text-muted-foreground">Relatórios</TabsTrigger>
              <TabsTrigger value="simulados" className="text-xs sm:text-base px-3 sm:px-4 !h-10 data-[state=active]:bg-blue-600 data-[state=active]:text-heading font-bold text-muted-foreground">Ao Vivo</TabsTrigger>
              <TabsTrigger value="especiais" className="text-xs sm:text-base px-3 sm:px-4 !h-10 data-[state=active]:bg-purple-600 data-[state=active]:text-heading font-bold text-muted-foreground">Especiais</TabsTrigger>
              <TabsTrigger value="alunos" className="text-xs sm:text-base px-3 sm:px-4 !h-10 data-[state=active]:bg-blue-600 data-[state=active]:text-heading font-bold text-muted-foreground">Tropa</TabsTrigger>
              <TabsTrigger value="materiais" className="text-xs sm:text-base px-3 sm:px-4 !h-10 data-[state=active]:bg-blue-600 data-[state=active]:text-heading font-bold text-muted-foreground">Materiais</TabsTrigger>
              <TabsTrigger value="inventario" className="text-xs sm:text-base px-3 sm:px-4 !h-10 data-[state=active]:bg-blue-600 data-[state=active]:text-heading font-bold text-muted-foreground">Inventário</TabsTrigger>
              <TabsTrigger value="config" className="text-xs sm:text-base px-3 sm:px-4 !h-10 data-[state=active]:bg-blue-600 data-[state=active]:text-heading font-bold text-muted-foreground">Config</TabsTrigger>
            </TabsList>
            
            <div className="flex gap-2 w-full lg:w-auto">
              <Link href="/instructor/simulado/special/new" className="flex-1 lg:flex-none">
                <Button className="w-full bg-purple-600 hover:bg-purple-500 h-12 lg:h-14 font-black text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(168,85,247,0.4)]">
                  <Target className="w-5 h-5 mr-1 sm:mr-2" />
                  Missão Especial
                </Button>
              </Link>
              <Link href="/instructor/simulado/new" className="flex-1 lg:flex-none">
                <Button className="w-full bg-blue-600 hover:bg-blue-500 h-12 lg:h-14 font-black text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(37,99,235,0.4)]">
                  <PlusCircle className="w-5 h-5 mr-1 sm:mr-2" />
                  Simulado IA
                </Button>
              </Link>
            </div>
          </div>

          <TabsContent value="relatorios" className="mt-0">
            <ReportsDashboardClient />
          </TabsContent>

          <TabsContent value="simulados" className="mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {simulados.length === 0 && (
                <div className="col-span-full py-20 bg-card/50 border border-border rounded-xl text-center shadow-[0_0_30px_rgba(0,0,0,0.5)]">
                  <Target className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-heading mb-2 uppercase tracking-widest">Nenhum Simulado Ativo</h3>
                  <p className="text-muted-foreground mb-6">Faça o upload de um PDF e inicie o treinamento de combate da tropa.</p>
                  <Link href="/instructor/simulado/new">
                    <Button className="bg-blue-600 hover:bg-blue-500 font-bold shadow-[0_0_20px_rgba(37,99,235,0.3)] h-12 px-8">
                      Criar Operação
                    </Button>
                  </Link>
                </div>
              )}

              {simulados.map(simulado => (
                <Card key={simulado.id} className="border-border bg-card/40 backdrop-blur-sm shadow-[0_0_15px_rgba(0,0,0,0.5)] hover:border-blue-500/50 hover:bg-card/60 transition-all group">
                  <CardHeader className="pb-3 border-b border-border mb-3 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 group-hover:bg-blue-400 transition-colors"></div>
                    <div className="flex justify-between items-start pl-2">
                      <div>
                        <CardDescription className="text-xs font-black tracking-widest uppercase text-blue-500 mb-1">CÓDIGO DA SALA</CardDescription>
                        <CardTitle className="text-4xl font-mono font-black tracking-[0.2em] text-heading drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">
                          {simulado.codigoSala}
                        </CardTitle>
                      </div>
                      <span className={`text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider border ${
                        simulado.status === "WAITING" ? "bg-amber-900/30 text-amber-400 border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.2)]" :
                        simulado.status === "ACTIVE" ? "bg-emerald-900/30 text-emerald-400 border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.2)] animate-pulse" :
                        "bg-card text-muted-foreground border-border"
                      }`}>
                        {simulado.status === "WAITING" ? "Prontidão" : simulado.status === "ACTIVE" ? "Em Combate" : "Encerrado"}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between text-sm text-muted-foreground font-medium">
                      <span className="flex items-center"><Target className="w-4 h-4 mr-2 text-blue-500"/> {simulado._count.questions} Alvos (Questões)</span>
                    </div>
                    {simulado.apostilaName && (
                      <div className="flex flex-col gap-1 text-xs text-muted-foreground bg-background border border-border rounded px-3 py-2">
                        <span className="font-bold line-clamp-2" title={simulado.apostilaName}>Base: {formatApostilaTitle(simulado.apostilaName)}</span>
                        {simulado.topics && (
                          <span className="text-blue-400 font-medium truncate">Tópicos: {simulado.topics}</span>
                        )}
                      </div>
                    )}
                    
                    <div className="flex gap-2 pt-2">
                      <Link href={simulado.status === "FINISHED" ? `/instructor/painel/${simulado.id}/review` : `/instructor/painel/${simulado.id}`} className="flex-1">
                        <Button className={`w-full font-bold shadow-[0_0_15px_rgba(0,0,0,0.5)] ${simulado.status === "ACTIVE" ? "bg-emerald-600 hover:bg-emerald-500 text-heading animate-pulse" : "bg-blue-600 hover:bg-blue-500 text-heading"}`}>
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

          <TabsContent value="especiais" className="mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {especiais.length === 0 && (
                <div className="col-span-full py-20 bg-card/50 border border-border rounded-xl text-center shadow-[0_0_30px_rgba(0,0,0,0.5)]">
                  <Target className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-heading mb-2 uppercase tracking-widest">Nenhuma Missão Especial</h3>
                  <p className="text-muted-foreground mb-6">Faça o upload do seu PDF e extraia missões para a tropa.</p>
                  <Link href="/instructor/simulado/special/new">
                    <Button className="bg-purple-600 hover:bg-purple-500 font-bold shadow-[0_0_20px_rgba(168,85,247,0.3)] h-12 px-8">
                      Criar Missão Especial
                    </Button>
                  </Link>
                </div>
              )}

              {especiais.map(simulado => {
                const isExpired = simulado.expiresAt ? new Date(simulado.expiresAt) < new Date() : false;
                
                return (
                  <Card key={simulado.id} className={`border-border bg-card/40 backdrop-blur-sm shadow-[0_0_15px_rgba(0,0,0,0.5)] transition-all group ${isExpired ? 'opacity-70' : 'hover:border-purple-500/50 hover:bg-card/60'}`}>
                    <CardHeader className="pb-3 border-b border-border mb-3 relative overflow-hidden">
                      <div className={`absolute top-0 left-0 w-1 h-full ${isExpired ? 'bg-muted-foreground' : 'bg-purple-500 group-hover:bg-purple-400'} transition-colors`}></div>
                      <div className="flex justify-between items-start pl-2">
                        <div>
                          <CardDescription className="text-xs font-black tracking-widest uppercase text-purple-500 mb-1">M. ESPECIAL (NÃO-AO VIVO)</CardDescription>
                          <CardTitle className="text-4xl font-mono font-black tracking-[0.2em] text-heading drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">
                            {simulado.codigoSala}
                          </CardTitle>
                        </div>
                        <span className={`text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider border ${
                          isExpired ? "bg-red-900/30 text-red-400 border-red-500/50" : "bg-emerald-900/30 text-emerald-400 border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.2)] animate-pulse"
                        }`}>
                          {isExpired ? "Expirada" : "Ativa"}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex justify-between text-sm text-muted-foreground font-medium">
                        <span className="flex items-center"><Target className="w-4 h-4 mr-2 text-purple-500"/> {simulado._count.questions} Questões de Base</span>
                      </div>
                      <div className="flex flex-col gap-1 text-xs text-muted-foreground bg-background border border-border rounded px-3 py-2">
                        <span className="font-bold line-clamp-2" title={simulado.apostilaName || ""}>Base: {formatApostilaTitle(simulado.apostilaName || "Material Próprio")}</span>
                        {simulado.expiresAt && (
                          <span className={`${isExpired ? 'text-red-400' : 'text-purple-400'} font-medium`}>Validade: {new Date(simulado.expiresAt).toLocaleDateString()}</span>
                        )}
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Link href={`/instructor/painel/${simulado.id}/review`} className="flex-1">
                          <Button className="w-full font-bold bg-purple-600 hover:bg-purple-500 text-heading shadow-[0_0_15px_rgba(168,85,247,0.3)]">
                            Resultados da Missão
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
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
