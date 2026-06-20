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
};

export default nextConfig;
