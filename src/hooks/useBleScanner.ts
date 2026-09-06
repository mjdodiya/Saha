import { useCallback, useEffect, useRef, useState } from "react";

import { BleScanner } from "@/ble/BleScanner";
import type {
  BleScannerStatus,
  BluetoothState,
  DiscoveredDevice,
} from "@/ble/types";

export function useBleScanner() {
  const [bluetoothState, setBluetoothState] =
    useState<BluetoothState>("Unknown" as BluetoothState);
  const [status, setStatus] = useState<BleScannerStatus>("idle");
  const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
  const [totalDeviceCount, setTotalDeviceCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");

  const scannerRef = useRef<BleScanner | null>(null);

  if (!scannerRef.current) {
    scannerRef.current = new BleScanner({
      onBluetoothStateChange: setBluetoothState,
      onStatusChange: setStatus,
      onDevicesChange: (result) => {
        setDevices(result.devices);
        setTotalDeviceCount(result.totalDeviceCount);
      },
      onError: setErrorMessage,
    });
  }

  useEffect(() => {
    const scanner = scannerRef.current;
    scanner?.listenForState();

    return () => {
      scanner?.cleanup();
    };
  }, []);

  const startScan = useCallback(() => {
    void scannerRef.current?.startScan();
  }, []);

  const stopScan = useCallback(() => {
    void scannerRef.current?.stopScan();
  }, []);

  return {
    bluetoothState,
    status,
    devices,
    totalDeviceCount,
    errorMessage,
    isScanning: status === "scanning",
    startScan,
    stopScan,
  };
}
