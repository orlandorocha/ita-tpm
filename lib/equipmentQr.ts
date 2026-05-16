import QRCode from "qrcode";
import { supabase } from "./supabaseClient";
import type { PostgrestError } from "@supabase/supabase-js";

export const QR_CODE_BUCKET = "equipment-qrcodes";

export interface EquipmentQrPayload {
  equipmentId: string;
  tag: string;
  setor: string;
  linha: string;
  url: string;
}

export function buildEquipmentQrPayload(payload: EquipmentQrPayload) {
  return JSON.stringify(payload);
}

export function buildEquipmentQrPath(equipmentId: string) {
  return `qrcodes/${equipmentId}.png`;
}

export async function generateQrCodeDataUrl(payload: string) {
  return QRCode.toDataURL(payload, {
    type: "image/png",
    width: 400,
    margin: 2,
  });
}

export function dataUrlToBlob(dataUrl: string) {
  const [meta, base64Data] = dataUrl.split(",");
  const mime = meta.match(/data:(.*);base64/)?.[1] ?? "image/png";
  const binary = atob(base64Data);
  const array = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    array[i] = binary.charCodeAt(i);
  }

  return new Blob([array], { type: mime });
}

async function getPublicUrl(path: string) {
  const { data } = supabase.storage.from(QR_CODE_BUCKET).getPublicUrl(path);
  return data.publicUrl ?? null;
}

export async function uploadEquipmentQrCode(
  equipmentId: string,
  dataUrl: string,
  upsert = false
): Promise<{ publicUrl?: string; error?: PostgrestError | Error }> {
  const path = buildEquipmentQrPath(equipmentId);
  const blob = dataUrlToBlob(dataUrl);
  const { error } = await supabase.storage.from(QR_CODE_BUCKET).upload(path, blob, {
    upsert,
  });

  if (error) {
    if (!upsert && error.status === 409) {
      const publicUrl = await getPublicUrl(path);
      return { publicUrl: publicUrl ?? undefined };
    }

    return { error };
  }

  const publicUrl = await getPublicUrl(path);
  return { publicUrl: publicUrl ?? undefined };
}

export async function uploadEquipmentQrCodeForEquipment(
  equipment: {
    id: string;
    code: string;
    location: string;
    productionLine: string;
  },
  origin: string
) {
  const payload = buildEquipmentQrPayload({
    equipmentId: equipment.id,
    tag: equipment.code,
    setor: equipment.location,
    linha: equipment.productionLine,
    url: `${origin}/equipamentos/${equipment.id}`,
  });

  const dataUrl = await generateQrCodeDataUrl(payload);
  return uploadEquipmentQrCode(equipment.id, dataUrl, true);
}
