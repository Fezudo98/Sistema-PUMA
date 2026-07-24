"use client";

import { useState } from "react";
import { BookOpen, Search, BookMarked, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Apostila {
  id: string;
  title: string;
  createdAt: Date;
  annotationsCount: number;
}

export default function BibliotecaClient({ user, apostilas }: { user: any; apostilas: Apostila[] }) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredApostilas = apostilas.filter(ap => 
    ap.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white relative">
      <div className="fixed inset-0 opacity-20 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none" />
      
      <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/aluno/painel">
              <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white hover:bg-slate-800">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2 text-blue-400">
              <BookOpen className="w-6 h-6" />
              <h1 className="text-xl font-black uppercase tracking-wider text-white hidden sm:block">
                Biblioteca PUMA
              </h1>
            </div>
          </div>
          
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Buscar apostila..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 bg-slate-900 border-slate-700 text-white focus:border-blue-500 rounded-xl"
            />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-8 relative z-10">
        <div className="mb-8">
          <h2 className="text-3xl font-black uppercase tracking-tight text-white">Acervo de Estudo</h2>
          <p className="text-slate-400 mt-2">Acesse suas apostilas, marque textos e crie anotações individuais para reforçar seu aprendizado.</p>
        </div>

        {filteredApostilas.length === 0 ? (
          <div className="text-center py-20 text-slate-500">
            <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p>Nenhuma apostila encontrada.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredApostilas.map(apostila => (
              <Link href={`/aluno/biblioteca/${apostila.id}`} key={apostila.id}>
                <div className="bg-slate-900/50 border border-slate-800 hover:border-blue-500/50 rounded-2xl p-6 transition-all hover:bg-slate-900 shadow-lg group h-full flex flex-col">
                  <div className="w-12 h-12 bg-blue-900/30 rounded-xl flex items-center justify-center text-blue-400 mb-4 group-hover:scale-110 transition-transform">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2 line-clamp-2 leading-tight">
                    {apostila.title}
                  </h3>
                  <div className="mt-auto pt-4 flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span>Adicionada em {new Date(apostila.createdAt).toLocaleDateString()}</span>
                    {apostila.annotationsCount > 0 && (
                      <span className="flex items-center gap-1 text-amber-400 bg-amber-400/10 px-2 py-1 rounded-md">
                        <BookMarked className="w-3 h-3" />
                        {apostila.annotationsCount}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
