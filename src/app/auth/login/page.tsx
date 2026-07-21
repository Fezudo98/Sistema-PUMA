"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRouter } from "next/navigation";
import { loginUser, registerUser } from "@/app/actions/auth";

export default function InstructorAuth() {
  const [error, setError] = useState("");
  const router = useRouter();

  const handleAction = async (formData: FormData, isLogin: boolean) => {
    setError("");
    formData.append("role", "INSTRUCTOR");
    
    // For login, name might not be provided, but username is.
    const res: any = isLogin ? await loginUser(formData) : await registerUser(formData);
    
    if (res?.error) {
      setError(res.error);
    } else if (res?.success) {
      router.push("/instructor");
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 bg-slate-950 bg-cover bg-center"
      style={{ backgroundImage: "url('/arte_fundo.png')" }}
    >
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm pointer-events-none"></div>

      <div className="w-full max-w-md z-10">
        <div className="flex flex-col items-center mb-8">
          <Image src="/logo.png" alt="Sistema PUMA" width={110} height={110} className="drop-shadow-[0_0_20px_rgba(245,158,11,0.35)] object-contain mb-2 hover:scale-105 transition-transform duration-300" />
          <h1 className="text-3xl font-extrabold text-white mt-2">Sistema <span className="text-blue-500">PUMA</span></h1>
          <p className="text-slate-400 font-medium">Acesso Restrito: Instrutores</p>
        </div>
        
        <Card className="border-slate-800 bg-slate-900/90 text-white shadow-2xl backdrop-blur-md">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl font-bold">Acesso do Instrutor</CardTitle>
            <CardDescription className="text-slate-400">
              Gerencie simulados e turmas
            </CardDescription>
          </CardHeader>

          <CardContent>
            {error && <div className="mb-4 p-3 bg-red-900/50 border border-red-500 text-red-200 text-sm rounded-md text-center">{error}</div>}

            <form action={(f) => handleAction(f, true)} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Nome de Usuário</label>
                <Input name="username" placeholder="Seu nome de usuário" required className="bg-slate-800/50 border-slate-700 h-12" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Senha</label>
                <Input name="password" type="password" placeholder="Sua senha" required className="bg-slate-800/50 border-slate-700 h-12" />
              </div>
              <Button type="submit" className="w-full h-12 text-lg bg-blue-600 hover:bg-blue-700">Entrar no Painel</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
