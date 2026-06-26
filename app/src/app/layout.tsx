import type { Metadata } from "next";
import "@tuvsud/design-system/tokens/css/light.css";
// dark.css NO se importa: la app fija `ts-theme-light` y no hay activación de tema
// oscuro (sin toggle ni classList sobre .ts-theme-dark) → era CSS muerto en cada carga.
// Si se añade modo oscuro, reimportar aquí.
import "@tuvsud/design-system/theme/fonts.css";
import "./globals.css";
import { AlgorithmInit } from "@/components/algorithm-init";
import { Providers } from "@/components/providers";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import Chatbot from "@/components/Chatbot";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "Focus | TÜV LFD España",
  description: "Buscador 360",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={cn("h-full", "font-sans", geist.variable)}>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" rel="stylesheet" />
      </head>
      <body className="ts-theme-light min-h-full">
        <Providers>
          <AlgorithmInit />
          {children}
          <Chatbot />
        </Providers>
      </body>
    </html>
  );
}
