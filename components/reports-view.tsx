"use client";

import { useMemo, useState } from "react";
import { useEquipments } from "@/hooks/useEquipments";
import { useServiceOrders } from "@/hooks/useServiceOrders";
import { useTimeEntries } from "@/hooks/useTimeEntries";
import { useWorkers } from "@/hooks/useWorkers";
import { useAuditLogs } from "@/hooks/useAuditLogs";
import { useApp } from "@/lib/app-context";
import { formatDate, formatHours } from "@/lib/format";
import { hasPermission } from "@/lib/permissions";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, Filter } from "lucide-react";

type ReportTab = "horas" | "manutentor" | "equipamento" | "custos" | "auditoria";

const CHART_TOOLTIP_STYLE = {
  backgroundColor: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: "6px",
  color: "var(--color-foreground)",
  fontSize: "12px",
};

async function exportXLSX(rows: Array<Array<string | number>>, filename: string, sheetName: string) {
  const XLSX = await import("xlsx");
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet["!cols"] = rows[0]?.map((_, columnIndex) => {
    const maxLength = rows.reduce((largest, row) => {
      const value = row[columnIndex] ?? "";
      return Math.max(largest, String(value).length);
    }, 10);

    return { wch: Math.min(maxLength + 2, 40) };
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, filename);
}

export function ReportsView() {
  const { state } = useApp();
  const { serviceOrders } = useServiceOrders();
  const { workers } = useWorkers();
  const { equipments } = useEquipments();
  const { timeEntries } = useTimeEntries();
  const { auditLogs, loading: auditLoading } = useAuditLogs();

  const [activeTab, setActiveTab] = useState<ReportTab>("horas");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const filteredOrders = useMemo(() => {
    return serviceOrders.filter((order) => {
      if (startDate && new Date(order.openedAt) < new Date(startDate)) return false;
      if (endDate && new Date(order.openedAt) > new Date(endDate + "T23:59:59")) return false;
      return true;
    });
  }, [endDate, serviceOrders, startDate]);

  const filteredEntries = useMemo(() => {
    return timeEntries.filter((entry) => {
      if (startDate && new Date(entry.startTime) < new Date(startDate)) return false;
      if (endDate && new Date(entry.startTime) > new Date(endDate + "T23:59:59")) return false;
      return true;
    });
  }, [endDate, startDate, timeEntries]);

  const totalAvailableHoursPerDay = workers.reduce(
    (accumulator, worker) => accumulator + worker.availableHoursPerDay,
    0
  );

  const workerHoursData = workers.map((worker) => {
    const entries = filteredEntries.filter((entry) => entry.workerId === worker.id);
    const total = entries.reduce((accumulator, entry) => {
      const end = entry.endTime ? new Date(entry.endTime) : new Date();
      return accumulator + (end.getTime() - new Date(entry.startTime).getTime()) / 3600000;
    }, 0);
    const productive = entries
      .filter((entry) => entry.activityType === "Execução" || entry.activityType === "Setup")
      .reduce((accumulator, entry) => {
        const end = entry.endTime ? new Date(entry.endTime) : new Date();
        return accumulator + (end.getTime() - new Date(entry.startTime).getTime()) / 3600000;
      }, 0);

    return {
      name: worker.name.split(" ")[0],
      fullName: worker.name,
      total: Number(total.toFixed(2)),
      produtivo: Number(productive.toFixed(2)),
      improdutivo: Number((total - productive).toFixed(2)),
      availableHoursPerDay: worker.availableHoursPerDay,
    };
  });

  const equipmentData = equipments.map((equipment) => {
    const orders = filteredOrders.filter((order) => order.equipmentId === equipment.id);
    const totalHours = orders.reduce((accumulator, order) => {
      if (!order.startedAt) return accumulator;
      const end = order.finishedAt ? new Date(order.finishedAt) : new Date();
      return accumulator + (end.getTime() - new Date(order.startedAt).getTime()) / 3600000;
    }, 0);
    return {
      name: equipment.name.split(" ").slice(0, 2).join(" "),
      fullName: equipment.name,
      code: equipment.code,
      total: orders.length,
      corretiva: orders.filter((order) => order.type === "Corretiva").length,
      preventiva: orders.filter((order) => order.type === "Preventiva").length,
      horas: Number(totalHours.toFixed(2)),
    };
  });

  const osResources = filteredOrders.map((order) => {
    const partsCount = order.parts.reduce((accumulator, part) => accumulator + part.quantity, 0);
    const orderEntries = filteredEntries.filter((entry) => entry.osId === order.id);
    const laborHours = orderEntries.reduce((accumulator, entry) => {
      const end = entry.endTime ? new Date(entry.endTime) : new Date();
      return accumulator + (end.getTime() - new Date(entry.startTime).getTime()) / 3600000;
    }, 0);
    const equipment = equipments.find((item) => item.id === order.equipmentId);
    return {
      id: order.id,
      number: order.number,
      equipment: equipment?.name ?? "—",
      type: order.type,
      status: order.status,
      openedAt: order.openedAt,
      partsCount,
      laborHours: Number(laborHours.toFixed(2)),
    };
  });

  const totalPartsCount = osResources.reduce((accumulator, resource) => accumulator + resource.partsCount, 0);
  const totalLaborHours = osResources.reduce((accumulator, resource) => accumulator + resource.laborHours, 0);

  async function exportWorkerReport() {
    const rows = [
      ["Manutentor", "Total (h)", "Produtivo (h)", "Improdutivo (h)", "Disponível/Dia (h)"],
      ...workerHoursData.map((worker) => [
        worker.fullName,
        worker.total,
        worker.produtivo,
        worker.improdutivo,
        worker.availableHoursPerDay,
      ]),
    ];
    await exportXLSX(rows, "relatorio-manutentores.xlsx", "Manutentores");
  }

  async function exportCostReport() {
    const rows = [
      ["Nº OS", "Equipamento", "Tipo", "Status", "Abertura", "Quantidade Peças", "Horas M.O."],
      ...osResources.map((resource) => [
        resource.number,
        resource.equipment,
        resource.type,
        resource.status,
        formatDate(resource.openedAt),
        resource.partsCount,
        resource.laborHours,
      ]),
    ];
    await exportXLSX(rows, "relatorio-custos.xlsx", "Custos");
  }

  const canViewCosts = hasPermission(state.currentUser?.role, "reports:costs");
  const canViewAudit = hasPermission(state.currentUser?.role, "reports:view");
  const tabs = [
    { id: "horas" as const, label: "Horas por Período" },
    { id: "manutentor" as const, label: "Por Manutentor" },
    { id: "equipamento" as const, label: "Por Equipamento" },
    ...(canViewCosts ? [{ id: "custos" as const, label: "Peças e Horas" }] : []),
    ...(canViewAudit ? [{ id: "auditoria" as const, label: "Auditoria" }] : []),
  ];

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-muted-foreground text-xs">Período:</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-3 flex-1 lg:flex-initial lg:min-w-[24rem]">
          <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="bg-input border border-border rounded px-3 py-2 text-sm text-foreground w-full" />
          <span className="text-muted-foreground text-xs self-center text-center">até</span>
          <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="bg-input border border-border rounded px-3 py-2 text-sm text-foreground w-full" />
        </div>
        {(startDate || endDate) && (
          <button onClick={() => { setStartDate(""); setEndDate(""); }} className="text-xs text-muted-foreground hover:text-foreground underline">
            Limpar
          </button>
        )}
      </div>

      <div className="flex border-b border-border overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "horas" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {[
              { label: "OS no Período", value: filteredOrders.length },
              { label: "Horas Totais", value: formatHours(filteredEntries.reduce((accumulator, entry) => {
                const end = entry.endTime ? new Date(entry.endTime) : new Date();
                return accumulator + (end.getTime() - new Date(entry.startTime).getTime()) / 3600000;
              }, 0)) },
              { label: "OS Finalizadas", value: filteredOrders.filter((order) => order.status === "Finalizada").length },
              { label: "Disponível/Dia", value: formatHours(totalAvailableHoursPerDay) },
            ].map((kpi) => (
              <div key={kpi.label} className="bg-card border border-border rounded-lg p-4">
                <p className="text-muted-foreground text-xs">{kpi.label}</p>
                <p className="text-foreground text-xl font-bold mt-1">{kpi.value}</p>
              </div>
            ))}
          </div>

          <div className="bg-card border border-border rounded-lg p-5">
            <p className="text-foreground font-semibold text-sm mb-4">Horas Trabalhadas por Manutentor</p>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={workerHoursData} margin={{ top: 0, right: 0, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="name" tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                <Bar dataKey="produtivo" name="Produtivo" fill="var(--color-status-ok)" radius={[3, 3, 0, 0]} stackId="a" />
                <Bar dataKey="improdutivo" name="Improdutivo" fill="var(--color-status-warning)" radius={[3, 3, 0, 0]} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {activeTab === "manutentor" && (
        <div className="space-y-4">
          <div className="flex justify-stretch sm:justify-end">
            <button onClick={exportWorkerReport} className="flex items-center gap-2 px-4 py-2 rounded border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors">
              <Download className="w-3.5 h-3.5" /> Exportar XLSX
            </button>
          </div>
          <div className="bg-card border border-border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {["Manutentor", "Total", "Produtivo", "Improdutivo", "Produtividade", "Disponível/Dia"].map((header) => (
                    <th key={header} className="text-left text-xs text-muted-foreground font-medium px-5 py-3">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {workerHoursData.sort((left, right) => right.total - left.total).map((worker) => {
                  const productivity = worker.total > 0 ? (worker.produtivo / worker.total) * 100 : 0;
                  return (
                    <tr key={worker.fullName} className="border-b border-border/40 hover:bg-muted/20">
                      <td className="px-5 py-3 text-foreground font-medium">{worker.fullName}</td>
                      <td className="px-5 py-3 text-foreground">{formatHours(worker.total)}</td>
                      <td className="px-5 py-3 text-status-ok">{formatHours(worker.produtivo)}</td>
                      <td className="px-5 py-3 text-status-warning">{formatHours(worker.improdutivo)}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 bg-muted rounded-full overflow-hidden">
                            <div className={`h-1.5 rounded-full ${productivity >= 70 ? "bg-status-ok" : productivity >= 50 ? "bg-status-warning" : "bg-status-danger"}`} style={{ width: `${productivity}%` }} />
                          </div>
                          <span className="text-xs text-foreground">{productivity.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-foreground">{formatHours(worker.availableHoursPerDay)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "equipamento" && (
        <div className="bg-card border border-border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {["Equipamento", "Código", "OS", "Corretivas", "Preventivas", "Horas"].map((header) => (
                  <th key={header} className="text-left text-xs text-muted-foreground font-medium px-5 py-3">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {equipmentData.sort((left, right) => right.total - left.total).map((equipment) => (
                <tr key={equipment.code} className="border-b border-border/40 hover:bg-muted/20">
                  <td className="px-5 py-3 text-foreground font-medium">{equipment.fullName}</td>
                  <td className="px-5 py-3 text-muted-foreground font-mono">{equipment.code}</td>
                  <td className="px-5 py-3 text-foreground">{equipment.total}</td>
                  <td className="px-5 py-3 text-status-danger">{equipment.corretiva}</td>
                  <td className="px-5 py-3 text-status-info">{equipment.preventiva}</td>
                  <td className="px-5 py-3 text-foreground">{formatHours(equipment.horas)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "custos" && canViewCosts && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-muted-foreground text-xs">OS no Período</p>
              <p className="text-foreground text-xl font-bold mt-1">{filteredOrders.length}</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-muted-foreground text-xs">Quantidade de Peças</p>
              <p className="text-foreground text-xl font-bold mt-1">{totalPartsCount}</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-muted-foreground text-xs">Horas de Mão de Obra</p>
              <p className="text-foreground text-xl font-bold mt-1">{formatHours(totalLaborHours)}</p>
            </div>
          </div>
          <div className="flex justify-stretch sm:justify-end">
            <button onClick={exportCostReport} className="flex items-center gap-2 px-4 py-2 rounded border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors">
              <Download className="w-3.5 h-3.5" /> Exportar XLSX
            </button>
          </div>
          <div className="bg-card border border-border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {["Nº OS", "Equipamento", "Tipo", "Status", "Abertura", "Qtd. Peças", "Horas M.O."].map((header) => (
                    <th key={header} className="text-left text-xs text-muted-foreground font-medium px-5 py-3">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {osResources.sort((left, right) => right.partsCount - left.partsCount).map((resource) => (
                  <tr key={resource.id} className="border-b border-border/40 hover:bg-muted/20">
                    <td className="px-5 py-3 text-primary font-mono">{resource.number}</td>
                    <td className="px-5 py-3 text-foreground">{resource.equipment}</td>
                    <td className="px-5 py-3 text-foreground">{resource.type}</td>
                    <td className="px-5 py-3 text-foreground">{resource.status}</td>
                    <td className="px-5 py-3 text-muted-foreground">{formatDate(resource.openedAt)}</td>
                    <td className="px-5 py-3 text-foreground">{resource.partsCount}</td>
                    <td className="px-5 py-3 text-foreground">{formatHours(resource.laborHours)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "auditoria" && canViewAudit && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {[
              { label: "Eventos de Auditoria", value: auditLogs.length },
              { label: "OS Auditadas", value: new Set(auditLogs.map((entry) => entry.resourceId)).size },
              { label: "Último Evento", value: auditLogs[0] ? formatDate(auditLogs[0].timestamp) : "—" },
              { label: "Traceabilidade", value: "Logs imutáveis" },
            ].map((kpi) => (
              <div key={kpi.label} className="bg-card border border-border rounded-lg p-4">
                <p className="text-muted-foreground text-xs">{kpi.label}</p>
                <p className="text-foreground text-xl font-bold mt-1">{kpi.value}</p>
              </div>
            ))}
          </div>

          <div className="bg-card border border-border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {['Recurso', 'Ação', 'Usuário', 'Detalhes', 'Data'].map((header) => (
                    <th key={header} className="text-left text-xs text-muted-foreground font-medium px-5 py-3">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {auditLoading ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-6 text-center text-muted-foreground">Carregando auditoria...</td>
                  </tr>
                ) : auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-6 text-center text-muted-foreground">Nenhum evento de auditoria encontrado.</td>
                  </tr>
                ) : (
                  auditLogs.map((entry) => (
                    <tr key={entry.id} className="border-b border-border/40 hover:bg-muted/20">
                      <td className="px-5 py-3 text-foreground font-medium">{entry.resource}</td>
                      <td className="px-5 py-3 text-foreground">{entry.action}</td>
                      <td className="px-5 py-3 text-foreground">{entry.userName}</td>
                      <td className="px-5 py-3 text-muted-foreground max-w-xl truncate">{entry.details ?? (entry.metadata ? JSON.stringify(entry.metadata) : "—")}</td>
                      <td className="px-5 py-3 text-muted-foreground">{formatDate(entry.timestamp)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}