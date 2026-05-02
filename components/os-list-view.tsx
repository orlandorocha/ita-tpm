"use client";

import { useMemo, useState } from "react";
import { useEquipments } from "@/hooks/useEquipments";
import { useServiceOrders } from "@/hooks/useServiceOrders";
import { useTimeEntries } from "@/hooks/useTimeEntries";
import { useWorkers } from "@/hooks/useWorkers";
import { useApp } from "@/lib/app-context";
import { formatDate, formatDateTime, formatHours, getOSPriorityColor, getOSStatusColor, getOSTypeColor, isServiceOrderOverdue, timeAgo } from "@/lib/format";
import { hasPermission } from "@/lib/permissions";
import { normalizeServiceOrderNumber } from "@/lib/supabase-mappers";
import { resolveCurrentUserWorkerId } from "@/lib/utils";
import { OS_TYPES, type OSPriority, type OSStatus, type OSType, type Part, type ServiceOrder, type Worker } from "@/lib/types";
import {
  CheckCircle2,
  Eye,
  Package,
  Pencil,
  PlayCircle,
  Plus,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";

function Badge({ className, children }: { className?: string; children: React.ReactNode }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-semibold ${className}`}>{children}</span>;
}

function getEditableOrderNumber(value?: string) {
  return value ? value.replace(/^OS-\s*/i, "") : "";
}

function getSectorFromEquipment(equipment?: { location: string; productionLine: string }) {
  if (!equipment) return "";
  return equipment.location || equipment.productionLine || "";
}

function OrderFormModal({
  order,
  onSaved,
  onClose,
}: {
  order?: ServiceOrder;
  onSaved: () => Promise<unknown>;
  onClose: () => void;
}) {
  const { state } = useApp();
  const currentUserName = state.currentUser?.name ?? "Sistema";
  const { equipments } = useEquipments();
  const { workers } = useWorkers();
  const { create, update, loading, error } = useServiceOrders();

  const [form, setForm] = useState({
    number: getEditableOrderNumber(order?.number),
    type: order?.type ?? ("Corretiva" as OSType),
    priority: order?.priority ?? ("Média" as OSPriority),
    dueDate: order?.dueDate ?? "",
    equipmentId: order?.equipmentId ?? "",
    sector: order?.sector ?? "",
    description: order?.description ?? "",
    status: order?.status ?? ("Aberta" as OSStatus),
    workerIds: order?.workerIds ?? ([] as string[]),
  });
  const [formError, setFormError] = useState<string | null>(null);

  function handleEquipmentChange(equipmentId: string) {
    const selectedEquipment = equipments.find((equipment) => equipment.id === equipmentId);

    setForm((previous) => ({
      ...previous,
      equipmentId,
      sector: getSectorFromEquipment(selectedEquipment),
    }));
  }

  function toggleWorker(workerId: string) {
    setForm((previous) => ({
      ...previous,
      workerIds: previous.workerIds.includes(workerId)
        ? previous.workerIds.filter((id) => id !== workerId)
        : [...previous.workerIds, workerId],
    }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const normalizedNumber = normalizeServiceOrderNumber(form.number);
    if (!normalizedNumber) {
      setFormError("Informe o número da OS gerado no SAP.");
      return;
    }

    if (order) {
      const result = await update(order.id, {
        number: normalizedNumber,
        type: form.type,
        priority: form.priority,
        dueDate: form.dueDate,
        equipmentId: form.equipmentId,
        sector: form.sector,
        description: form.description,
        status: form.status,
        assignedTo: form.workerIds[0],
        workerIds: form.workerIds,
      }, currentUserName);
      if (!result) {
        return;
      }
    } else {
      const result = await create({
        number: normalizedNumber,
        type: form.type,
        priority: form.priority,
        dueDate: form.dueDate,
        equipmentId: form.equipmentId,
        sector: form.sector,
        description: form.description,
        status: form.status,
        assignedTo: form.workerIds[0],
        workerIds: form.workerIds,
      }, currentUserName);
      if (!result) {
        return;
      }
    }
    await onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-lg w-full max-w-2xl shadow-2xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-border shrink-0">
          <h2 className="text-foreground font-semibold text-sm sm:text-base">{order ? `Editar ${order.number}` : "Nova Ordem de Serviço"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={submit} className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Número da OS</label>
              <input
                value={form.number}
                onChange={(event) => setForm((previous) => ({ ...previous, number: event.target.value }))}
                placeholder="Digite somente o número do SAP"
                className="w-full bg-input border border-border rounded px-3 py-2 text-sm text-foreground"
                required
              />
              <p className="mt-1 text-[11px] text-muted-foreground">O sistema salva automaticamente com o prefixo OS-.</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Tipo</label>
              <select value={form.type} onChange={(event) => setForm((previous) => ({ ...previous, type: event.target.value as OSType }))} className="w-full bg-input border border-border rounded px-3 py-2 text-sm text-foreground">
                {OS_TYPES.map((type) => <option key={type}>{type}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Prioridade</label>
              <select value={form.priority} onChange={(event) => setForm((previous) => ({ ...previous, priority: event.target.value as OSPriority }))} className="w-full bg-input border border-border rounded px-3 py-2 text-sm text-foreground">
                {(["Baixa", "Média", "Alta", "Crítica"] as OSPriority[]).map((priority) => <option key={priority}>{priority}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Prazo de execução</label>
              <input
                type="date"
                value={form.dueDate}
                onChange={(event) => setForm((previous) => ({ ...previous, dueDate: event.target.value }))}
                className="w-full bg-input border border-border rounded px-3 py-2 text-sm text-foreground"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Equipamento</label>
              <select value={form.equipmentId} onChange={(event) => handleEquipmentChange(event.target.value)} className="w-full bg-input border border-border rounded px-3 py-2 text-sm text-foreground" required>
                <option value="">Selecione...</option>
                {equipments.map((equipment) => <option key={equipment.id} value={equipment.id}>{equipment.name} ({equipment.code})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Setor</label>
              <input value={form.sector} onChange={(event) => setForm((previous) => ({ ...previous, sector: event.target.value }))} className="w-full bg-input border border-border rounded px-3 py-2 text-sm text-foreground" required />
              <p className="mt-1 text-[11px] text-muted-foreground">Preenchido automaticamente pela localizacao do equipamento selecionado.</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Descrição</label>
            <textarea value={form.description} onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value }))} rows={3} className="w-full bg-input border border-border rounded px-3 py-2 text-sm text-foreground resize-none" required />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Técnicos Vinculados</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto border border-border rounded p-3">
              {workers.map((worker) => (
                <label key={worker.id} className="flex items-center gap-2 text-sm text-foreground">
                  <input type="checkbox" checked={form.workerIds.includes(worker.id)} onChange={() => toggleWorker(worker.id)} />
                  <span>{worker.name}</span>
                </label>
              ))}
            </div>
          </div>

          {order && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Status</label>
              <select value={form.status} onChange={(event) => setForm((previous) => ({ ...previous, status: event.target.value as OSStatus }))} className="w-full bg-input border border-border rounded px-3 py-2 text-sm text-foreground">
                {(["Aberta", "Em andamento", "Pausada", "Atrasada", "Finalizada"] as OSStatus[]).map((status) => <option key={status}>{status}</option>)}
              </select>
            </div>
          )}

          {(formError || error) && (
            <div className="text-xs text-red-500">{formError ?? error}</div>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded border border-border text-sm text-muted-foreground hover:bg-muted/30">Cancelar</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed">{order ? "Salvar" : "Criar OS"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function OrderDetailsModal({
  order,
  onSaved,
  onClose,
}: {
  order: ServiceOrder;
  onSaved: (orderId: string) => Promise<void>;
  onClose: () => void;
}) {
  const { state } = useApp();
  const currentUserName = state.currentUser?.name ?? "Sistema";
  const { equipments } = useEquipments();
  const { workers } = useWorkers();
  const { timeEntries } = useTimeEntries();
  const { changeStatus, setWorkers, addPart, removePart } = useServiceOrders();
  const [partForm, setPartForm] = useState({ name: "", quantity: 1 });

  const equipment = equipments.find((item) => item.id === order.equipmentId);
  const linkedWorkers = workers.filter((worker) => order.workerIds.includes(worker.id));
  const entries = timeEntries.filter((entry) => entry.osId === order.id);
  const totalHours = entries.reduce((accumulator, entry) => {
    const end = entry.endTime ? new Date(entry.endTime) : new Date();
    return accumulator + (end.getTime() - new Date(entry.startTime).getTime()) / 3600000;
  }, 0);
  const availableHoursPerDay = linkedWorkers.reduce(
    (accumulator, worker) => accumulator + worker.availableHoursPerDay,
    0
  );
  const partsCount = order.parts.reduce((accumulator, part) => accumulator + part.quantity, 0);

  async function handleAddPart(event: React.FormEvent) {
    event.preventDefault();
    const createdPart = await addPart(order.id, {
      name: partForm.name,
      quantity: partForm.quantity,
      unitCost: 0,
    });
    if (!createdPart) {
      return;
    }

    await onSaved(order.id);
    setPartForm({ name: "", quantity: 1 });
  }

  async function handleStatusChange(status: OSStatus) {
    const updatedOrder = await changeStatus(order.id, status, currentUserName);
    if (!updatedOrder) {
      return;
    }

    await onSaved(order.id);
  }

  async function toggleWorker(worker: Worker) {
    const nextIds = order.workerIds.includes(worker.id)
      ? order.workerIds.filter((id) => id !== worker.id)
      : [...order.workerIds, worker.id];
    const updatedOrder = await setWorkers(order.id, nextIds, currentUserName);
    if (!updatedOrder) {
      return;
    }

    await onSaved(order.id);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-lg w-full max-w-4xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        <div className="flex items-start justify-between px-4 sm:px-5 py-4 border-b border-border shrink-0 gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-foreground font-bold font-mono">{order.number}</span>
              <Badge className={getOSTypeColor(order.type)}>{order.type}</Badge>
              <Badge className={getOSPriorityColor(order.priority)}>{order.priority}</Badge>
              <Badge className={getOSStatusColor(order.status)}>{order.status}</Badge>
              {order.dueDate && (
                <Badge className={isServiceOrderOverdue(order.dueDate, order.status) ? "text-status-danger bg-status-danger/10 border-status-danger/30" : "text-status-info bg-status-info/10 border-status-info/30"}>
                  Prazo {formatDate(order.dueDate)}
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground text-xs mt-1">{order.description}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground ml-3"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex items-center gap-2 px-4 sm:px-5 py-3 border-b border-border shrink-0 flex-wrap">
          {(["Aberta", "Em andamento", "Pausada", "Atrasada", "Finalizada"] as OSStatus[]).map((status) => (
            <button key={status} onClick={() => void handleStatusChange(status)} className={`px-3 py-1.5 rounded text-xs border ${order.status === status ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
              {status}
            </button>
          ))}
          <div className="w-full sm:w-auto sm:ml-auto flex flex-wrap items-center gap-3 text-xs">
            <span className="text-muted-foreground">Total: <span className="text-foreground font-semibold">{formatHours(totalHours)}</span></span>
            <span className="text-muted-foreground">Disponível/dia: <span className="text-foreground font-semibold">{formatHours(availableHoursPerDay)}</span></span>
            <span className="text-muted-foreground">Peças: <span className="text-foreground font-semibold">{partsCount}</span></span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6">
          {order.dueDate && isServiceOrderOverdue(order.dueDate, order.status) && order.status !== "Finalizada" && (
            <div className="rounded-lg border border-status-danger/30 bg-status-danger/10 px-4 py-3 text-sm text-status-danger">
              Esta OS está em atraso desde {formatDate(order.dueDate)}. Priorize a execução e a conclusão.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs">Equipamento</p>
              <p className="text-foreground text-sm font-medium">{equipment?.name ?? "—"} <span className="text-muted-foreground font-mono text-xs">({equipment?.code ?? "—"})</span></p>
              <p className="text-muted-foreground text-xs">Setor</p>
              <p className="text-foreground text-sm font-medium">{order.sector}</p>
              <p className="text-muted-foreground text-xs">Prazo de execução</p>
              <p className={`text-sm font-medium ${order.dueDate && isServiceOrderOverdue(order.dueDate, order.status) ? "text-status-danger" : "text-foreground"}`}>{order.dueDate ? formatDate(order.dueDate) : "—"}</p>
              <p className="text-muted-foreground text-xs">Abertura</p>
              <p className="text-foreground text-sm font-medium">{formatDateTime(order.openedAt)}</p>
            </div>

            <div>
              <p className="text-muted-foreground text-xs mb-2 flex items-center gap-1"><Users className="w-3 h-3" /> Técnicos Vinculados</p>
              <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto border border-border rounded p-3">
                {workers.map((worker) => (
                  <label key={worker.id} className="flex items-center gap-2 text-sm text-foreground">
                    <input type="checkbox" checked={order.workerIds.includes(worker.id)} onChange={() => void toggleWorker(worker)} />
                    <span>{worker.name}</span>
                  </label>
                ))}
              </div>
              {linkedWorkers.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {linkedWorkers.map((worker) => (
                    <span key={worker.id} className="flex items-center gap-1.5 px-2 py-1 bg-muted/40 rounded text-xs text-foreground">
                      {worker.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <p className="text-foreground font-semibold text-sm mb-3">Apontamentos</p>
              <div className="space-y-2">
                {entries.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Nenhum apontamento registrado.</p>
                ) : (
                  entries.map((entry) => {
                    const worker = workers.find((item) => item.id === entry.workerId);
                    const end = entry.endTime ? new Date(entry.endTime) : new Date();
                    const hours = (end.getTime() - new Date(entry.startTime).getTime()) / 3600000;
                    return (
                      <div key={entry.id} className="p-3 bg-muted/20 rounded border border-border/50 text-xs">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-foreground font-medium">{worker?.name ?? "—"}</span>
                          <span className="text-primary">{entry.activityType}</span>
                        </div>
                        <div className="mt-1 text-muted-foreground">
                          {formatDateTime(entry.startTime)} {entry.endTime ? `até ${formatDateTime(entry.endTime)}` : "• em andamento"}
                        </div>
                        <div className="mt-1 text-foreground font-semibold">{formatHours(hours)}</div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-foreground font-semibold text-sm">Peças</p>
                <span className="text-xs text-foreground font-semibold">{partsCount} item(ns)</span>
              </div>
              <form onSubmit={handleAddPart} className="grid grid-cols-1 sm:grid-cols-12 gap-2 mb-3">
                <input value={partForm.name} onChange={(event) => setPartForm((previous) => ({ ...previous, name: event.target.value }))} placeholder="Peça" className="sm:col-span-8 bg-input border border-border rounded px-3 py-2 text-sm text-foreground" required />
                <input type="number" min={1} value={partForm.quantity} onChange={(event) => setPartForm((previous) => ({ ...previous, quantity: Number(event.target.value) }))} className="sm:col-span-2 bg-input border border-border rounded px-3 py-2 text-sm text-foreground" required />
                <button type="submit" className="sm:col-span-2 rounded bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 min-h-10">Add</button>
              </form>
              <div className="space-y-2">
                {order.parts.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Nenhuma peça registrada.</p>
                ) : (
                  order.parts.map((part) => (
                    <div key={part.id} className="flex items-center gap-3 p-3 bg-muted/20 rounded border border-border/50 text-xs">
                      <Package className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div className="flex-1">
                        <p className="text-foreground font-medium">{part.name}</p>
                        <p className="text-muted-foreground">Quantidade: {part.quantity}</p>
                      </div>
                      <button onClick={async () => {
                        const removedPart = await removePart(part.id);
                        if (!removedPart) {
                          return;
                        }

                        await onSaved(order.id);
                      }} className="text-muted-foreground hover:text-destructive"><X className="w-4 h-4" /></button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div>
            <p className="text-foreground font-semibold text-sm mb-3">Histórico</p>
            <div className="space-y-2">
              {order.history.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nenhum histórico registrado.</p>
              ) : (
                order.history.map((item) => (
                  <div key={item.id} className="p-3 bg-muted/20 rounded border border-border/50 text-xs">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-foreground font-medium">{item.field}</span>
                      <span className="text-muted-foreground">{formatDateTime(item.timestamp)}</span>
                    </div>
                    <div className="mt-1 text-muted-foreground">{item.oldValue || "—"} → {item.newValue || "—"}</div>
                    <div className="mt-1 text-primary">por {item.changedBy}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function OSListView() {
  const { state } = useApp();
  const { serviceOrders, remove, getAll, loading, error } = useServiceOrders();
  const { equipments } = useEquipments();
  const { workers } = useWorkers();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<OSStatus | "Todas">("Todas");
  const [filterType, setFilterType] = useState<OSType | "Todos">("Todos");
  const [filterPriority, setFilterPriority] = useState<OSPriority | "Todas">("Todas");
  const [showForm, setShowForm] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<ServiceOrder | null>(null);
  const [editingOrder, setEditingOrder] = useState<ServiceOrder | undefined>();

  const userRole = state.currentUser?.role;
  const linkedWorkerId = resolveCurrentUserWorkerId(state.currentUser, workers);
  const canCreate = hasPermission(userRole, "os:create");
  const canEdit = hasPermission(userRole, "os:edit");
  const canDelete = hasPermission(userRole, "os:delete");
  const canViewAll = hasPermission(userRole, "os:view");

  const baseOrders = canViewAll
    ? serviceOrders
    : serviceOrders.filter((order) => linkedWorkerId && order.workerIds.includes(linkedWorkerId));

  const overdueCount = baseOrders.filter(
    (order) => order.dueDate && isServiceOrderOverdue(order.dueDate, order.status)
  ).length;

  async function handleDeleteOrder(orderId: string) {
    const removed = await remove(orderId);
    if (!removed) {
      return;
    }

    if (selectedOrder?.id === orderId) {
      setSelectedOrder(null);
    }
  }

  const filtered = useMemo(() => {
    return baseOrders
      .filter((order) => {
        const equipment = equipments.find((item) => item.id === order.equipmentId);
        const matchSearch =
          search === "" ||
          order.number.toLowerCase().includes(search.toLowerCase()) ||
          order.description.toLowerCase().includes(search.toLowerCase()) ||
          (equipment?.name ?? "").toLowerCase().includes(search.toLowerCase());
        const matchStatus = filterStatus === "Todas" || order.status === filterStatus;
        const matchType = filterType === "Todos" || order.type === filterType;
        const matchPriority = filterPriority === "Todas" || order.priority === filterPriority;
        return matchSearch && matchStatus && matchType && matchPriority;
      })
      .sort((left, right) => new Date(right.openedAt).getTime() - new Date(left.openedAt).getTime());
  }, [baseOrders, equipments, filterPriority, filterStatus, filterType, search]);

  async function refreshSelectedOrder(orderId: string) {
    const refreshedOrders = await getAll();
    const refreshedOrder = refreshedOrders.find((order) => order.id === orderId) ?? null;
    setSelectedOrder(refreshedOrder);
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="relative flex-1 min-w-0 lg:min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar OS, descrição ou equipamento..." className="w-full bg-input border border-border rounded pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full lg:w-auto lg:min-w-[30rem]">
          <select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value as OSStatus | "Todas")} className="bg-input border border-border rounded px-3 py-2 text-sm text-foreground w-full">
            <option>Todas</option>
            {(["Aberta", "Em andamento", "Pausada", "Atrasada", "Finalizada"] as OSStatus[]).map((status) => <option key={status}>{status}</option>)}
          </select>
          <select value={filterType} onChange={(event) => setFilterType(event.target.value as OSType | "Todos")} className="bg-input border border-border rounded px-3 py-2 text-sm text-foreground w-full">
            <option>Todos</option>
            {OS_TYPES.map((type) => <option key={type}>{type}</option>)}
          </select>
          <select value={filterPriority} onChange={(event) => setFilterPriority(event.target.value as OSPriority | "Todas")} className="bg-input border border-border rounded px-3 py-2 text-sm text-foreground w-full">
            <option>Todas</option>
            {(["Baixa", "Média", "Alta", "Crítica"] as OSPriority[]).map((priority) => <option key={priority}>{priority}</option>)}
          </select>
        </div>
        {canCreate && (
          <button onClick={() => { setEditingOrder(undefined); setShowForm(true); }} className="flex w-full lg:w-auto items-center justify-center gap-2 px-4 py-2 rounded bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
            <Plus className="w-4 h-4" /> Nova Ordem
          </button>
        )}
      </div>

      {!canViewAll && !linkedWorkerId && (
        <div className="rounded-lg border border-status-warning/30 bg-status-warning/10 px-4 py-3 text-sm text-status-warning">
          Seu usuário não está vinculado a um manutentor válido. Vincule o usuário ao cadastro do manutentor para visualizar suas OS, inclusive para o perfil Operador.
        </div>
      )}

      {overdueCount > 0 && (
        <div className="rounded-lg border border-status-danger/30 bg-status-danger/10 px-4 py-3 text-sm text-status-danger">
          {overdueCount} OS com prazo vencido aguardando ação. O sistema marca essas ordens automaticamente como Atrasada.
        </div>
      )}

      <div className="bg-card border border-border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium">OS</th>
              <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Equipamento</th>
              <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Tipo</th>
              <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Prioridade</th>
              <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Prazo</th>
              <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Status</th>
              <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Setor</th>
              <th className="text-right px-4 py-3 text-xs text-muted-foreground font-medium">Aberta</th>
              <th className="text-right px-5 py-3 text-xs text-muted-foreground font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((order) => {
              const equipment = equipments.find((item) => item.id === order.equipmentId);
              const isOverdue = order.dueDate ? isServiceOrderOverdue(order.dueDate, order.status) : false;
              return (
                <tr key={order.id} className={`border-b border-border/40 hover:bg-muted/20 ${isOverdue ? "bg-status-danger/5" : ""}`}>
                  <td className="px-5 py-3">
                    <div className="text-primary font-mono text-xs">{order.number}</div>
                    <div className="text-muted-foreground text-xs max-w-[260px] truncate">{order.description}</div>
                  </td>
                  <td className="px-4 py-3 text-foreground/80 text-xs">{equipment?.name ?? "—"}</td>
                  <td className="px-4 py-3"><Badge className={getOSTypeColor(order.type)}>{order.type}</Badge></td>
                  <td className="px-4 py-3"><Badge className={getOSPriorityColor(order.priority)}>{order.priority}</Badge></td>
                  <td className={`px-4 py-3 text-xs whitespace-nowrap ${isOverdue ? "text-status-danger font-semibold" : "text-foreground/80"}`}>{order.dueDate ? formatDate(order.dueDate) : "—"}</td>
                  <td className="px-4 py-3"><Badge className={getOSStatusColor(order.status)}>{order.status}</Badge></td>
                  <td className="px-4 py-3 text-foreground/80 text-xs">{order.sector}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground text-xs whitespace-nowrap">{timeAgo(order.openedAt)}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setSelectedOrder(order)} className="p-1.5 text-muted-foreground hover:text-foreground"><Eye className="w-4 h-4" /></button>
                      {canEdit && (
                        <button onClick={() => { setEditingOrder(order); setShowForm(true); }} className="p-1.5 text-muted-foreground hover:text-foreground"><Pencil className="w-4 h-4" /></button>
                      )}
                      {canDelete && (
                        <button onClick={() => { if (confirm(`Excluir ${order.number}?`)) { void handleDeleteOrder(order.id); } }} className="p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-5 py-10 text-center text-muted-foreground text-sm">Nenhuma ordem encontrada.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <OrderFormModal
          order={editingOrder}
          onSaved={getAll}
          onClose={() => {
            setShowForm(false);
            setEditingOrder(undefined);
          }}
        />
      )}
      {selectedOrder && (
        <OrderDetailsModal
          order={selectedOrder}
          onSaved={refreshSelectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}
      {error && <div className="text-sm text-destructive">{error}</div>}
    </div>
  );
}