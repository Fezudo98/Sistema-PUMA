"use client";

import { useEffect, useState } from "react";
import { Download, Share, SquarePlus, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

// Android/Chrome expõe um evento pra disparar o prompt nativo de instalação — o
// TypeScript padrão do DOM ainda não tipa esse evento (é uma extensão específica
// do Chromium), então declaramos o mínimo necessário aqui.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// iOS/Safari nunca dispara beforeinstallprompt — não existe API programática pra
// instalar de lá. A única forma é o aluno tocar em Compartilhar → "Adicionar à Tela
// de Início" manualmente, então pra esse caso mostramos instruções em vez de botão.
function detectIOS(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const isIOSDevice = /iPad|iPhone|iPod/.test(ua);
  // iPad em modo "desktop" (padrão desde iPadOS 13) se identifica como Mac, mas tem
  // touch — diferencia de um Mac de verdade, que não tem.
  const isIPadOS13Plus = ua.includes("Macintosh") && navigator.maxTouchPoints > 1;
  return isIOSDevice || isIPadOS13Plus;
}

function detectStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true // Safari/iOS não suporta a media query acima
  );
}

export function InstallAppCard() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    setIsStandalone(detectStandalone());
    setIsIOS(detectIOS());

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
    } finally {
      // Independente do aluno aceitar ou recusar, o navegador só permite usar esse
      // prompt UMA vez — descarta pra não tentar reusar um evento já consumido.
      setDeferredPrompt(null);
      setInstalling(false);
    }
  };

  // Já instalado: nada a oferecer. Nem Android com prompt disponível, nem iOS:
  // não há nada acionável pra mostrar (Firefox desktop, navegadores sem suporte, etc.).
  if (isStandalone) return null;
  if (!isIOS && !deferredPrompt) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-card border border-border p-5 sm:p-6 shadow-lg">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-500/15 border border-blue-500/40 flex items-center justify-center shrink-0">
            <Smartphone className="w-5 h-5 text-blue-400" />
          </div>
          <div className="space-y-1">
            <h3 className="font-black text-heading uppercase tracking-wide text-sm">Instalar como Aplicativo</h3>
            {isIOS ? (
              <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                Toque em <Share className="w-3.5 h-3.5 inline -mt-0.5 mx-0.5 text-blue-400" strokeWidth={2.5} /> <strong className="text-heading">Compartilhar</strong>, na barra do Safari, e depois em{" "}
                <span className="inline-flex items-center gap-1 text-heading font-bold">
                  <SquarePlus className="w-3.5 h-3.5 text-blue-400" />
                  "Adicionar à Tela de Início"
                </span>
                . O PUMA passa a abrir em tela cheia, com ícone próprio.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                Acesse mais rápido, com ícone próprio na tela inicial e sem a barra do navegador — como um app nativo.
              </p>
            )}
          </div>
        </div>

        {!isIOS && (
          <Button
            onClick={handleInstallClick}
            disabled={installing}
            className="w-full sm:w-auto h-11 px-6 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider shrink-0 cursor-pointer flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            {installing ? "Instalando..." : "Instalar App"}
          </Button>
        )}
      </div>
    </div>
  );
}
