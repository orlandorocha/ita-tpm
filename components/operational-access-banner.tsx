"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronRight, X } from "lucide-react";
import { useApp } from "@/lib/app-context";

export function OperationalAccessBanner() {
  const router = useRouter();
  const { state } = useApp();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const equipmentId = state.scannedEquipmentId;

  function handleDismiss() {
    setDismissed(true);
    // Remove o query param da URL sem recarregar a página
    router.replace("/ordens");
  }

  function handleNavigate(href: string) {
    router.push(href);
  }

  return (
    <div className="border-b border-green-500/30 bg-green-500/10 px-4 py-3 sm:px-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-green-800 dark:text-green-400">
              Autenticação operacional concluída
            </p>
            <p className="text-xs text-green-700/80 dark:text-green-500 mt-0.5">
              {equipmentId
                ? <>Equipamento <span className="font-mono font-medium">{equipmentId}</span> vinculado à sessão. Você está visualizando as ordens de serviço.</>
                : "Sessão operacional iniciada. Você está visualizando as ordens de serviço."}
            </p>

            {/* Atalhos para outras áreas */}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => handleNavigate("/tempo")}
                className="inline-flex items-center gap-1.5 rounded-md border border-green-500/40 bg-green-500/20 px-3 py-1.5 text-xs font-medium text-green-800 dark:text-green-300 hover:bg-green-500/30 transition-colors"
              >
                Controle de Tempo
                <ChevronRight className="h-3 w-3" />
              </button>
              <button
                onClick={() => handleNavigate("/equipamentos")}
                className="inline-flex items-center gap-1.5 rounded-md border border-green-500/40 bg-green-500/20 px-3 py-1.5 text-xs font-medium text-green-800 dark:text-green-300 hover:bg-green-500/30 transition-colors"
              >
                Equipamentos
                <ChevronRight className="h-3 w-3" />
              </button>
              <button
                onClick={() => handleNavigate("/configuracoes")}
                className="inline-flex items-center gap-1.5 rounded-md border border-green-500/40 bg-green-500/20 px-3 py-1.5 text-xs font-medium text-green-800 dark:text-green-300 hover:bg-green-500/30 transition-colors"
              >
                Configurações
                <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={handleDismiss}
          className="shrink-0 rounded-md p-1 text-green-700/60 hover:text-green-800 hover:bg-green-500/20 transition-colors"
          aria-label="Fechar aviso"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
