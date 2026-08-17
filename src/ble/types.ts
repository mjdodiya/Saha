import type { State } from "react-native-ble-plx";

export type BluetoothState = State | "Unavailable";

export type DiscoveredDevice = {
  id: string;
  name: string | null;
  rssi: number | null;
  isSahaDevice: boolean;
};

export type BleScannerStatus =
  | "idle"
  | "checking"
  | "permission-denied"
  | "bluetooth-unavailable"
  | "bluetooth-off"
  | "scanning"
  | "scan-complete"
  | "error";

export type BleScanResult = {
  devices: DiscoveredDevice[];
  totalDeviceCount: number;
};
