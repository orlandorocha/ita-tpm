"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Download, Printer, Save, X } from "lucide-react";
import type { Equipment } from "@/lib/types";
import {
  buildEquipmentQrPayload,
  generateQrCodeDataUrl,
  uploadEquipmentQrCode,
} from "@/lib/equipmentQr";

interface EquipmentQrModalProps {
  equipment: Equipment;
  onClose: () => void;
}

export function EquipmentQrModal({ equipment, onClose }: EquipmentQrModalProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "uploading" | "ready" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const equipmentUrl = `${origin}/equipamentos/${equipment.id}`;
  const payload = useMemo(
    () =>
      buildEquipmentQrPayload({
        equipmentId: equipment.id,
        tag: equipment.code,
        setor: equipment.location,
        linha: equipment.productionLine,
        url: equipmentUrl,
      }),
    [equipment, equipmentUrl]
  );

  useEffect(() => {
    let active = true;
    setStatus("loading");
    setMessage(null);

    generateQrCodeDataUrl(payload)
      .then((url) => {
        if (!active) return;
        setDataUrl(url);
        setStatus("ready");
      })
      .catch((error) => {
        if (!active) return;
        setStatus("error");
        setMessage("Falha ao gerar o QR Code. Tente novamente.");
        console.error(error);
      });

    return () => {
      active = false;
    };
  }, [payload]);

  async function handleUpload() {
    if (!dataUrl) return;

    setStatus("uploading");
    setMessage(null);

    const result = await uploadEquipmentQrCode(equipment.id, dataUrl, true);
    if (result.error) {
      setStatus("error");
      setMessage(result.error.message ?? "Erro ao salvar QR Code no Supabase Storage.");
      return;
    }

    setPublicUrl(result.publicUrl ?? null);
    setStatus("ready");
    setMessage("QR Code salvo no Supabase Storage com sucesso.");
  }

  function handlePrint() {
    if (!dataUrl) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Imprimir QR Code</title></head><body style="margin:0;padding:0;display:flex;align-items:center;justify-content:center;height:100vh;"><img src="${dataUrl}" style="max-width:100%;height:auto" /></body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-lg w-full max-w-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-4 border-b border-border">
          <div>
            <p className="text-sm font-semibold text-foreground">QR Code do equipamento</p>
            <p className="text-xs text-muted-foreground">{equipment.name} • {equipment.code}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {status === "loading" && (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Gerando QR Code...
            </div>
          )}

          {dataUrl && (
            <div className="grid gap-4 sm:grid-cols-[220px_minmax(0,1fr)] items-start">
              <div className="rounded-xl border border-border bg-muted p-3 flex items-center justify-center">
                <img src={dataUrl} alt="QR Code" className="max-w-full h-auto" />
              </div>
              <div className="space-y-3">
                <div className="rounded-lg border border-border bg-surface p-3 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground text-sm mb-2">Dados codificados</p>
                  <code className="block break-words text-[11px] leading-5">{payload}</code>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <a href={dataUrl} download={`qr-equipment-${equipment.code}.png`} className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground hover:bg-muted">
                    <Download className="w-4 h-4" /> Download PNG
                  </a>
                  <button onClick={handlePrint} className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                    <Printer className="w-4 h-4" /> Imprimir
                  </button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    onClick={handleUpload}
                    className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground hover:bg-muted"
                    disabled={status === "uploading"}
                  >
                    <Save className="w-4 h-4" /> Salvar no Storage
                  </button>
                  <Link href={`/equipamentos/${equipment.id}`} className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground hover:bg-muted">
                    <ArrowRight className="w-4 h-4" /> Ver histórico
                  </Link>
                </div>
              </div>
            </div>
          )}

          {message && <div className="rounded-md border border-border bg-surface px-4 py-3 text-sm text-foreground">{message}</div>}
          {status === "error" && message && <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{message}</div>}
          {publicUrl && (
            <div className="rounded-lg border border-border bg-surface px-4 py-3 text-xs text-muted-foreground">
              URL pública: <a href={publicUrl} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline break-all">{publicUrl}</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
