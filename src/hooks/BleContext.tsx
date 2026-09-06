import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import type { ConnectionTestResult } from '@/ble/BleConnection';
import type { ChatConnectionState } from '@/ble/types';
import { useBleChat } from './useBleChat';
import { useBlePeripheral } from './useBlePeripheral';
import { useBleScanner } from './useBleScanner';

type ActivePeer = { id: string; name?: string | null } | null;
type SharedConnectionState = 'idle' | 'connecting' | 'discovering' | 'verifying' | 'connected' | 'disconnecting' | 'disconnected' | 'failed';

type BleContextValue = {
  scanner: ReturnType<typeof useBleScanner>;
  peripheral: ReturnType<typeof useBlePeripheral>;
  chat: ReturnType<typeof useBleChat>;
  activePeer: ActivePeer;
  connectionState: SharedConnectionState;
  connectionError: string | null;
  lastConnectionTest: ConnectionTestResult | null;
  advertising: boolean;
  connectToPeer: (id: string, name?: string | null) => Promise<void>;
  disconnect: () => Promise<void>;
  setLastConnectionTest: (result: ConnectionTestResult | null) => void;
};

const BleContext = createContext<BleContextValue | null>(null);

export function BleProvider({ children }: { children: React.ReactNode }) {
  const scanner = useBleScanner();
  const peripheral = useBlePeripheral();
  const chat = useBleChat();
  const [activePeer, setActivePeer] = useState<ActivePeer>(null);
  const [lastConnectionTest, setLastConnectionTest] = useState<ConnectionTestResult | null>(null);

  const connectToPeer = useCallback(async (id: string, name?: string | null) => {
    setActivePeer({ id, name });
    await chat.connectToPeer(id, name);
  }, [chat.connectToPeer]);

  const disconnect = useCallback(async () => {
    await chat.disconnect();
    setActivePeer(null);
  }, [chat.disconnect]);

  const connectionState = mapConnectionState(chat.connectionState);
  const value = useMemo<BleContextValue>(() => ({
    scanner,
    peripheral,
    chat,
    activePeer,
    connectionState,
    connectionError: chat.errorMessage,
    lastConnectionTest,
    advertising: peripheral.status === 'Advertising' || peripheral.status === 'Connected',
    connectToPeer,
    disconnect,
    setLastConnectionTest,
  }), [scanner, peripheral, chat, activePeer, connectionState, lastConnectionTest, connectToPeer, disconnect]);

  return <BleContext.Provider value={value}>{children}</BleContext.Provider>;
}

export function useBleContext() {
  const context = useContext(BleContext);
  if (!context) throw new Error('useBleContext must be used inside BleProvider');
  return context;
}

function mapConnectionState(state: ChatConnectionState): SharedConnectionState {
  if (state === 'connecting') return 'connecting';
  if (state === 'discovering') return 'discovering';
  if (state === 'connected') return 'connected';
  if (state === 'error') return 'failed';
  return 'disconnected';
}
