import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Galeria do evento",
  description: "Galeria colaborativa e privada de fotos de eventos.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
