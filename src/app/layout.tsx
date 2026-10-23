import type { Metadata } from "next";
import Link from "next/link";
import { MapPinned } from "lucide-react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Prospectar",
  description: "Prospecção de clientes pelo Google Maps",
};

const NAV = [
  { href: "/", rotulo: "Leads" },
  { href: "/buscas", rotulo: "Buscas" },
  { href: "/configuracoes", rotulo: "Configurações" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:gap-6">
            <Link href="/" className="flex items-center gap-2 font-semibold text-slate-900" aria-label="Prospectar">
              <MapPinned className="size-5 text-marca-600" />
              <span className="hidden sm:inline">Prospectar</span>
            </Link>
            <nav className="flex gap-1 text-sm">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="rounded-md px-2 py-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 sm:px-3">
                  {n.rotulo}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
