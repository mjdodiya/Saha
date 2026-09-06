import { Stack, useRouter } from 'expo-router';

import type { PeripheralStatus } from '@/ble/types';
import { HomeDesign } from '@/design/HomeDesign';
import { useBleChat } from '@/hooks/useBleChat';
import { useBlePeripheral } from '@/hooks/useBlePeripheral';
import { useBleScanner } from '@/hooks/useBleScanner';

export default function HomeScreen() {
  const router = useRouter();
  const { devices, totalDeviceCount, isScanning, startScan } = useBleScanner();
  const { status: peripheralStatus, nodeId } = useBlePeripheral();
  const { messages } = useBleChat();

  const nearbyCount = devices.filter((device) => device.isSahaDevice).length;
  const recentMessages = messages.slice(-2).reverse();
  const connectionStatus = getConnectionStatus(peripheralStatus, isScanning);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <HomeDesign
        nodeId={nodeId || 'N7'}
        nearbyCount={nearbyCount}
        messageCount={messages.length}
        totalBleSignals={totalDeviceCount}
        recentMessages={recentMessages}
        connectionLabel={connectionStatus.label}
        connectionColor={connectionStatus.color}
        isScanning={isScanning}
        onOpenNearby={() => router.push('/nearby')}
        onOpenMessages={() => router.push('/chat')}
        onDiagnose={() => router.push('/nearby')}
        onStartNearbyScan={() => {
          if (!isScanning) startScan();
          router.push('/nearby');
        }}
      />
    </>
  );
}

function getConnectionStatus(peripheralStatus: PeripheralStatus, isScanning: boolean) {
  if (isScanning) return { label: 'Scanning', color: '#3159DB' };
  if (peripheralStatus === 'Advertising' || peripheralStatus === 'Connected') {
    return { label: 'Connected', color: '#1AB66A' };
  }
  return { label: 'Ready', color: '#E5A526' };
}
