import { useState } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { ConversationDesign, MessagesDesign, type ConversationPreview } from '@/design/ChatDesign';
import { useBleChat } from '@/hooks/useBleChat';
import { useBlePeripheral } from '@/hooks/useBlePeripheral';
import { useBleScanner } from '@/hooks/useBleScanner';

export default function ChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ deviceId?: string; deviceName?: string }>();
  const targetDeviceId = params.deviceId ?? null;
  const targetDeviceName = params.deviceName ?? null;
  const { devices } = useBleScanner();
  const { nodeId: myNodeId } = useBlePeripheral();
  const {
    connectionState,
    messages,
    peerIdentity,
    errorMessage,
    sendMessage,
    disconnect,
  } = useBleChat(targetDeviceId, targetDeviceName);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);

  const displayName = peerIdentity
    ? `Node ${peerIdentity}`
    : targetDeviceName || (targetDeviceId ? `Device (${targetDeviceId.slice(-5)})` : 'SAHA Broadcast');

  const handleSend = async () => {
    if (!inputText.trim() || isSending) return;
    const message = inputText;
    setInputText('');
    setIsSending(true);
    await sendMessage(message);
    setIsSending(false);
  };

  if (!targetDeviceId) {
    const conversations: ConversationPreview[] = devices.map((device) => {
      const deviceMessage = messages.find((message) => message.senderId.includes(device.id.slice(-4)));
      return {
        id: device.id,
        name: device.name ?? (device.isSahaDevice ? 'SAHA Node' : 'BLE Device'),
        preview: deviceMessage?.text ?? 'Start a conversation',
        time: deviceMessage ? formatTime(deviceMessage.timestamp) : 'now',
        isActive: device.isSahaDevice,
        onPress: () => router.push({
          pathname: '/chat',
          params: {
            deviceId: device.id,
            deviceName: device.name ?? (device.isSahaDevice ? 'SAHA Node' : 'BLE Device'),
          },
        }),
      };
    });

    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <MessagesDesign conversations={conversations} />
      </>
    );
  }

  const connectionLabel = connectionState === 'connected'
    ? `Connected as ${myNodeId || 'Me'}`
    : connectionState === 'connecting'
      ? 'Connecting'
      : connectionState === 'discovering'
        ? 'Discovering'
        : 'Available';
  const connectionColor = connectionState === 'connected'
    ? '#19B66A'
    : connectionState === 'error'
      ? '#D94B4B'
      : '#E5A526';

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ConversationDesign
        displayName={displayName}
        nodeId={myNodeId || 'N7'}
        connectionLabel={connectionLabel}
        connectionColor={connectionColor}
        messages={messages}
        inputText={inputText}
        isSending={isSending}
        isConnecting={connectionState === 'connecting' || connectionState === 'discovering'}
        errorMessage={errorMessage}
        onBack={() => router.back()}
        onDisconnect={() => void disconnect()}
        onInputChange={setInputText}
        onSend={() => void handleSend()}
      />
    </>
  );
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
