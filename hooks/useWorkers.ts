import { useCallback, useEffect, useState } from "react";
import { getFriendlyMutationError } from "../lib/supabase-errors";
import { mapWorkerRow, toWorkerInsert, toWorkerUpdate, type WorkerAvailabilityColumn } from "../lib/supabase-mappers";
import { fromPublicTable, supabase } from "../lib/supabaseClient";
import type { Worker, WorkerInput, WorkerRow, WorkerStatus } from "../lib/types";

let workerAvailabilityColumnPromise: Promise<WorkerAvailabilityColumn> | null = null;

async function getWorkerAvailabilityColumn(): Promise<WorkerAvailabilityColumn> {
  if (!workerAvailabilityColumnPromise) {
    workerAvailabilityColumnPromise = (async () => {
      const { error } = await fromPublicTable("workers").select("available_hours_per_day").limit(1);
      return error ? "hourly_rate" : "available_hours_per_day";
    })();
  }

  return workerAvailabilityColumnPromise;
}

export function useWorkers() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: queryError } = await fromPublicTable("workers")
      .select("*")
      .order("name", { ascending: true });

    if (queryError) {
      setError(queryError.message);
      setLoading(false);
      return [];
    }

    const mapped = ((data ?? []) as unknown as WorkerRow[]).map(mapWorkerRow);
    setWorkers(mapped);
    setLoading(false);
    return mapped;
  }, []);

  const getById = useCallback(async (id: string) => {
    const { data, error: queryError } = await fromPublicTable("workers")
      .select("*")
      .eq("id", id)
      .single();

    if (queryError) {
      setError(queryError.message);
      return null;
    }

    return mapWorkerRow(data as unknown as WorkerRow);
  }, []);

  const create = useCallback(
    async (worker: WorkerInput) => {
      setLoading(true);
      setError(null);

      const availabilityColumn = await getWorkerAvailabilityColumn();

      const { data, error: mutationError } = await fromPublicTable("workers")
        .insert(toWorkerInsert(worker, availabilityColumn))
        .select("*")
        .single();

      if (mutationError) {
        setError(
          getFriendlyMutationError(mutationError, {
            uniqueFields: {
              registration: (value) =>
                value
                  ? `Já existe um manutentor com a matrícula ${value}.`
                  : "Já existe um manutentor com essa matrícula.",
            },
            defaultMessage: "Não foi possível cadastrar o manutentor.",
          })
        );
        setLoading(false);
        return null;
      }

      await getAll();
      return mapWorkerRow(data as unknown as WorkerRow);
    },
    [getAll]
  );

  const update = useCallback(
    async (id: string, updates: Partial<WorkerInput> & { status?: WorkerStatus }) => {
      setLoading(true);
      setError(null);

      const availabilityColumn = await getWorkerAvailabilityColumn();

      const { data, error: mutationError } = await fromPublicTable("workers")
        .update(toWorkerUpdate(updates, availabilityColumn))
        .eq("id", id)
        .select("*")
        .single();

      if (mutationError) {
        setError(
          getFriendlyMutationError(mutationError, {
            uniqueFields: {
              registration: (value) =>
                value
                  ? `Já existe um manutentor com a matrícula ${value}.`
                  : "Já existe um manutentor com essa matrícula.",
            },
            defaultMessage: "Não foi possível atualizar o manutentor.",
          })
        );
        setLoading(false);
        return null;
      }

      await getAll();
      return mapWorkerRow(data as unknown as WorkerRow);
    },
    [getAll]
  );

  const remove = useCallback(
    async (id: string) => {
      setLoading(true);
      setError(null);

      const { error: mutationError } = await fromPublicTable("workers")
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

  useEffect(() => {
    void getAll();
  }, [getAll]);

  useEffect(() => {
    const channel = supabase
      .channel(`workers-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "workers" },
        () => {
          void getAll();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [getAll]);

  return { workers, loading, error, getAll, getById, create, update, remove };
}
