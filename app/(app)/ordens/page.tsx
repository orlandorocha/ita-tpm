import { OperationalAccessBanner } from "@/components/operational-access-banner";
import { OSListView } from "@/components/os-list-view";

interface OrdensPageProps {
  searchParams: Promise<{
    equipmentId?: string;
    action?: string;
    orderId?: string;
    authCompleted?: string;
  }>;
}

export default async function OrdensPage({ searchParams }: OrdensPageProps) {
  const params = await searchParams;
  const showBanner = params.authCompleted === "1";

  return (
    <>
      {showBanner && <OperationalAccessBanner />}
      <OSListView
        initialEquipmentId={params.equipmentId}
        initialAction={params.action}
        initialOrderId={params.orderId}
      />
    </>
  );
}
