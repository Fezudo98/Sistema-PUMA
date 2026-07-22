"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRouter } from "next/navigation";
import { getTakenNumbers, loginUser, registerUser } from "@/app/actions/auth";
import { QuemSomosModal } from "@/components/QuemSomosModal";

export default function StudentAuth() {
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [activeTab, setActiveTab] = useState("login");
  const [takenNumbers, setTakenNumbers] = useState<number[]>([]);
  const router = useRouter();

  useEffect(() => {
    getTakenNumbers().then(setTakenNumbers);
  }, []);

  const handleAction = async (formData: FormData, isLogin: boolean) => {
    setError("");
    setSuccessMsg("");
    formData.append("role", "STUDENT");
    
    // For student registration: name and username are both QRA.
    if (!isLogin) {
      const qra = formData.get("username") as string;
      formData.append("name", qra);
    }
    
    const res: any = isLogin ? await loginUser(formData) : await registerUser(formData);
    
    if (res?.error) {
      setError(res.error);
    } else if (res?.success) {
      router.push("/aluno/painel");
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 bg-slate-950 bg-cover bg-center"
      style={{ backgroundImage: "url('/arte_fundo.png')" }}
    >
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm pointer-events-none"></div>

      <div className="w-full max-w-md z-10 space-y-4 my-6">
        <div className="flex flex-col items-center mb-4">
          <Image src="/logo.png" alt="Sistema PUMA" width={100} height={100} className="drop-shadow-[0_0_20px_rgba(245,158,11,0.35)] object-contain mb-2 hover:scale-105 transition-transform duration-300" />
          <h1 className="text-3xl font-extrabold text-white mt-1">Sistema <span className="text-blue-500">PUMA</span></h1>
          <p className="text-slate-400 font-medium text-sm">32º Pelotão • CFSD PMCE</p>
        </div>
        
        <QuemSomosModal />

        <Card className="border-slate-800 bg-slate-900/90 text-white shadow-2xl backdrop-blur-md">
          <CardHeader className="text-center pb-2 pt-4">
            <CardTitle className="text-xl font-bold">Acesso do Aluno</CardTitle>
            <CardDescription className="text-slate-400 text-xs">
              Identifique-se com seu QRA para entrar no sistema
            </CardDescription>
          </CardHeader>

          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6 bg-slate-800 text-slate-400">
                <TabsTrigger value="login" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">Entrar</TabsTrigger>
                <TabsTrigger value="register" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">Cadastrar</TabsTrigger>
              </TabsList>
              
              {error && <div className="mb-4 p-3 bg-red-900/50 border border-red-500 text-red-200 text-sm rounded-md text-center">{error}</div>}
              {successMsg && <div className="mb-4 p-3 bg-emerald-950/50 border border-emerald-500 text-emerald-200 text-sm rounded-md text-center">{successMsg}</div>}

              <TabsContent value="login">
                <form action={(f) => handleAction(f, true)} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">QRA (Nome de Guerra)</label>
                    <Input name="username" placeholder="Seu QRA" required className="bg-slate-800/50 border-slate-700 h-12 uppercase" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Senha</label>
                    <Input name="password" type="password" placeholder="Sua senha" required className="bg-slate-800/50 border-slate-700 h-12" />
                  </div>
                  <Button type="submit" className="w-full h-12 text-lg bg-blue-600 hover:bg-blue-700">Entrar</Button>
                </form>
              </TabsContent>
              
              <TabsContent value="register">
                <form action={(f) => handleAction(f, false)} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">QRA (Nome de Guerra)</label>
                    <Input name="username" placeholder="Seu QRA" required className="bg-slate-800/50 border-slate-700 h-12 uppercase" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Número do Combatente (1 a 34)</label>
                    <select 
                      name="numero" 
                      required 
                      defaultValue=""
                      className="flex h-12 w-full rounded-md bg-slate-800/50 border border-slate-700 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="" disabled>Selecione seu número</option>
                      {Array.from({ length: 34 }, (_, i) => i + 1).map(num => (
                        <option key={num} value={num} disabled={takenNumbers.includes(num)}>
                          {num < 10 ? `0${num}` : num} {takenNumbers.includes(num) ? "(Indisponível)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Senha</label>
                    <Input name="password" type="password" placeholder="Crie uma senha" required className="bg-slate-800/50 border-slate-700 h-12" />
                  </div>
                  <Button type="submit" className="w-full h-12 text-lg bg-blue-600 hover:bg-blue-700">Criar Cadastro</Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
