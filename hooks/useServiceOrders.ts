import { useCallback, useEffect, useState } from "react";
import { getFriendlyMutationError } from "../lib/supabase-errors";
import { isServiceOrderOverdue } from "../lib/format";
import { mapServiceOrderRecord, normalizeServiceOrderNumber, toServiceOrderInsert } from "../lib/supabase-mappers";
import { fromPublicTable, supabase } from "../lib/supabaseClient";
import { recordAuditLog } from "../lib/audit";
import type {
  OSStatus,
  Part,
  ServiceOrder,
  ServiceOrderHistoryRow,
  ServiceOrderInput,
  ServiceOrderPartRow,
  ServiceOrderRow,
  ServiceOrderWorkerRow,
  TimeEntryRow,
} from "../lib/types";

async function fetchOrdersBundle() {
  const [ordersResult, assignmentsResult, partsResult, historyResult, timeEntriesResult] =
    await Promise.all([
      fromPublicTable("service_orders").select("*").order("created_at", { ascending: false }),
      fromPublicTable("service_order_workers").select("*"),
      fromPublicTable("service_order_parts").select("*").order("created_at", { ascending: true }),
      fromPublicTable("service_order_history")
        .select("*")
        .order("timestamp", { ascending: false }),
      fromPublicTable("time_entries").select("*"),
    ]);

  const firstError =
    ordersResult.error ??
    assignmentsResult.error ??
    partsResult.error ??
    historyResult.error ??
    timeEntriesResult.error;

  if (firstError) {
    throw firstError;
  }

  return {
    orders: (ordersResult.data ?? []) as unknown as ServiceOrderRow[],
    assignments: (assignmentsResult.data ?? []) as unknown as ServiceOrderWorkerRow[],
    parts: (partsResult.data ?? []) as unknown as ServiceOrderPartRow[],
    history: (historyResult.data ?? []) as unknown as ServiceOrderHistoryRow[],
    timeEntries: (timeEntriesResult.data ?? []) as unknown as TimeEntryRow[],
  };
}

function buildOrders(bundle: Awaited<ReturnType<typeof fetchOrdersBundle>>) {
  return bundle.orders.map((row) =>
    mapServiceOrderRecord({
      row,
      assignments: bundle.assignments.filter(
        (assignment) => assignment.service_order_id === row.id
      ),
      parts: bundle.parts.filter((part) => part.service_order_id === row.id),
      history: bundle.history.filter((item) => item.service_order_id === row.id),
      timeEntries: bundle.timeEntries.filter(
        (entry) => entry.service_order_id === row.id
      ),
    })
  );
}

async function syncOverdueOrders(bundle: Awaited<ReturnType<typeof fetchOrdersBundle>>) {
  const overdueOrders = bundle.orders.filter(
    (order) =>
      order.status !== "Finalizada" &&
      order.status !== "Atrasada" &&
      isServiceOrderOverdue(order.due_date ?? undefined, order.status)
  );

  if (overdueOrders.length === 0) {
    return bundle;
  }

  const overdueIds = overdueOrders.map((order) => order.id);
  const { error } = await fromPublicTable("service_orders")
    .update({ status: "Atrasada" })
    .in("id", overdueIds);

  if (error) {
    throw error;
  }

  await Promise.all(
    overdueOrders.map((order) =>
      recordHistory(order.id, "status", order.status, "Atrasada", "Sistema")
    )
  );

  return fetchOrdersBundle();
}

async function recordHistory(
  serviceOrderId: string,
  field: string,
  oldValue: string,
  newValue: string,
  changedBy: string
) {
  await fromPublicTable("service_order_history").insert({
    service_order_id: serviceOrderId,
    field,
    old_value: oldValue,
    new_value: newValue,
    changed_by: changedBy,
    timestamp: new Date().toISOString(),
  });
}

