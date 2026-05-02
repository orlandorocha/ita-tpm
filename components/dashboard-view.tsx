"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useEquipments } from "@/hooks/useEquipments";
import { useServiceOrders } from "@/hooks/useServiceOrders";
import { useTimeEntries } from "@/hooks/useTimeEntries";
import { useWorkers } from "@/hooks/useWorkers";
import { formatCurrency, formatHours, getOSPriorityColor, getOSStatusColor, timeAgo } from "@/lib/format";
import { OS_TYPES } from "@/lib/types";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  ClipboardList,
  Timer,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-5 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">{label}</p>
        <p className="text-foreground text-2xl font-bold mt-1 leading-none">{value}</p>
        {sub && <p className="text-muted-foreground text-xs mt-1">{sub}</p>}
      </div>
    </div>
  );
}

export function DashboardView() {
  const { serviceOrders, loading: ordersLoading } = useServiceOrders();
  const { workers, loading: workersLoading } = useWorkers();
  const { equipments, loading: equipmentsLoading } = useEquipments();
  const { timeEntries, loading: timeLoading } = useTimeEntries();

  const loading = ordersLoading || workersLoading || equipmentsLoading || timeLoading;

  const data = useMemo(() => {
    const osAbertas = serviceOrders.filter((order) => order.status === "Aberta").length;
    const osAndamento = serviceOrders.filter((order) => order.status === "Em andamento").length;
    const osPausadas = serviceOrders.filter((order) => order.status === "Pausada").length;
    const osFinalizadas = serviceOrders.filter((order) => order.status === "Finalizada").length;
    const osCriticas = serviceOrders.filter((order) => order.priority === "Crítica").length;

    const finishedOrders = serviceOrders.filter((order) => order.startedAt && order.finishedAt);
    const mttr =
      finishedOrders.length > 0
        ? finishedOrders.reduce((accumulator, order) => {
            const diff =
              (new Date(order.finishedAt!).getTime() - new Date(order.startedAt!).getTime()) / 3600000;
            return accumulator + diff;
          }, 0) / finishedOrders.length
        : 0;

    const totalHorasOps = timeEntries.reduce((accumulator, entry) => {
      const end = entry.endTime ? new Date(entry.endTime) : new Date();
      return accumulator + (end.getTime() - new Date(entry.startTime).getTime()) / 3600000;
    }, 0);

    const totalCostParts = serviceOrders.reduce(
      (accumulator, order) =>
        accumulator + order.parts.reduce((partsAccumulator, part) => partsAccumulator + part.quantity * part.unitCost, 0),
      0
    );

    const osByType = OS_TYPES.map((type) => ({
      name: type,
      value: serviceOrders.filter((order) => order.type === type).length,
    }));

    const workerRanking = workers
      .map((worker) => ({
        name: worker.name.split(" ")[0],
        horas: Number(
          timeEntries
            .filter((entry) => entry.workerId === worker.id)
            .reduce((accumulator, entry) => {
              const end = entry.endTime ? new Date(entry.endTime) : new Date();
              return accumulator + (end.getTime() - new Date(entry.startTime).getTime()) / 3600000;
            }, 0)
            .toFixed(1)
        ),
      }))
      .sort((left, right) => right.horas - left.horas)
      .slice(0, 5);

    const equipFailures = equipments
      .map((equipment) => ({
        id: equipment.id,
        name: equipment.name.split(" ").slice(0, 2).join(" "),
        falhas: serviceOrders.filter((order) => order.equipmentId === equipment.id).length,
      }))
      .sort((left, right) => right.falhas - left.falhas)
      .slice(0, 5);

    const recentOS = [...serviceOrders]
      .sort((left, right) => new Date(right.openedAt).getTime() - new Date(left.openedAt).getTime())
      .slice(0, 6);

    return {
      osAbertas,
      osAndamento,
      osPausadas,
      osFinalizadas,
      osCriticas,
      mttr,
      totalHorasOps,
      totalCostParts,
      osByType,
      workerRanking,
      equipFailures,
      recentOS,
    };
  }, [equipments, serviceOrders, timeEntries, workers]);

  if (loading && serviceOrders.length === 0) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando dashboard...</div>;
  }

  const PIE_COLORS = ["#ef6c2c", "#3b82f6", "#f59e0b"];

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="OS Abertas"
          value={data.osAbertas}
          sub={`${data.osCriticas} críticas`}
          icon={ClipboardList}
          color="bg-status-warning/20 text-status-warning"
        />
        <KpiCard
          label="Em Andamento"
          value={data.osAndamento}
          sub={`${data.osPausadas} pausadas`}
          icon={Activity}
          color="bg-status-info/20 text-status-info"
        />
        <KpiCard
          label="Finalizadas"
          value={data.osFinalizadas}
          sub={`MTTR: ${formatHours(data.mttr)}`}
          icon={CheckCircle}
          color="bg-status-ok/20 text-status-ok"
        />
        <KpiCard
          label="Horas Trabalhadas"
          value={formatHours(data.totalHorasOps)}
          sub={`Custo peças: ${formatCurrency(data.totalCostParts)}`}
          icon={Timer}
          color="bg-primary/20 text-primary"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card border border-border rounded-lg p-5">
          <p className="text-foreground font-semibold text-sm mb-4">Horas por Manutentor</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.workerRanking} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="name" tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--color-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "6px",
                  color: "var(--color-foreground)",
                  fontSize: "12px",
                }}
                formatter={(value) => [`${value}h`, "Horas"]}
              />
              <Bar dataKey="horas" fill="var(--color-primary)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-lg p-5">
          <p className="text-foreground font-semibold text-sm mb-4">OS por Tipo</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={data.osByType} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                {data.osByType.map((_, index) => (
                  <Cell key={index} fill={PIE_COLORS[index]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--color-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "6px",
                  fontSize: "12px",
                  color: "var(--color-foreground)",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-col gap-1.5 mt-2">
            {data.osByType.map((item, index) => (
              <div key={item.name} className="flex items-center gap-2 text-xs">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[index] }} />
                <span className="text-muted-foreground">{item.name}</span>
                <span className="ml-auto text-foreground font-medium">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card border border-border rounded-lg">
          <div className="flex items-center justify-between gap-3 px-4 sm:px-5 pt-5 pb-3">
            <p className="text-foreground font-semibold text-sm">Ordens Recentes</p>
            <Link href="/ordens" className="text-primary text-xs hover:underline flex items-center gap-1">
              Ver todas <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-border">
                  <th className="text-left text-xs text-muted-foreground font-medium px-5 py-2">Nº OS</th>
                  <th className="text-left text-xs text-muted-foreground font-medium px-3 py-2">Equipamento</th>
                  <th className="text-left text-xs text-muted-foreground font-medium px-3 py-2 hidden sm:table-cell">Prioridade</th>
                  <th className="text-left text-xs text-muted-foreground font-medium px-3 py-2">Status</th>
                  <th className="text-right text-xs text-muted-foreground font-medium px-5 py-2">Aberta</th>
                </tr>
              </thead>
              <tbody>
                {data.recentOS.map((order) => {
                  const equipment = equipments.find((item) => item.id === order.equipmentId);
                  return (
                    <tr key={order.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-2.5">
                        <Link href="/ordens" className="text-primary font-mono text-xs hover:underline">
                          {order.number}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-foreground/80 text-xs truncate max-w-[120px] sm:max-w-[180px]">{equipment?.name ?? "—"}</td>
                      <td className="px-3 py-2.5 hidden sm:table-cell">
                        <span className={`inline-flex px-2 py-0.5 rounded border text-[10px] font-semibold ${getOSPriorityColor(order.priority)}`}>
                          {order.priority}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex px-2 py-0.5 rounded border text-[10px] font-medium ${getOSStatusColor(order.status)}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-5 py-2.5 text-right text-muted-foreground text-xs">{timeAgo(order.openedAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-foreground font-semibold text-sm">Top Equipamentos</p>
            <AlertTriangle className="w-4 h-4 text-status-warning" />
          </div>
          <div className="space-y-3">
            {data.equipFailures.map((equipment, index) => (
              <div key={equipment.id} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded bg-muted flex items-center justify-center text-muted-foreground text-[10px] font-bold shrink-0">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-foreground text-xs truncate">{equipment.name}</p>
                  <div className="h-1 bg-muted rounded-full mt-1">
                    <div className="h-1 bg-status-danger rounded-full" style={{ width: `${(equipment.falhas / (data.equipFailures[0]?.falhas || 1)) * 100}%` }} />
                  </div>
                </div>
                <span className="text-status-danger text-xs font-bold shrink-0">{equipment.falhas}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}