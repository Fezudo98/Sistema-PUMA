import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { Play, LogOut, PlusCircle, Users, Target, Clock, Trophy } from "lucide-react";
import { getUser, logout } from "@/app/actions/auth";
import { redirect } from "next/navigation";
import { PrismaClient } from "@prisma/client";
import HeaderAvatar from "@/components/HeaderAvatar";
import EndSimuladoButton from "./EndSimuladoButton";
import DeleteSimuladoButton from "./DeleteSimuladoButton";

const prisma = new PrismaClient();

export default async function InstructorDashboard() {
  const user = await getUser();
  if (!user || user.role !== "INSTRUCTOR") {
    redirect("/auth/login");
  }

  const dbUser = await prisma.user.findUnique({ where: { id: user.userId } });

  // Fetch Simulados for this instructor
  const simulados = await prisma.simulado.findMany({
    where: { instructorId: user.userId },
    include: { _count: { select: { questions: true } } },
    orderBy: { createdAt: "desc" }
  });

  // Fetch Students and aggregate their performance
  const students = await prisma.user.findMany({
    where: { role: "STUDENT" },
    include: {
      answers: true
    }
  });

  const studentsPerformance = students.map(student => {
    const totalAnswers = student.answers.length;
    const correctAnswers = student.answers.filter(a => a.isCorrect).length;
    const accuracy = totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0;
    const totalScore = student.answers.reduce((acc, curr) => acc + curr.pontuacao, 0);
    const avgTime = totalAnswers > 0 ? Math.round(student.answers.reduce((acc, curr) => acc + curr.tempoGasto, 0) / totalAnswers) : 0;

    return {
      id: student.id,
      name: student.name,
      avatarUrl: student.avatarUrl,
      totalAnswers,
      accuracy,
      totalScore,
      avgTime
    };
  }).sort((a, b) => b.totalScore - a.totalScore); // Sort by highest score

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Painel do Instrutor</h1>
            <p className="text-slate-500">Gerencie simulados, resultados e perfis de alunos.</p>
          </div>
          <div className="flex items-center gap-4">
            <HeaderAvatar 
              initials={user.name.substring(0, 2).toUpperCase()} 
              avatarUrl={dbUser?.avatarUrl || null} 
            />
            <form action={logout}>
              <Button variant="ghost" type="submit" size="sm" className="text-slate-500 hover:text-red-600">
                <LogOut className="w-4 h-4 mr-2" />
                Sair
              </Button>
            </form>
          </div>
        </header>

        <Tabs defaultValue="simulados" className="w-full">
          <div className="flex justify-between items-center mb-6">
            <TabsList className="h-12 bg-white border shadow-sm">
              <TabsTrigger value="simulados" className="text-base px-6 h-10">Simulados e Resultados</TabsTrigger>
              <TabsTrigger value="alunos" className="text-base px-6 h-10">Desempenho dos Alunos</TabsTrigger>
            </TabsList>
            
            <Link href="/instructor/simulado/new">
              <Button className="bg-blue-600 hover:bg-blue-700 h-12 shadow-md">
                <PlusCircle className="w-5 h-5 mr-2" />
                Novo Simulado com IA
              </Button>
            </Link>
          </div>

          <TabsContent value="simulados" className="mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {simulados.length === 0 && (
                <div className="col-span-full py-16 bg-white border rounded-xl text-center shadow-sm">
                  <h3 className="text-lg font-semibold text-slate-700 mb-2">Nenhum simulado criado</h3>
                  <p className="text-slate-500 mb-4">Envie um PDF e deixe a IA gerar o seu primeiro simulado agora mesmo.</p>
                  <Link href="/instructor/simulado/new">
                    <Button variant="outline" className="border-blue-200 text-blue-700 hover:bg-blue-50">
                      Criar Primeiro Simulado
                    </Button>
                  </Link>
                </div>
              )}

              {simulados.map(simulado => (
                <Card key={simulado.id} className="border-slate-200 shadow-sm hover:shadow-md transition-shadow bg-white">
                  <CardHeader className="pb-3 border-b border-slate-50 mb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardDescription className="text-xs font-bold tracking-wider uppercase text-blue-500 mb-1">CÓDIGO DA SALA</CardDescription>
                        <CardTitle className="text-2xl tracking-widest">{simulado.codigoSala}</CardTitle>
                      </div>
                      <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                        simulado.status === "WAITING" ? "bg-amber-100 text-amber-700" :
                        simulado.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" :
                        "bg-slate-100 text-slate-700"
                      }`}>
                        {simulado.status === "WAITING" ? "Aguardando" : simulado.status === "ACTIVE" ? "Ao Vivo" : "Finalizado"}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between text-sm text-slate-600">
                      <span className="flex items-center"><Target className="w-4 h-4 mr-1 text-slate-400"/> {simulado._count.questions} Questões</span>
                    </div>
                    {simulado.apostilaName && (
                      <div className="flex items-center text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded px-2 py-1 truncate">
                        <span className="font-semibold text-slate-600 truncate">Apostila: {simulado.apostilaName}</span>
                      </div>
                    )}
                    
                    <div className="flex gap-2 pt-2">
                      <Link href={simulado.status === "FINISHED" ? `/instructor/painel/${simulado.id}/review` : `/instructor/painel/${simulado.id}`} className="flex-1">
                        <Button className="w-full bg-slate-900 hover:bg-slate-800 text-white shadow-sm">
                          {simulado.status === "FINISHED" ? "Ver Relatório" : <><Play className="w-4 h-4 mr-2" /> Iniciar / Painel</>}
                        </Button>
                      </Link>
                      {simulado.status !== "FINISHED" && (
                        <EndSimuladoButton simuladoId={simulado.id} roomCode={simulado.codigoSala} />
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
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50">
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  Ranking Geral e Desempenho
                </CardTitle>
                <CardDescription>Acompanhe o perfil de acertos, tempo de resposta e pontuação total dos seus alunos.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {studentsPerformance.length === 0 ? (
                  <div className="py-12 text-center text-slate-500">Nenhum aluno cadastrado ou com respostas ainda.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                          <th className="p-4 font-semibold">QRA (Aluno)</th>
                          <th className="p-4 font-semibold text-center">Questões Feitas</th>
                          <th className="p-4 font-semibold text-center">Taxa de Acerto</th>
                          <th className="p-4 font-semibold text-center">Tempo Médio (s)</th>
                          <th className="p-4 font-semibold text-right">Pontuação Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {studentsPerformance.map((student, index) => (
                          <tr key={student.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs">
                                  {index + 1}º
                                </div>
                                <span className="font-bold text-slate-800">{student.name}</span>
                              </div>
                            </td>
                            <td className="p-4 text-center text-slate-600 font-medium">{student.totalAnswers}</td>
                            <td className="p-4 text-center">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                student.accuracy >= 70 ? "bg-emerald-100 text-emerald-800" :
                                student.accuracy >= 50 ? "bg-amber-100 text-amber-800" :
                                "bg-red-100 text-red-800"
                              }`}>
                                <Target className="w-3 h-3 mr-1" />
                                {student.accuracy}%
                              </span>
                            </td>
                            <td className="p-4 text-center text-slate-600">
                              <span className="flex items-center justify-center gap-1">
                                <Clock className="w-3 h-3 text-slate-400" />
                                {student.avgTime > 0 ? `${student.avgTime}s` : "-"}
                              </span>
                            </td>
                            <td className="p-4 text-right">
                              <span className="flex items-center justify-end gap-1 font-black text-slate-800">
                                {student.totalScore > 0 && <Trophy className="w-4 h-4 text-yellow-500" />}
                                {student.totalScore}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
