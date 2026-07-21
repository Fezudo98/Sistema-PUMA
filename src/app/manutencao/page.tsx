"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wrench, ShieldAlert, RefreshCw, Clock, CheckCircle2 } from "lucide-react";
import { getMaintenanceStatusAction } from "@/app/actions/maintenance";

export default function ManutencaoPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date>(new Date());
  const [restored, setRestored] = useState(false);

  const checkStatus = async (manual = false) => {
    if (manual) setChecking(true);
    try {
      const status = await getMaintenanceStatusAction();
      setLastCheck(new Date());
      if (!status.enabled) {
        setRestored(true);
        setTimeout(() => {
          window.location.href = "/aluno";
        }, 1200);
      }
    } catch (e) {
      console.error("Erro ao checar status:", e);
    } finally {
      if (manual) setChecking(false);
    }
  };

  useEffect(() => {
    // Checagem imediata ao montar
    checkStatus();

    // Loop de verificação automática a cada 8 segundos
    const interval = setInterval(() => {
      checkStatus();
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 bg-slate-950 bg-cover bg-center relative overflow-hidden"
      style={{ backgroundImage: "url('/arte_fundo.png')" }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-950/90 to-slate-950 pointer-events-none"></div>

      <div className="w-full max-w-lg z-10 space-y-6">
        <div className="flex flex-col items-center text-center">
          <Image 
            src="/logo.png" 
            alt="Sistema PUMA" 
            width={120} 
            height={120} 
            className="drop-shadow-[0_0_25px_rgba(245,158,11,0.5)] object-contain mb-4 animate-pulse" 
          />
          <span className="px-3 py-1 bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs font-black rounded-full uppercase tracking-widest flex items-center gap-2 mb-3 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
            <Wrench className="w-3.5 h-3.5 text-amber-400 animate-spin" style={{ animationDuration: "6s" }} />
            Manutenção Operacional
          </span>
          <h1 className="text-3xl font-black text-white tracking-tight uppercase drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
            Servidor em <span className="text-amber-500">Manutenção</span>
          </h1>
          <p className="text-slate-400 font-bold uppercase tracking-wider text-xs mt-1">
            Sistema PUMA • 32º Pelotão
          </p>
        </div>

        <Card className="border-amber-500/30 bg-slate-900/90 text-white shadow-[0_0_40px_rgba(245,158,11,0.15)] backdrop-blur-md relative overflow-hidden">
          {/* Top accent bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600"></div>

          <CardHeader className="text-center pb-3 pt-6">
            <CardTitle className="text-xl font-bold flex items-center justify-center gap-2 text-amber-400">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
              Acesso Temporariamente Suspenso
            </CardTitle>
            <CardDescription className="text-slate-300 text-sm mt-2 leading-relaxed">
              O servidor está passando por atualizações técnicas, manutenções táticas e melhorias em nosso banco de dados.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 pt-2 pb-6">
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-300 space-y-1">
                  <p className="font-bold text-white uppercase tracking-wider">Previsão de Retorno:</p>
                  <p>Estamos trabalhando com a máxima celeridade. Retornaremos em breve com força total para a continuação de suas instruções e simulados.</p>
                </div>
              </div>
            </div>

            {restored ? (
              <div className="bg-emerald-500/20 border border-emerald-500/50 rounded-xl p-4 text-center space-y-2 animate-bounce">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <p className="text-sm font-bold text-emerald-300">
                  Manutenção Finalizada! Servidor Online.
                </p>
                <p className="text-xs text-emerald-400/80">
                  Redirecionando você para a área do aluno...
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <Button 
                  onClick={() => checkStatus(true)} 
                  disabled={checking}
                  className="w-full bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-slate-950 font-black uppercase tracking-wider py-6 shadow-[0_0_20px_rgba(245,158,11,0.3)] transition-all transform active:scale-[0.98]"
                >
                  {checking ? (
                    <>
                      <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                      Verificando Servidor...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-5 h-5 mr-2" />
                      Verificar se Voltou Online
                    </>
                  )}
                </Button>
                <p className="text-[11px] text-center text-slate-500 flex items-center justify-center gap-1.5 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Esta página verifica o retorno automaticamente a cada 8 segundos
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
