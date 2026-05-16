import EquipmentDetailsClient from "./client";

interface EquipmentDetailsPageProps {
  params: {
    equipmentId: string;
  };
}

export default async function EquipmentDetailsPage({ params }: EquipmentDetailsPageProps) {
  const { equipmentId } = await params;
  return <EquipmentDetailsClient equipmentId={equipmentId} />;
}
