"use client";

import { useState } from "react";
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

  // Bloqueia acesso direto à rota /qrcode-operacional após conclusão do fluxo
  if (pathname === "/qrcode-operacional") {
    router.replace("/ordens");
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
