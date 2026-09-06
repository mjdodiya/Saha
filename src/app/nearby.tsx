import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';

import type { DiscoveredDevice } from '@/ble/types';
import { NearbyDesign } from '@/design/NearbyDesign';
import { useBleScanner } from '@/hooks/useBleScanner';

export default function NearbyScreen() {
  const router = useRouter();
  const {
    bluetoothState,
    status,
    devices,
    errorMessage,
    isScanning,
    startScan,
  } = useBleScanner();

  useEffect(() => {
    startScan();
  }, [startScan]);

  const handleConnect = (device: DiscoveredDevice) => {
    router.push({
      pathname: '/chat',
      params: {
        deviceId: device.id,
        deviceName:
          device.name ?? (device.isSahaDevice ? 'SAHA Node' : 'BLE Device'),
      },
    });
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <NearbyDesign
        devices={devices}
        bluetoothState={bluetoothState}
        status={status}
        errorMessage={errorMessage}
        isScanning={isScanning}
        onScanAgain={startScan}
        onConnect={handleConnect}
      />
    </>
  );
}
