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
};

import { ThemeProvider } from "@/components/ThemeProvider";
import { LightningEffect } from "@/components/LightningEffect";
import { BepiEffect } from "@/components/BepiEffect";
import { SertaoBackdrop } from "@/components/SertaoBackdrop";
import { ChoqueEffect } from "@/components/ChoqueEffect";
import { ChoqueBackdrop } from "@/components/ChoqueBackdrop";

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
          {children}
          <LightningEffect />
          <BepiEffect />
          <ChoqueEffect />
        </ThemeProvider>
      </body>
    </html>
  );
}
