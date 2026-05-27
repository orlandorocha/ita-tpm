"use client";

import { useState } from "react";
import { X, Plus, Trash2, Package } from "lucide-react";
import type { Part } from "@/lib/types";

interface PartsUsedModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  osNumber: string;
  onSaveParts: (parts: Omit<Part, "id">[]) => Promise<void>;
}

export function PartsUsedModal({
  open,
  onOpenChange,
  osNumber,
  onSaveParts,
}: PartsUsedModalProps) {
  const [parts, setParts] = useState<Omit<Part, "id">[]>([
    { name: "", quantity: 1, unitCost: 0 },
  ]);
  const [saving, setSaving] = useState(false);

  function handleAddPart() {
    setParts((prev) => [...prev, { name: "", quantity: 1, unitCost: 0 }]);
  }

  function handleRemovePart(index: number) {
    setParts((prev) => prev.filter((_, i) => i !== index));
  }

  function handleUpdatePart(index: number, field: keyof Omit<Part, "id">, value: string | number) {
    setParts((prev) =>
      prev.map((part, i) =>
        i === index ? { ...part, [field]: value } : part
      )
    );
  }

  async function handleSave() {
    const validParts = parts.filter((part) => part.name.trim() !== "" && part.quantity > 0);
    
    if (validParts.length === 0) {
      // Permite fechar sem peças
      onOpenChange(false);
      setParts([{ name: "", quantity: 1, unitCost: 0 }]);
      return;
    }

    setSaving(true);
    try {
      await onSaveParts(validParts);
      onOpenChange(false);
      setParts([{ name: "", quantity: 1, unitCost: 0 }]);
    } finally {
      setSaving(false);
    }
  }

  function handleSkip() {
    onOpenChange(false);
    setParts([{ name: "", quantity: 1, unitCost: 0 }]);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleSkip}
      />
      <div className="relative z-10 w-full max-w-lg mx-4 bg-card border border-border rounded-lg shadow-xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Package className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-foreground font-semibold">Pecas Utilizadas</h3>
              <p className="text-muted-foreground text-xs">OS {osNumber}</p>
            </div>
          </div>
          <button
            onClick={handleSkip}
            className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Informe as pecas e quantidades utilizadas nesta atividade. Voce pode pular esta etapa se nenhuma peca foi usada.
          </p>

          <div className="space-y-3">
            {parts.map((part, index) => (
              <div
                key={index}
                className="flex flex-col sm:flex-row gap-2 p-3 bg-muted/30 rounded-lg border border-border"
              >
                <div className="flex-1">
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    Nome da Peca
                  </label>
                  <input
                    type="text"
                    value={part.name}
                    onChange={(e) => handleUpdatePart(index, "name", e.target.value)}
                    placeholder="Ex: Rolamento 6205"
                    className="w-full bg-input border border-border rounded px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
                  />
                </div>
                <div className="w-full sm:w-24">
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    Quantidade
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={part.quantity}
                    onChange={(e) => handleUpdatePart(index, "quantity", parseInt(e.target.value) || 1)}
                    className="w-full bg-input border border-border rounded px-3 py-2 text-sm text-foreground"
                  />
                </div>
                <div className="w-full sm:w-28">
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    Custo Unit. (R$)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={part.unitCost}
                    onChange={(e) => handleUpdatePart(index, "unitCost", parseFloat(e.target.value) || 0)}
                    className="w-full bg-input border border-border rounded px-3 py-2 text-sm text-foreground"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={() => handleRemovePart(index)}
                    disabled={parts.length === 1}
                    className="p-2 rounded-lg text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleAddPart}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-dashed border-border text-muted-foreground text-sm hover:bg-muted/30 hover:text-foreground transition-colors"
          >
            <Plus className="w-4 h-4" />
            Adicionar outra peca
          </button>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-border bg-muted/20">
          <button
            onClick={handleSkip}
            disabled={saving}
            className="px-4 py-2.5 rounded-lg border border-border text-muted-foreground text-sm font-medium hover:bg-muted/50 transition-colors disabled:opacity-50"
          >
            Pular
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar Pecas"}
          </button>
        </div>
      </div>
    </div>
  );
}
