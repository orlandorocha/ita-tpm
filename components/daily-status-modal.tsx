"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  getMaintainersOnDayOff,
  getMaintainersAvailableForActivities,
  getBusinessDateKey,
  getBusinessDateFromKey,
} from "@/lib/day-off-alerts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useWorkers } from "@/hooks/useWorkers";
import { useWorkSchedules } from "@/hooks/useWorkSchedules";
import { useUsers } from "@/hooks/useUsers";
import { getScaleBadgeColor } from "@/lib/work-schedules";
import { cn } from "@/lib/utils";
import { BedDouble, Wrench, Users, CalendarCheck } from "lucide-react";

interface DailyStatusModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Tab = "available" | "dayoff";

export function DailyStatusModal({ open, onOpenChange }: DailyStatusModalProps) {
  const { workers } = useWorkers();
  const { schedules, overrides: overrideRows, cycleOverrides: cycleOverrideRows } = useWorkSchedules();
  const { users } = useUsers();
  const [tab, setTab] = useState<Tab>("available");

  const today = useMemo(() => {
    const key = getBusinessDateKey();
    return getBusinessDateFromKey(key);
  }, []);

  const formattedDate = useMemo(
    () => format(today, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR }),
    [today]
  );

  const availableWorkers = useMemo(
    () =>
      getMaintainersAvailableForActivities({
        workers,
        users,
        schedules,
        overrides: overrideRows,
        cycleOverrides: cycleOverrideRows,
        date: today,
      }),
    [workers, users, schedules, overrideRows, cycleOverrideRows, today]
  );

  const dayOffWorkers = useMemo(
    () =>
      getMaintainersOnDayOff({
        workers,
        users,
        schedules,
        overrides: overrideRows,
        cycleOverrides: cycleOverrideRows,
        date: today,
      }),
    [workers, users, schedules, overrideRows, cycleOverrideRows, today]
  );

  const shownList = tab === "available" ? availableWorkers : dayOffWorkers;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
            <CalendarCheck className="h-4 w-4 text-primary" />
            Situacao dos manutentores hoje
          </DialogTitle>
          <DialogDescription className="capitalize text-xs text-muted-foreground">
            {formattedDate}
          </DialogDescription>
        </DialogHeader>

        {/* Resumo */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-status-ok/30 bg-status-ok/10 px-4 py-3 flex items-center gap-3">
            <Wrench className="h-5 w-5 text-status-ok shrink-0" />
            <div>
              <p className="text-[11px] text-status-ok/80">Disponiveis</p>
              <p className="text-2xl font-semibold text-status-ok leading-none mt-0.5">
                {availableWorkers.length}
              </p>
            </div>
          </div>
          <div className="rounded-lg border border-status-warning/30 bg-status-warning/10 px-4 py-3 flex items-center gap-3">
            <BedDouble className="h-5 w-5 text-status-warning shrink-0" />
            <div>
              <p className="text-[11px] text-status-warning/80">De folga</p>
              <p className="text-2xl font-semibold text-status-warning leading-none mt-0.5">
                {dayOffWorkers.length}
              </p>
            </div>
          </div>
        </div>

        {/* Abas */}
        <div className="flex rounded-lg border border-border overflow-hidden text-sm">
          <button
            onClick={() => setTab("available")}
            className={cn(
              "flex-1 py-2 font-medium transition-colors",
              tab === "available"
                ? "bg-status-ok/10 text-status-ok"
                : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
            )}
          >
            Disponiveis ({availableWorkers.length})
          </button>
          <button
            onClick={() => setTab("dayoff")}
            className={cn(
              "flex-1 py-2 font-medium transition-colors border-l border-border",
              tab === "dayoff"
                ? "bg-status-warning/10 text-status-warning"
                : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
            )}
          >
            De folga ({dayOffWorkers.length})
          </button>
        </div>

        {/* Lista */}
        <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
          {shownList.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              {tab === "available"
                ? "Nenhum manutentor disponivel hoje."
                : "Nenhum manutentor de folga hoje."}
            </div>
          ) : (
            shownList.map((worker) => (
              <div
                key={worker.workerId}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2.5"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                      tab === "available"
                        ? "bg-status-ok/15 text-status-ok"
                        : "bg-status-warning/15 text-status-warning"
                    )}
                  >
                    {worker.workerName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground leading-tight">
                      {worker.workerName}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{worker.registration}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                      getScaleBadgeColor(worker.scaleCode)
                    )}
                  >
                    {worker.scaleCode}
                  </span>
                  {tab === "available" && "status" in worker && (
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                        (worker as any).status === "Disponivel"
                          ? "border-status-ok/30 bg-status-ok/10 text-status-ok"
                          : "border-border bg-muted/40 text-muted-foreground"
                      )}
                    >
                      {(worker as any).status ?? "Disponivel"}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Rodape */}
        <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5 shrink-0" />
          Total de manutentores na escala: {availableWorkers.length + dayOffWorkers.length}
        </div>
      </DialogContent>
    </Dialog>
  );
}
