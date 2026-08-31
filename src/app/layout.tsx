import type { Metadata } from "next";
import "./globals.css";

const geistSans = {
  variable: "font-sans",
};

const geistMono = {
  variable: "font-mono",
};

export const metadata: Metadata = {
  title: "Sistema PUMA",
  description: "Plataforma Unificada de Métricas e Aprendizado",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png"
  },
  // Sem isso, "Adicionar à Tela de Início" no iOS abre o site dentro do Safari (com
  // barra de endereço visível) em vez de tela cheia como um app de verdade — mesmo
  // já tendo manifest.json com display:standalone (o iOS ignora isso e exige suas
  // próprias tags apple-mobile-web-app-*).
  //
  // appleWebApp.capable já gera sozinho a tag genérica "mobile-web-app-capable"
  // (confirmado direto no HTML renderizado) — mas NÃO gera mais a
  // "apple-mobile-web-app-capable" prefixada nesta versão do Next.js, mesmo essa
  // continuando necessária pra versões mais antigas de iOS/Safari reconhecerem o
  // modo tela cheia. Por isso ela precisa ser adicionada manualmente aqui.
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "PUMA"
  },
  other: {
    "apple-mobile-web-app-capable": "yes"
  }
};

export const viewport = {
  themeColor: "#020617"
};

import { ThemeProvider } from "@/components/ThemeProvider";
import { LightningEffect } from "@/components/LightningEffect";
import { BepiEffect } from "@/components/BepiEffect";
import { SertaoBackdrop } from "@/components/SertaoBackdrop";
import { ChoqueEffect } from "@/components/ChoqueEffect";
import { ChoqueBackdrop } from "@/components/ChoqueBackdrop";
import { ChoqueCamoBar } from "@/components/ChoqueCamoBar";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          themes={["light", "dark", "raio", "bepi", "choque"]}
          disableTransitionOnChange
        >
          <SertaoBackdrop />
          <ChoqueBackdrop />
          <ChoqueCamoBar />
          {children}
          <LightningEffect />
          <BepiEffect />
          <ChoqueEffect />
        </ThemeProvider>
      </body>
    </html>
  );
}