export function useServiceOrders() {
  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const bundle = await syncOverdueOrders(await fetchOrdersBundle());
      const mapped = buildOrders(bundle);
      setServiceOrders(mapped);
      setLoading(false);
      return mapped;
    } catch (queryError) {
      setError(queryError instanceof Error ? queryError.message : "Erro ao carregar OS.");
      setLoading(false);
      return [];
    }
  }, []);

  const getById = useCallback(
    async (id: string) => {
      const current = serviceOrders.find((order) => order.id === id);
      if (current) return current;
      const orders = await getAll();
      return orders.find((order) => order.id === id) ?? null;
    },
    [getAll, serviceOrders]
  );

  const create = useCallback(
    async (order: ServiceOrderInput, changedBy = "Sistema") => {
      setLoading(true);
      setError(null);

      const { data, error: mutationError } = await fromPublicTable("service_orders")
        .insert(toServiceOrderInsert(order))
        .select("*")
        .single();

      if (mutationError) {
        setError(
          getFriendlyMutationError(mutationError, {
            uniqueFields: {
              number: (value) =>
                value
                  ? `Já existe uma OS com o número ${value}.`
                  : "Já existe uma OS com esse número.",
            },
            foreignKeyMessage:
              "Não foi possível salvar a OS porque o equipamento ou os manutentores vinculados não são mais válidos.",
            checkConstraintMessage:
              "Não foi possível salvar a OS porque o banco ainda não aceita um dos tipos configurados. Atualize o schema de service_orders para incluir Opa e Guemba.",
            defaultMessage: "Não foi possível criar a OS.",
          })
        );
        setLoading(false);
        return null;
      }

      const createdOrder = data as unknown as ServiceOrderRow;

      const workerIds = Array.from(
        new Set([order.assignedTo, ...(order.workerIds ?? [])].filter(Boolean))
      ) as string[];

      if (workerIds.length > 0) {
        await fromPublicTable("service_order_workers").insert(
          workerIds.map((workerId) => ({
            service_order_id: createdOrder.id,
            worker_id: workerId,
          }))
        );
      }

      await recordHistory(createdOrder.id, "created", "", "Ordem criada", changedBy);
      await recordHistory(createdOrder.id, "status", "", order.status, changedBy);

      await recordAuditLog({
        resource: "service_orders",
        resourceId: createdOrder.id,
        action: "created",
        category: "operational",
        userName: changedBy,
        details: `OS ${createdOrder.number} criada com status ${order.status}.`,
        timestamp: new Date().toISOString(),
        metadata: {
          equipmentId: order.equipmentId,
          sector: order.sector,
          assignedTo: workerIds.join(", "),
          priority: order.priority,
        },
      });

      await getAll();
      return createdOrder.id;
    },
    [getAll]
  );

  const update = useCallback(
    async (
      id: string,
      updates: Partial<ServiceOrderInput> & { workerIds?: string[] },
      changedBy = "Sistema"
    ) => {
      setLoading(true);
      setError(null);

      const current = await getById(id);
      if (!current) {
        setLoading(false);
        return null;
      }

      const { data, error: mutationError } = await fromPublicTable("service_orders")
        .update({
          number: updates.number ? normalizeServiceOrderNumber(updates.number) : updates.number,
          type: updates.type,
          priority: updates.priority,
          status: updates.status,
          due_date: updates.dueDate === undefined ? undefined : updates.dueDate ?? null,
          description: updates.description,
          equipment_id: updates.equipmentId,
          assigned_to: updates.assignedTo,
          sector: updates.sector,
          started_at: updates.startedAt,
          finished_at: updates.finishedAt,
        })
        .eq("id", id)
        .select("*")
        .single();

      if (mutationError) {
        setError(
          getFriendlyMutationError(mutationError, {
            uniqueFields: {
              number: (value) =>
                value
                  ? `Já existe uma OS com o número ${value}.`
                  : "Já existe uma OS com esse número.",
            },
            foreignKeyMessage:
              "Não foi possível atualizar a OS porque o equipamento ou os manutentores vinculados não são mais válidos.",
            checkConstraintMessage:
              "Não foi possível atualizar a OS porque o banco ainda não aceita um dos tipos configurados. Atualize o schema de service_orders para incluir Opa e Guemba.",
            defaultMessage: "Não foi possível atualizar a OS.",
          })
        );
        setLoading(false);
        return null;
      }

      if (updates.workerIds) {
        await fromPublicTable("service_order_workers").delete().eq("service_order_id", id);
        if (updates.workerIds.length > 0) {
          await fromPublicTable("service_order_workers").insert(
            updates.workerIds.map((workerId) => ({
              service_order_id: id,
              worker_id: workerId,
            }))
          );
        }
      }

      const changeList = [
        { field: "number", oldValue: current.number, newValue: updates.number },
        { field: "type", oldValue: current.type, newValue: updates.type },
        { field: "priority", oldValue: current.priority, newValue: updates.priority },
        { field: "status", oldValue: current.status, newValue: updates.status },
        { field: "due_date", oldValue: current.dueDate ?? "", newValue: updates.dueDate ?? "" },
        { field: "description", oldValue: current.description, newValue: updates.description },
        { field: "equipment_id", oldValue: current.equipmentId, newValue: updates.equipmentId },
        { field: "assigned_to", oldValue: current.assignedTo ?? "", newValue: updates.assignedTo ?? "" },
        { field: "sector", oldValue: current.sector, newValue: updates.sector },
      ].filter(
        (change) =>
          change.newValue !== undefined &&
          String(change.newValue) !== String(change.oldValue)
      );

      await Promise.all(
        changeList.map((change) =>
          recordHistory(
            id,
            change.field,
            String(change.oldValue ?? ""),
            String(change.newValue ?? ""),
            changedBy
          )
        )
      );

      if (updates.workerIds) {
        const previousWorkers = current.workerIds.join(", ");
        const newWorkers = Array.from(new Set(updates.workerIds)).join(", ");
        if (previousWorkers !== newWorkers) {
          await recordHistory(id, "assigned_to", previousWorkers, newWorkers, changedBy);
        }
      }

      if (changeList.length > 0) {
        await recordAuditLog({
          resource: "service_orders",
          resourceId: id,
          action: "updated",
          category: "operational",
          userName: changedBy,
          details: `OS ${current.number} atualizada (${changeList
            .map((change) => change.field)
            .join(", ")}).`,
          timestamp: new Date().toISOString(),
          metadata: {
            changes: changeList,
          },
        });
      }

      await getAll();
      return (data as unknown as ServiceOrderRow).id;
    },
    [getAll, getById]
  );

  const remove = useCallback(
    async (id: string, removedBy = "Sistema") => {
      setLoading(true);
      setError(null);

      await recordAuditLog({
        resource: "service_orders",
        resourceId: id,
        action: "deleted",
        category: "operational",
        userName: removedBy,
        details: `OS ${id} removida do sistema.`,
        timestamp: new Date().toISOString(),
        metadata: {},
      });

      const { error: mutationError } = await fromPublicTable("service_orders")
        .delete()
        .eq("id", id);

      if (mutationError) {
        setError(mutationError.message);
        setLoading(false);
        return false;
      }

      await getAll();
      return true;
    },
    [getAll]
  );

  const changeStatus = useCallback(
    async (id: string, status: OSStatus, changedBy = "Sistema") => {
      const current = await getById(id);
      if (!current) return null;

      const now = new Date().toISOString();
      return update(
        id,
        {
          status,
          startedAt:
            status === "Em andamento"
              ? current.startedAt ?? now
              : current.startedAt,
          finishedAt: status === "Finalizada" ? now : current.finishedAt,
          assignedTo: current.assignedTo,
          workerIds: current.workerIds,
          sector: current.sector,
        },
        changedBy
      );
    },
    [getById, update]
  );

  const setWorkers = useCallback(
    async (id: string, workerIds: string[], changedBy = "Sistema") => {
      const current = await getById(id);
      if (!current) return null;
      const uniqueWorkerIds = Array.from(new Set(workerIds));
      await recordHistory(
        id,
        "assigned_to",
        current.workerIds.join(", "),
        uniqueWorkerIds.join(", "),
        changedBy
      );
      const result = await update(
        id,
        {
          assignedTo: uniqueWorkerIds[0],
          workerIds: uniqueWorkerIds,
          sector: current.sector,
        },
        changedBy
      );

      await recordAuditLog({
        resource: "service_orders",
        resourceId: id,
        action: "assigned_workers",
        category: "operational",
        userName: changedBy,
        details: `Técnicos atualizados: ${uniqueWorkerIds.join(", ")}.`,
        timestamp: new Date().toISOString(),
        metadata: { workerIds: uniqueWorkerIds },
      });

      return result;
    },
    [getById, update]
  );

  const addPart = useCallback(
    async (serviceOrderId: string, part: Omit<Part, "id">, changedBy = "Sistema") => {
      setLoading(true);
      setError(null);

      const { error: mutationError } = await fromPublicTable("service_order_parts").insert({
        service_order_id: serviceOrderId,
        name: part.name,
        quantity: part.quantity,
        unit_cost: part.unitCost,
      });

      if (mutationError) {
        setError(mutationError.message);
        setLoading(false);
        return false;
      }

      await recordHistory(serviceOrderId, "parts", "", `${part.quantity}x ${part.name}`, changedBy);
      await recordAuditLog({
        resource: "service_orders",
        resourceId: serviceOrderId,
        action: "part_added",
        category: "operational",
        userName: changedBy,
        details: `Peça adicionada: ${part.quantity}x ${part.name}.`,
        timestamp: new Date().toISOString(),
        metadata: {
          partName: part.name,
          quantity: part.quantity,
          unitCost: part.unitCost,
        },
      });

      await getAll();
      return true;
    },
    [getAll]
  );

  const removePart = useCallback(
    async (partId: string, removedBy = "Sistema") => {
      setLoading(true);
      setError(null);

      const orderWithPart = serviceOrders.find((order) => order.parts.some((part) => part.id === partId));
      const part = orderWithPart?.parts.find((part) => part.id === partId);

      const { error: mutationError } = await fromPublicTable("service_order_parts")
        .delete()
        .eq("id", partId);

      if (mutationError) {
        setError(mutationError.message);
        setLoading(false);
        return false;
      }

      if (orderWithPart && part) {
        await recordHistory(orderWithPart.id, "parts", `${part.quantity}x ${part.name}`, "", removedBy);
        await recordAuditLog({
          resource: "service_orders",
          resourceId: orderWithPart.id,
          action: "part_removed",
          category: "operational",
          userName: removedBy,
          details: `Peça removida: ${part.quantity}x ${part.name}.`,
          timestamp: new Date().toISOString(),
          metadata: {
            partName: part.name,
            quantity: part.quantity,
          },
        });
      }

      await getAll();
      return true;
    },
    [getAll, serviceOrders]
  );

  useEffect(() => {
    void getAll();
  }, [getAll]);

  useEffect(() => {
    const channel = supabase
      .channel(`service-orders-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "service_orders" },
        () => {
          void getAll();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "service_order_workers" },
        () => {
          void getAll();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "service_order_parts" },
        () => {
          void getAll();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "service_order_history" },
        () => {
          void getAll();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "time_entries" },
        () => {
          void getAll();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [getAll]);

  return {
    serviceOrders,
    loading,
    error,
    getAll,
    getById,
    create,
    update,
    remove,
    changeStatus,
    setWorkers,
    addPart,
    removePart,
  };
}
