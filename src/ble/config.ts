export const SAHA_BLE_CONFIG = {
  scanTimeoutMs: 10000,
  serviceUuid: "a3c8e001-4f1e-4d89-9a70-3c1d9f8e4b01",
  identityUuid: "a3c8e002-4f1e-4d89-9a70-3c1d9f8e4b01",
  rxUuid: "a3c8e003-4f1e-4d89-9a70-3c1d9f8e4b01",
  txUuid: "a3c8e004-4f1e-4d89-9a70-3c1d9f8e4b01",
  cccdUuid: "00002902-0000-1000-8000-00805f9b34fb",
  namePrefixes: ["SAHA", "Saha", "saha"],
} as const;
