import { OSListView } from "@/components/os-list-view";

interface OrdensPageProps {
  searchParams: {
    equipmentId?: string;
  };
}

export default function OrdensPage({ searchParams }: OrdensPageProps) {
  return <OSListView initialEquipmentId={searchParams.equipmentId} />;
}
