import { useCallback, useEffect, useState } from "react";
import { mapTimeEntryRow, toTimeEntryInsert } from "../lib/supabase-mappers";
import { fromPublicTable, supabase } from "../lib/supabaseClient";
import type { TimeEntry, TimeEntryInput, TimeEntryRow } from "../lib/types";

function calculateDurationMinutes(startTime: string, endTime: string) {
  return Math.max(
    0,
    Math.round(
      (new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000
    )
  );
}

export function useTimeEntries() {
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: queryError } = await fromPublicTable("time_entries")
      .select("*")
      .order("start_time", { ascending: false });

    if (queryError) {
      setError(queryError.message);
      setLoading(false);
      return [];
    }

    const mapped = ((data ?? []) as unknown as TimeEntryRow[]).map(mapTimeEntryRow);
    setTimeEntries(mapped);
    setLoading(false);
    return mapped;
  }, []);

  const getById = useCallback(async (id: string) => {
    const { data, error: queryError } = await fromPublicTable("time_entries")
      .select("*")
      .eq("id", id)
      .single();

    if (queryError) {
      setError(queryError.message);
      return null;
    }

    return mapTimeEntryRow(data as unknown as TimeEntryRow);
  }, []);

  const create = useCallback(
    async (entry: TimeEntryInput) => {
      setLoading(true);
      setError(null);

      const payload = toTimeEntryInsert(entry);

      const { data, error: mutationError } = await fromPublicTable("time_entries")
        .insert(payload)
        .select("*")
        .single();

      if (mutationError) {
        setError(mutationError.message);
        setLoading(false);
        return null;
      }

      await getAll();
      return mapTimeEntryRow(data as unknown as TimeEntryRow);
    },
    [getAll]
  );

  const update = useCallback(
    async (id: string, updates: Partial<TimeEntryInput>) => {
      setLoading(true);
      setError(null);

      const rowUpdates: {
        activity_type?: TimeEntryInput["activityType"];
        start_time?: string;
        end_time?: string | null;
        notes?: string | null;
      } = {
        activity_type: updates.activityType,
        start_time: updates.startTime,
        end_time: updates.endTime ?? undefined,
        notes: updates.notes ?? undefined,
      };

      const { data, error: mutationError } = await fromPublicTable("time_entries")
        .update(rowUpdates)
        .eq("id", id)
        .select("*")
        .single();

      if (mutationError) {
        setError(mutationError.message);
        setLoading(false);
        return null;
      }

      await getAll();
      return mapTimeEntryRow(data as unknown as TimeEntryRow);
    },
    [getAll]
  );

  const remove = useCallback(
    async (id: string) => {
      setLoading(true);
      setError(null);

      const { error: mutationError } = await fromPublicTable("time_entries")
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

  const pause = useCallback(
    async (id: string) => {
      const current = timeEntries.find((entry) => entry.id === id);
      if (!current) return null;
      const endTime = new Date().toISOString();
      return update(id, {
        endTime,
      });
    },
    [timeEntries, update]
  );

  const finish = pause;

  useEffect(() => {
    void getAll();
  }, [getAll]);

  useEffect(() => {
    const channel = supabase
      .channel(`time-entries-${crypto.randomUUID()}`)
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

  return { timeEntries, loading, error, getAll, getById, create, update, remove, pause, finish };
}
