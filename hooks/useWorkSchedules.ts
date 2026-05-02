import { useCallback, useEffect, useState } from "react";
import {
  mapWorkScheduleCycleOverrideRow,
  mapWorkScheduleDayOverrideRow,
  mapWorkScheduleRow,
  toWorkScheduleCycleOverrideInsert,
  toWorkScheduleDayOverrideInsert,
  toWorkScheduleInsert,
} from "@/lib/supabase-mappers";
import { fromPublicTable, supabase } from "@/lib/supabaseClient";
import type {
  WorkSchedule,
  WorkScheduleCycleOverride,
  WorkScheduleCycleOverrideRow,
  WorkScheduleDayOverride,
  WorkScheduleDayOverrideRow,
  WorkScheduleInput,
  WorkScheduleRow,
  ScheduleDayStatus,
} from "@/lib/types";

const DAY_OVERRIDE_SELECT = "*";
const DAY_OVERRIDE_SELECT_FALLBACK = "id, schedule_id, schedule_date, day_status, created_at, updated_at";

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Não foi possível concluir a operação.";
}

function isMissingOvertimeColumnError(error: { message?: string | null } | null | undefined) {
  return Boolean(error?.message?.includes("is_overtime"));
}

function normalizeDayOverrideRows(rows: WorkScheduleDayOverrideRow[]) {
  return rows.map((row) =>
    mapWorkScheduleDayOverrideRow({
      ...row,
      is_overtime: row.is_overtime ?? false,
    })
  );
}

