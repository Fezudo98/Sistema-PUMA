import type { NextConfig } from "next";
import os from "os";

// Pega dinamicamente todos os IPs locais do notebook para liberar o acesso mobile
const getLocalIPs = () => {
  const interfaces = os.networkInterfaces();
  const ips: string[] = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
};

const nextConfig: NextConfig = {
  // @ts-ignore - Permite HMR (Hot Module Replacement) e acesso via celular na rede local
  allowedDevOrigins: getLocalIPs(),
  // Otimização para VPS com pouca RAM (evita OOM Killer "Killed" ao rodar verificação do TypeScript no servidor)
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    workerThreads: false,
    cpus: 1,
  },
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
  // Mesmo fallback do webpack acima, mas pro bundler do Turbopack (usado por padrão
  // em "next dev") — sem isso, qualquer página que importe o PdfViewer (via
  // JustificativaWithCitation) quebra em dev com "Module not found: canvas", já que
  // o pdfjs-dist só precisa desse módulo nativo em ambiente Node puro, não no browser.
  turbopack: {
    resolveAlias: {
      canvas: "./src/lib/emptyModule.ts",
    },
  },
};

export default nextConfig;
