"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Clock3, QrCode, Wrench } from "lucide-react";
import { useEquipments } from "@/hooks/useEquipments";
import { useServiceOrders } from "@/hooks/useServiceOrders";
import { EquipmentQrModal } from "@/components/equipment-qr-modal";

interface EquipmentDetailsClientProps {
  equipmentId: string;
}

export default function EquipmentDetailsClient({ equipmentId }: EquipmentDetailsClientProps) {
  const { equipments, getAll: reloadEquipments, loading: equipmentLoading, error: equipmentError } = useEquipments();
  const { serviceOrders, getAll: reloadOrders, loading: ordersLoading } = useServiceOrders();
  const [showQrModal, setShowQrModal] = useState(false);

  const equipment = useMemo(
    () => equipments.find((item) => item.id === equipmentId),
    [equipments, equipmentId]
  );

  const relatedOrders = useMemo(
    () => serviceOrders.filter((order) => order.equipmentId === equipmentId),
    [serviceOrders, equipmentId]
  );

  useEffect(() => {
    if (!equipment) {
      void reloadEquipments();
    }

    if (serviceOrders.length === 0) {
      void reloadOrders();
    }
  }, [equipment, reloadEquipments, reloadOrders, serviceOrders.length]);

  if (equipmentLoading && !equipment) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando equipamento...</div>;
  }

  if (!equipment) {
    return (
      <div className="p-6 space-y-4">
        <p className="text-sm text-destructive">Equipamento não encontrado.</p>
        <Link href="/equipamentos" className="text-primary hover:underline">Voltar para lista</Link>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/equipamentos" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Link>
          <div className="mt-3">
            <p className="text-2xl font-semibold text-foreground">{equipment.name}</p>
            <p className="text-sm text-muted-foreground">{equipment.code}</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Link
            href={`/ordens?equipmentId=${equipment.id}`}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            <Wrench className="w-4 h-4" /> Registrar OS
          </Link>
          <button
            type="button"
            onClick={() => setShowQrModal(true)}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <QrCode className="w-4 h-4" /> Ver QR Code
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-5">
            <p className="text-sm font-semibold text-foreground mb-3">Dados do ativo</p>
            <div className="grid gap-2 text-sm text-muted-foreground">
              <div>
                <p className="font-medium text-foreground">Localização</p>
                <p>{equipment.location}</p>
              </div>
              <div>
                <p className="font-medium text-foreground">Linha produtiva</p>
                <p>{equipment.productionLine}</p>
              </div>
              <div>
                <p className="font-medium text-foreground">Cadastro</p>
                <p>{equipment.createdAt ?? "N/A"}</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
              <Clock3 className="w-4 h-4" />
              <span>Histórico de manutenção</span>
            </div>
            {ordersLoading && <p className="text-sm text-muted-foreground">Carregando ordens...</p>}
            {!ordersLoading && relatedOrders.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma ordem de serviço registrada para este equipamento.</p>
            )}
            <div className="space-y-3">
              {relatedOrders.map((order) => (
                <div key={order.id} className="rounded-lg border border-border bg-background p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">OS {order.number}</p>
                      <p className="text-xs text-muted-foreground">{order.type} • {order.status}</p>
                    </div>
                    <span className="rounded-full bg-muted px-2 py-1 text-[11px] uppercase text-muted-foreground">{order.priority}</span>
                  </div>
                  <p className="mt-3 text-sm text-foreground/80 line-clamp-2">{order.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-5">
            <p className="text-sm font-semibold text-foreground mb-4">Resumo rápido</p>
            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="rounded-lg bg-surface p-3">
                <p className="font-medium text-foreground">Ordens vinculadas</p>
                <p>{relatedOrders.length}</p>
              </div>
              <div className="rounded-lg bg-surface p-3">
                <p className="font-medium text-foreground">Última OS</p>
                <p>{relatedOrders[0]?.number ?? "-"}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showQrModal && <EquipmentQrModal equipment={equipment} onClose={() => setShowQrModal(false)} />}
    </div>
  );
}
