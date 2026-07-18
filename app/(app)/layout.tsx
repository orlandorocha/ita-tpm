"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppProvider, useApp } from "@/lib/app-context";
import { Sidebar, TopBar, getPageTitle } from "@/components/shell";
import { LoginForm } from "@/components/login-form";
import QRCodeOperacionalPage from "./qrcode-operacional/page";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { state } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    // Bloqueia acesso direto à rota /qrcode-operacional após conclusão do fluxo
    // Move para useEffect para evitar router dispatch antes da inicialização
    if (isMounted && pathname === "/qrcode-operacional" && state.isAuthenticated) {
      router.replace("/ordens");
    }
  }, [isMounted, pathname, state.isAuthenticated, router]);

  if (state.isHydrating) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Carregando sessão...
      </div>
    );
  }

  if (!state.isAuthenticated) {
    return <LoginForm />;
  }

  // Verifica se precisa de autenticação operacional
  if (state.operationalAuthRequired && !state.operationalAuthCompleted) {
    // Renderiza apenas a página de QR Code sem sidebar/menu
    return <QRCodeOperacionalPage />;
  }

  // Redirect durante render é evitado - feito em useEffect acima
  if (pathname === "/qrcode-operacional") {
    return null;
  }

  const pageTitle = getPageTitle(pathname);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col bg-background">
        <TopBar title={pageTitle} onMenuClick={() => setMobileMenuOpen(true)} />
        <main className="flex-1 overflow-y-auto bg-background">{children}</main>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <AuthGuard>{children}</AuthGuard>
    </AppProvider>
  );
}
