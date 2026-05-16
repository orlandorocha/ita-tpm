import { fromPublicTable } from "./supabaseClient";
import { mapAuditLogRow } from "./supabase-mappers";
import type { AuditLogEntry, AuditLogRow } from "./types";

type SupabaseErrorLike = {
  status?: number;
  code?: string;
  message?: string;
  details?: string;
};

function isTableMissingError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const supabaseError = error as SupabaseErrorLike;
  const message = String(supabaseError.message ?? supabaseError.details ?? "");

  return (
    supabaseError.status === 404 ||
    supabaseError.code === "PGRST116" ||
    /not found/i.test(message) ||
    /relation .* does not exist/i.test(message)
  );
}

export async function recordAuditLog(entry: Omit<AuditLogEntry, "id">) {
  const result = await fromPublicTable("audit_logs").insert({
    timestamp: entry.timestamp,
    resource: entry.resource,
    resource_id: entry.resourceId,
    action: entry.action,
    user_id: entry.userId ?? null,
    user_name: entry.userName,
    details: entry.details ?? null,
    metadata: entry.metadata ?? null,
  });

  if (result.error) {
    if (isTableMissingError(result.error)) {
      // Silently skip audit logging if table doesn't exist
      return null;
    }
    console.warn("Falha ao gravar auditoria:", result.error);
    return null;
  }

  return (result.data?.[0] ?? null) as unknown as AuditLogEntry;
}


export async function fetchAuditLogs() {
  try {
    const result = await fromPublicTable("audit_logs")
      .select("*")
      .order("timestamp", { ascending: false });

    if (result.error) {
      if (isTableMissingError(result.error)) {
        // Silently return empty array if audit_logs table doesn't exist
        return [] as AuditLogEntry[];
      }

      // Only log non-404 errors
      return [] as AuditLogEntry[];
    }

    return (result.data ?? []).map((row: unknown) => mapAuditLogRow(row as AuditLogRow));
  } catch (err) {
    // Silently catch all errors
    return [] as AuditLogEntry[];
  }
}
