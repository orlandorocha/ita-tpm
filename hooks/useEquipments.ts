import { useCallback, useEffect, useState } from "react";
import { getFriendlyMutationError } from "../lib/supabase-errors";
import { mapEquipmentRow, toEquipmentInsert } from "../lib/supabase-mappers";
import { fromPublicTable, supabase } from "../lib/supabaseClient";
import type { Equipment, EquipmentInput, EquipmentRow } from "../lib/types";

function getEquipmentDeleteErrorMessage(error: {
  code?: string | null;
  message: string;
  details?: string | null;
}) {
  if (error.code === "23503") {
    return "Nao e possivel excluir este equipamento porque ele esta vinculado a ordens de servico. Reatribua ou exclua as OS antes de tentar novamente.";
  }

  return error.message;
}

export function useEquipments() {
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: queryError } = await fromPublicTable("equipments")
      .select("*")
      .order("name", { ascending: true });

    if (queryError) {
      setError(queryError.message);
      setLoading(false);
      return [];
    }

    const mapped = ((data ?? []) as unknown as EquipmentRow[]).map(mapEquipmentRow);
    setEquipments(mapped);
    setLoading(false);
    return mapped;
  }, []);

  const getById = useCallback(async (id: string) => {
    const { data, error: queryError } = await fromPublicTable("equipments")
      .select("*")
      .eq("id", id)
      .single();

    if (queryError) {
      setError(queryError.message);
      return null;
    }

    return mapEquipmentRow(data as unknown as EquipmentRow);
  }, []);

  const create = useCallback(
    async (equipment: EquipmentInput) => {
      setLoading(true);
      setError(null);

      const { data, error: mutationError } = await fromPublicTable("equipments")
        .insert(toEquipmentInsert(equipment))
        .select("*")
        .single();

      if (mutationError) {
        setError(
          getFriendlyMutationError(mutationError, {
            uniqueFields: {
              code: (value) =>
                value
                  ? `Já existe um equipamento com o código ${value}.`
                  : "Já existe um equipamento com esse código.",
            },
            defaultMessage: "Não foi possível cadastrar o equipamento.",
          })
        );
        setLoading(false);
        return null;
      }

      await getAll();
      return mapEquipmentRow(data as unknown as EquipmentRow);
    },
    [getAll]
  );

  const update = useCallback(
    async (id: string, updates: Partial<EquipmentInput>) => {
      setLoading(true);
      setError(null);

      const { data, error: mutationError } = await fromPublicTable("equipments")
        .update({
          name: updates.name,
          code: updates.code,
          location: updates.location,
          production_line: updates.productionLine,
        })
        .eq("id", id)
        .select("*")
        .single();

      if (mutationError) {
        setError(
          getFriendlyMutationError(mutationError, {
            uniqueFields: {
              code: (value) =>
                value
                  ? `Já existe um equipamento com o código ${value}.`
                  : "Já existe um equipamento com esse código.",
            },
            defaultMessage: "Não foi possível atualizar o equipamento.",
          })
        );
        setLoading(false);
        return null;
      }

      await getAll();
      return mapEquipmentRow(data as unknown as EquipmentRow);
    },
    [getAll]
  );

  const remove = useCallback(
    async (id: string) => {
      setLoading(true);
      setError(null);

      const { count, error: dependencyError } = await fromPublicTable("service_orders")
        .select("id", { count: "exact", head: true })
        .eq("equipment_id", id);

      if (dependencyError) {
        setError(dependencyError.message);
        setLoading(false);
        return false;
      }

      if ((count ?? 0) > 0) {
        setError(
          `Nao e possivel excluir este equipamento porque existem ${count} ordem(ns) de servico vinculada(s) a ele.`
        );
        setLoading(false);
        return false;
      }

      const { error: mutationError } = await fromPublicTable("equipments")
        .delete()
        .eq("id", id);

      if (mutationError) {
        setError(getEquipmentDeleteErrorMessage(mutationError));
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
      .channel(`equipments-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "equipments" },
        () => {
          void getAll();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [getAll]);

  return { equipments, loading, error, getAll, getById, create, update, remove };
}
