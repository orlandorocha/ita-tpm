"use client";

import Link from "next/link";
import { useState } from "react";
import { useApp } from "@/lib/app-context";
import { useEquipments } from "../hooks/useEquipments";
import { hasPermission } from "@/lib/permissions";
import type { Equipment, EquipmentInput } from "@/lib/types";
import { uploadEquipmentQrCodeForEquipment } from "@/lib/equipmentQr";
import { EquipmentQrModal } from "./equipment-qr-modal";
import { Camera, Eye, Plus, Pencil, Trash2, QrCode, X, Search, Wrench, MapPin, Factory } from "lucide-react";

function EquipmentFormModal({
  equipment,
  onSaved,
  onClose,
}: {
  equipment?: Equipment;
  onSaved: () => Promise<unknown>;
  onClose: () => void;
}) {
  const { create, update, loading, error } = useEquipments();
  const isEdit = Boolean(equipment);

  const [form, setForm] = useState<EquipmentInput>({
    name: equipment?.name ?? "",
    code: equipment?.code ?? "",
    location: equipment?.location ?? "",
    productionLine: equipment?.productionLine ?? "",
  });

  function setField<K extends keyof EquipmentInput>(key: K, value: EquipmentInput[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    const result = isEdit && equipment
      ? await update(equipment.id, form)
      : await create(form);

    if (!result) {
      return;
    }

    if (typeof window !== "undefined") {
      await uploadEquipmentQrCodeForEquipment(result, window.location.origin).catch(() => {
        // O upload é opcional aqui: o QR Code pode ser gerado e salvo posteriormente.
      });
    }

    await onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-lg w-full max-w-md shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-border shrink-0">
          <h2 className="text-foreground font-semibold text-sm">
            {isEdit ? "Editar Equipamento" : "Novo Equipamento"}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={submit} className="p-4 sm:p-5 space-y-3 overflow-y-auto">
          <div>
            <label className="block text-xs text-muted-foreground font-medium mb-1">Nome</label>
            <input
              value={form.name}
              onChange={(event) => setField("name", event.target.value)}
              required
              className="w-full bg-input border border-border rounded px-3 py-2 text-sm text-foreground"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground font-medium mb-1">Código</label>
            <input
              value={form.code}
              onChange={(event) => setField("code", event.target.value)}
              required
              placeholder="Ex: CA-001"
              className="w-full bg-input border border-border rounded px-3 py-2 text-sm text-foreground"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground font-medium mb-1">Localização</label>
              <input
                value={form.location}
                onChange={(event) => setField("location", event.target.value)}
                required
                placeholder="Ex: Bloco A"
                className="w-full bg-input border border-border rounded px-3 py-2 text-sm text-foreground"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground font-medium mb-1">Linha de Produção</label>
              <input
                value={form.productionLine}
                onChange={(event) => setField("productionLine", event.target.value)}
                required
                placeholder="Ex: Linha 01"
                className="w-full bg-input border border-border rounded px-3 py-2 text-sm text-foreground"
              />
            </div>
          </div>
          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded border border-border text-sm text-muted-foreground hover:bg-muted/30"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
              disabled={loading}
            >
              {isEdit ? "Salvar" : "Cadastrar"}
            </button>
          </div>
          {error && <div className="text-red-500 text-xs pt-2">{error}</div>}
        </form>
      </div>
    </div>
  );
}

export function EquipmentView() {
  const { state } = useApp();
  const { equipments, remove, getAll, loading, error } = useEquipments();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<Equipment | undefined>();
  const [qrEquipment, setQrEquipment] = useState<Equipment | undefined>();

  const canCreateEquipment = hasPermission(state.currentUser?.role, "equipment:create");
  const canEditEquipment = hasPermission(state.currentUser?.role, "equipment:edit");
  const canDeleteEquipment = hasPermission(state.currentUser?.role, "equipment:delete");

  const filtered = equipments.filter(
    (equipment) =>
      search === "" ||
      equipment.name.toLowerCase().includes(search.toLowerCase()) ||
      equipment.code.toLowerCase().includes(search.toLowerCase()) ||
      equipment.location.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar equipamento..."
            className="w-full bg-input border border-border rounded pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          {canCreateEquipment && (
            <button
              onClick={() => {
                setEditingEquipment(undefined);
                setShowForm(true);
              }}
              className="flex items-center justify-center gap-2 rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="w-4 h-4" /> Novo Equipamento
            </button>
          )}
          <Link
            href="/equipamentos/scan"
            className="flex items-center justify-center gap-2 rounded border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            <Camera className="w-4 h-4" /> Ler QR
          </Link>
        </div>
      </div>

      {loading && equipments.length === 0 && (
        <div className="py-16 text-center text-muted-foreground text-sm">Carregando equipamentos...</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4">
        {filtered.map((equipment) => (
          <div key={equipment.id} className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Wrench className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-foreground font-semibold text-sm truncate">{equipment.name}</p>
                  <p className="text-muted-foreground text-xs font-mono">{equipment.code}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-2">
                <button
                  onClick={() => setQrEquipment(equipment)}
                  className="p-1.5 text-muted-foreground hover:text-foreground"
                  title="Visualizar QR Code"
                >
                  <QrCode className="w-3.5 h-3.5" />
                </button>
                <Link
                  href={`/equipamentos/${equipment.id}`}
                  className="p-1.5 text-muted-foreground hover:text-foreground"
                  title="Ver histórico"
                >
                  <Eye className="w-3.5 h-3.5" />
                </Link>
                {canDeleteEquipment && (
                  <button
                    onClick={async () => {
                      if (confirm(`Excluir ${equipment.name}?`)) {
                        await remove(equipment.id);
                      }
                    }}
                    className="p-1.5 text-muted-foreground hover:text-destructive"
                    title="Excluir equipamento"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1 min-w-0 break-words">
                <MapPin className="w-3 h-3" /> {equipment.location}
              </span>
              <span className="flex items-center gap-1 min-w-0 break-words">
                <Factory className="w-3 h-3" /> {equipment.productionLine}
              </span>
            </div>
          </div>
        ))}
        {!loading && filtered.length === 0 && (
          <div className="col-span-3 py-20 text-center text-muted-foreground text-sm">
            Nenhum equipamento encontrado.
          </div>
        )}
      </div>

      {showForm && (
        <EquipmentFormModal
          equipment={editingEquipment}
          onSaved={getAll}
          onClose={() => {
            setShowForm(false);
            setEditingEquipment(undefined);
          }}
        />
      )}
      {qrEquipment && (
        <EquipmentQrModal
          equipment={qrEquipment}
          onClose={() => setQrEquipment(undefined)}
        />
      )}
      {error && <div className="text-red-500 text-xs pt-2">{error}</div>}
    </div>
  );
}