import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getUser } from "@/app/actions/auth";
import CadernoErrosClient from "./CadernoErrosClient";
import HeaderAvatar from "@/components/HeaderAvatar";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function CadernoErrosPage() {
  const user = await getUser();
  if (!user || user.role !== "STUDENT") {
    redirect("/auth/login");
  }

  // Fetch all wrong answers with question details
  const wrongAnswers = await prisma.answer.findMany({
    where: {
      studentId: user.userId,
      isCorrect: false,
    },
    include: {
      question: {
        include: {
          simulado: {
            select: {
              apostilaName: true,
              tipo: true,
              codigoSala: true
            }
          }
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 300 // LIMITA PARA PREVENIR ESTOURO DE MEMÓRIA (OOM) NA VPS E NO NAVEGADOR
  });

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-border bg-card/30 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/aluno/painel">
              <Button variant="ghost" size="icon" className="rounded-full hover:bg-muted text-muted-foreground hover:text-heading">
                <ChevronLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-rose-600 flex items-center justify-center shadow-lg shadow-red-600/20">
                <span className="text-white font-black text-lg">!</span>
              </div>
              <div>
                <h1 className="text-xl font-black text-heading uppercase tracking-tight leading-none">Caderno de Erros</h1>
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1 block">Revisão Tática</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <ThemeSwitcher />
            <HeaderAvatar user={user} />
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-8">
        <CadernoErrosClient initialMistakes={wrongAnswers} />
      </main>
    </div>
  );
}
