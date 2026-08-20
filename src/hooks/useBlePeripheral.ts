import { useCallback, useEffect, useState } from "react";
import { sahaBlePeripheral } from "@/ble/SahaBlePeripheral";
import type { PeripheralInfo, PeripheralStatus } from "@/ble/types";

export function useBlePeripheral() {
  const [info, setInfo] = useState<PeripheralInfo>({
    status: "Stopped",
    nodeId: "...",
    advertisingName: "SAHA-...",
    errorMessage: null,
  });

  const [lastPayload, setLastPayload] = useState<{
    deviceId: string;
    payload: string;
    timestamp: number;
  } | null>(null);

  const updatePeripheralInfo = useCallback(async () => {
    const current = await sahaBlePeripheral.getStatus();
    setInfo(current);
  }, []);

  const startPeripheral = useCallback(async () => {
    const result = await sahaBlePeripheral.startPeripheral();
    setInfo(result);
    return result;
  }, []);

  const stopPeripheral = useCallback(async () => {
    const result = await sahaBlePeripheral.stopPeripheral();
    setInfo(result);
    return result;
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function init() {
      if (!sahaBlePeripheral.isAvailable()) {
        if (isMounted) {
          setInfo({
            status: "Unavailable",
            nodeId: "N/A",
            advertisingName: "SAHA-N/A",
            errorMessage: "Native BLE peripheral module is unavailable (run on physical Android with native dev build)",
          });
        }
        return;
      }

      const nodeId = await sahaBlePeripheral.getNodeId();
      if (isMounted) {
        setInfo((prev) => ({
          ...prev,
          nodeId,
          advertisingName: `SAHA-${nodeId}`,
        }));
      }

      // Check current native status before starting to prevent "Stopped" flash
      const currentStatus = await sahaBlePeripheral.getStatus();
      if (isMounted) {
        setInfo(currentStatus);
      }

      // Only auto-start if not already running
      if (currentStatus.status !== "Advertising" && currentStatus.status !== "Connected" && currentStatus.status !== "Initializing") {
        const result = await sahaBlePeripheral.startPeripheral();
        if (isMounted) {
          setInfo(result);
        }
      }
    }

    void init();

    const stateSub = sahaBlePeripheral.onStateChange((newInfo) => {
      if (isMounted) {
        setInfo(newInfo);
      }
    });

    const dataSub = sahaBlePeripheral.onDataReceived((data) => {
      if (isMounted) {
        setLastPayload({
          deviceId: data.deviceId,
          payload: data.payload,
          timestamp: Date.now(),
        });
      }
    });

    return () => {
      isMounted = false;
      stateSub.remove();
      dataSub.remove();
    };
  }, []);

  return {
    status: info.status,
    nodeId: info.nodeId,
    advertisingName: info.advertisingName,
    errorMessage: info.errorMessage,
    info,
    lastPayload,
    startPeripheral,
    stopPeripheral,
    refreshStatus: updatePeripheralInfo,
    isAvailable: sahaBlePeripheral.isAvailable(),
  };
}
