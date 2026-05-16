import { OSListView } from "@/components/os-list-view";

interface OrdensPageProps {
  searchParams: {
    equipmentId?: string;
    action?: string;
    orderId?: string;
  };
}

export default function OrdensPage({ searchParams }: OrdensPageProps) {
  return (
    <OSListView
      initialEquipmentId={searchParams.equipmentId}
      initialAction={searchParams.action}
      initialOrderId={searchParams.orderId}
    />
  );
}
