import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StoriIA — Storie AI personalizzate per bambini",
  description:
    "Crea storie testuali indimenticabili su misura per i tuoi figli con l'intelligenza artificiale. Lettura attiva, sicura e studiata per famiglie italiane.",
  keywords: ["storie per bambini", "racconti AI", "lettura attiva", "genitori", "favole personalizzate"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body className="antialiased min-h-screen flex flex-col">
        {children}
      </body>
    </html>
  );
}
