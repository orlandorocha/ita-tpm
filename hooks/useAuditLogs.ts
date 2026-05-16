"use client";

import { useEffect, useState } from "react";
import { fetchAuditLogs } from "@/lib/audit";
import type { AuditLogEntry } from "@/lib/types";

export function useAuditLogs() {
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAuditLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const logs = await fetchAuditLogs();
      setAuditLogs(logs);
    } catch (fetchError) {
      // Silently handle errors
      setAuditLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAuditLogs();
  }, []);

  return {
    auditLogs,
    loading,
    error,
    reload: loadAuditLogs,
  };
}