export function useWorkSchedules() {
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [overrides, setOverrides] = useState<WorkScheduleDayOverride[]>([]);
  const [cycleOverrides, setCycleOverrides] = useState<WorkScheduleCycleOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [schedulesResponse, rawOverridesResponse, cycleOverridesResponse] = await Promise.all([
        fromPublicTable("worker_schedules").select("*").order("worker_name", { ascending: true }),
        fromPublicTable("worker_schedule_day_overrides")
          .select(DAY_OVERRIDE_SELECT)
          .order("schedule_date", { ascending: true }),
        fromPublicTable("worker_schedule_cycle_overrides")
          .select("*")
          .order("cycle_position", { ascending: true }),
      ]);

      const overridesResponse =
        isMissingOvertimeColumnError(rawOverridesResponse.error)
          ? await fromPublicTable("worker_schedule_day_overrides")
              .select(DAY_OVERRIDE_SELECT_FALLBACK)
              .order("schedule_date", { ascending: true })
          : rawOverridesResponse;

      if (schedulesResponse.error) {
        setError(schedulesResponse.error.message);
        setLoading(false);
        return { schedules: [], overrides: [], cycleOverrides: [] };
      }

      if (overridesResponse.error) {
        setError(overridesResponse.error.message);
        setLoading(false);
        return { schedules: [], overrides: [], cycleOverrides: [] };
      }

      if (cycleOverridesResponse.error) {
        setError(cycleOverridesResponse.error.message);
        setLoading(false);
        return { schedules: [], overrides: [], cycleOverrides: [] };
      }

      const nextSchedules = ((schedulesResponse.data ?? []) as unknown as WorkScheduleRow[]).map(
        mapWorkScheduleRow
      );
      const nextOverrides = normalizeDayOverrideRows(
        (overridesResponse.data ?? []) as unknown as WorkScheduleDayOverrideRow[]
      );
      const nextCycleOverrides = ((cycleOverridesResponse.data ?? []) as unknown as WorkScheduleCycleOverrideRow[]).map(
        mapWorkScheduleCycleOverrideRow
      );

      setSchedules(nextSchedules);
      setOverrides(nextOverrides);
      setCycleOverrides(nextCycleOverrides);
      setLoading(false);
      return { schedules: nextSchedules, overrides: nextOverrides, cycleOverrides: nextCycleOverrides };
    } catch (error) {
      setError(getErrorMessage(error));
      setLoading(false);
      return { schedules: [], overrides: [], cycleOverrides: [] };
    }
  }, []);

  const upsertSchedule = useCallback(
    async (
      input: WorkScheduleInput,
      options?: { scheduleId?: string; previousRegistration?: string }
    ) => {
      setLoading(true);
      setError(null);

      try {
        const payload = toWorkScheduleInsert(input);

        const mutation = options?.scheduleId
          ? fromPublicTable("worker_schedules").update(payload).eq("id", options.scheduleId)
          : options?.previousRegistration
          ? fromPublicTable("worker_schedules")
              .update(payload)
              .eq("registration", options.previousRegistration)
          : fromPublicTable("worker_schedules").upsert(payload, { onConflict: "registration" });

        const { data, error: mutationError } = await mutation.select("*").single();

        if (mutationError) {
          setError(mutationError.message);
          setLoading(false);
          return null;
        }

        await getAll();
        return mapWorkScheduleRow(data as unknown as WorkScheduleRow);
      } catch (error) {
        setError(getErrorMessage(error));
        setLoading(false);
        return null;
      }
    },
    [getAll]
  );

  const removeSchedule = useCallback(
    async ({ scheduleId, registration }: { scheduleId?: string; registration?: string }) => {
      if (!scheduleId && !registration) {
        return false;
      }

      setLoading(true);
      setError(null);

      try {
        const request = fromPublicTable("worker_schedules").delete();
        const filteredRequest = scheduleId
          ? request.eq("id", scheduleId)
          : request.eq("registration", registration as string);

        const { error: mutationError } = await filteredRequest;

        if (mutationError) {
          setError(mutationError.message);
          setLoading(false);
          return false;
        }

        await getAll();
        return true;
      } catch (error) {
        setError(getErrorMessage(error));
        setLoading(false);
        return false;
      }
    },
    [getAll]
  );

  const saveOverride = useCallback(
    async (
      scheduleId: string,
      scheduleDate: string,
      dayStatus: ScheduleDayStatus,
      options?: { isOvertime?: boolean }
    ) => {
      setLoading(true);
      setError(null);

      try {
        const mutationPayload = toWorkScheduleDayOverrideInsert({
          scheduleId,
          scheduleDate,
          dayStatus,
          isOvertime: options?.isOvertime,
        });

        let { data, error: mutationError } = await fromPublicTable("worker_schedule_day_overrides")
          .upsert(mutationPayload, {
            onConflict: "schedule_id,schedule_date",
          })
          .select(DAY_OVERRIDE_SELECT)
          .single();

        if (isMissingOvertimeColumnError(mutationError)) {
          const { is_overtime: _ignoredOvertime, ...fallbackPayload } = mutationPayload;
          const fallbackResponse = await fromPublicTable("worker_schedule_day_overrides")
            .upsert(fallbackPayload, {
              onConflict: "schedule_id,schedule_date",
            })
            .select(DAY_OVERRIDE_SELECT_FALLBACK)
            .single();

          data = fallbackResponse.data;
          mutationError = fallbackResponse.error;
        }

        if (mutationError) {
          setError(mutationError.message);
          setLoading(false);
          return null;
        }

        await getAll();
        return normalizeDayOverrideRows([data as unknown as WorkScheduleDayOverrideRow])[0] ?? null;
      } catch (error) {
        setError(getErrorMessage(error));
        setLoading(false);
        return null;
      }
    },
    [getAll]
  );

  const saveCycleOverride = useCallback(
    async (scheduleId: string, cyclePosition: number, dayStatus: ScheduleDayStatus) => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: mutationError } = await fromPublicTable("worker_schedule_cycle_overrides")
          .upsert(toWorkScheduleCycleOverrideInsert({ scheduleId, cyclePosition, dayStatus }), {
            onConflict: "schedule_id,cycle_position",
          })
          .select("*")
          .single();

        if (mutationError) {
          setError(mutationError.message);
          setLoading(false);
          return null;
        }

        await getAll();
        return mapWorkScheduleCycleOverrideRow(data as unknown as WorkScheduleCycleOverrideRow);
      } catch (error) {
        setError(getErrorMessage(error));
        setLoading(false);
        return null;
      }
    },
    [getAll]
  );

  const removeOverride = useCallback(
    async (scheduleId: string, scheduleDate: string) => {
      setLoading(true);
      setError(null);

      try {
        const { error: mutationError } = await fromPublicTable("worker_schedule_day_overrides")
          .delete()
          .eq("schedule_id", scheduleId)
          .eq("schedule_date", scheduleDate);

        if (mutationError) {
          setError(mutationError.message);
          setLoading(false);
          return false;
        }

        await getAll();
        return true;
      } catch (error) {
        setError(getErrorMessage(error));
        setLoading(false);
        return false;
      }
    },
    [getAll]
  );

  const removeCycleOverride = useCallback(
    async (scheduleId: string, cyclePosition: number) => {
      setLoading(true);
      setError(null);

      try {
        const { error: mutationError } = await fromPublicTable("worker_schedule_cycle_overrides")
          .delete()
          .eq("schedule_id", scheduleId)
          .eq("cycle_position", cyclePosition);

        if (mutationError) {
          setError(mutationError.message);
          setLoading(false);
          return false;
        }

        await getAll();
        return true;
      } catch (error) {
        setError(getErrorMessage(error));
        setLoading(false);
        return false;
      }
    },
    [getAll]
  );

  const removeCycleOverrides = useCallback(
    async (scheduleId: string, cyclePositions: number[]) => {
      if (cyclePositions.length === 0) {
        return true;
      }

      setLoading(true);
      setError(null);

      try {
        const { error: mutationError } = await fromPublicTable("worker_schedule_cycle_overrides")
          .delete()
          .eq("schedule_id", scheduleId)
          .in("cycle_position", cyclePositions);

        if (mutationError) {
          setError(mutationError.message);
          setLoading(false);
          return false;
        }

        await getAll();
        return true;
      } catch (error) {
        setError(getErrorMessage(error));
        setLoading(false);
        return false;
      }
    },
    [getAll]
  );

  const removeMonthOverrides = useCallback(
    async (scheduleId: string, monthStart: string, monthEnd: string) => {
      setLoading(true);
      setError(null);

      try {
        const { error: mutationError } = await fromPublicTable("worker_schedule_day_overrides")
          .delete()
          .eq("schedule_id", scheduleId)
          .gte("schedule_date", monthStart)
          .lte("schedule_date", monthEnd);

        if (mutationError) {
          setError(mutationError.message);
          setLoading(false);
          return false;
        }

        await getAll();
        return true;
      } catch (error) {
        setError(getErrorMessage(error));
        setLoading(false);
        return false;
      }
    },
    [getAll]
  );

  useEffect(() => {
    void getAll();
  }, [getAll]);

  useEffect(() => {
    const channel = supabase
      .channel(`work-schedules-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "worker_schedules" }, () => {
        void getAll();
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "worker_schedule_day_overrides" },
        () => {
          void getAll();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "worker_schedule_cycle_overrides" },
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
    schedules,
    overrides,
    cycleOverrides,
    loading,
    error,
    getAll,
    upsertSchedule,
    removeSchedule,
    saveOverride,
    saveCycleOverride,
    removeOverride,
    removeCycleOverride,
    removeCycleOverrides,
    removeMonthOverrides,
  };
}