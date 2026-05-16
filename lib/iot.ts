export type SensorType = "temperature" | "vibration" | "pressure" | "power" | "runtime";
export type DeviceTagType = "QR" | "NFC" | "RFID";

export interface IoTSensorState {
  sensorId: string;
  equipmentId: string;
  type: SensorType;
  name: string;
  status: "active" | "inactive" | "alert";
  value: number;
  unit: string;
  lastSeen: string;
  metadata?: Record<string, unknown>;
}

export interface IoTSensorEvent {
  id: string;
  sensorId: string;
  recordedAt: string;
  value: number;
  unit: string;
  detail?: string;
  metadata?: Record<string, unknown>;
}

export function buildIoTSensorPayload(sensor: IoTSensorState) {
  return {
    sensorId: sensor.sensorId,
    equipmentId: sensor.equipmentId,
    type: sensor.type,
    name: sensor.name,
    status: sensor.status,
    value: sensor.value,
    unit: sensor.unit,
    lastSeen: sensor.lastSeen,
    metadata: sensor.metadata ?? {},
  };
}

export function buildDeviceTagPayload(equipmentId: string, tagType: DeviceTagType, tagValue: string) {
  return {
    equipmentId,
    tagType,
    tagValue,
    createdAt: new Date().toISOString(),
  };
}
