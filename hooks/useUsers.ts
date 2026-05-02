import { useCallback, useEffect, useState } from "react";
import { getFriendlyMutationError } from "../lib/supabase-errors";
import { mapUserRow, toUserInsert } from "../lib/supabase-mappers";
import { fromPublicTable, supabase } from "../lib/supabaseClient";
import type { User, UserInput, UserRole, UserRow } from "../lib/types";

export function useUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: queryError } = await fromPublicTable("users")
      .select("*")
      .order("name", { ascending: true });

    if (queryError) {
      setError(queryError.message);
      setLoading(false);
      return [];
    }

    const mapped = ((data ?? []) as unknown as UserRow[]).map(mapUserRow);
    setUsers(mapped);
    setLoading(false);
    return mapped;
  }, []);

  const getById = useCallback(async (id: string) => {
    const { data, error: queryError } = await fromPublicTable("users")
      .select("*")
      .eq("id", id)
      .single();

    if (queryError) {
      setError(queryError.message);
      return null;
    }

    return mapUserRow(data as unknown as UserRow);
  }, []);

  const create = useCallback(
    async (user: UserInput) => {
      setLoading(true);
      setError(null);

      const { data, error: mutationError } = await fromPublicTable("users")
        .insert(toUserInsert(user))
        .select("*")
        .single();

      if (mutationError) {
        setError(
          getFriendlyMutationError(mutationError, {
            uniqueFields: {
              email: (value) =>
                value
                  ? `Já existe um usuário com o e-mail ${value}.`
                  : "Já existe um usuário com esse e-mail.",
            },
            defaultMessage: "Não foi possível cadastrar o usuário.",
          })
        );
        setLoading(false);
        return null;
      }

      await getAll();
      return mapUserRow(data as unknown as UserRow);
    },
    [getAll]
  );

  const update = useCallback(
    async (
      id: string,
      updates: Partial<UserInput> & { role?: UserRole; active?: boolean }
    ) => {
      setLoading(true);
      setError(null);

      const { data, error: mutationError } = await fromPublicTable("users")
        .update({
          name: updates.name,
          email: updates.email,
          password: updates.password,
          role: updates.role,
          worker_id: updates.workerId === undefined ? undefined : updates.workerId || null,
          active: updates.active,
        })
        .eq("id", id)
        .select("*")
        .single();

      if (mutationError) {
        setError(
          getFriendlyMutationError(mutationError, {
            uniqueFields: {
              email: (value) =>
                value
                  ? `Já existe um usuário com o e-mail ${value}.`
                  : "Já existe um usuário com esse e-mail.",
            },
            defaultMessage: "Não foi possível atualizar o usuário.",
          })
        );
        setLoading(false);
        return null;
      }

      await getAll();
      return mapUserRow(data as unknown as UserRow);
    },
    [getAll]
  );

  const remove = useCallback(
    async (id: string) => {
      setLoading(true);
      setError(null);

      const { error: mutationError } = await fromPublicTable("users").delete().eq("id", id);

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
      .channel(`users-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "users" },
        () => {
          void getAll();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [getAll]);

  return { users, loading, error, getAll, getById, create, update, remove };
}
