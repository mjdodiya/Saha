import type { State } from "react-native-ble-plx";

export type BluetoothState = State | "Unavailable";

export type DiscoveredDevice = {
  id: string;
  name: string | null;
  rssi: number | null;
  isSahaDevice: boolean;
  serviceUUIDs?: string[] | null;
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

export type PeripheralStatus =
  | "Stopped"
  | "Initializing"
  | "Advertising"
  | "Advertising Failed"
  | "Connected"
  | "Bluetooth Off"
  | "Unavailable";

export type PeripheralInfo = {
  status: PeripheralStatus;
  nodeId: string;
  advertisingName: string;
  errorMessage?: string | null;
};

export type ConnectionTestState =
  | "idle"
  | "connecting"
  | "discovering"
  | "reading_identity"
  | "subscribing_tx"
  | "writing_ping"
  | "ping_pong_success"
  | "error";
