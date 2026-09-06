import { useCallback, useEffect, useRef, useState } from "react";
import type { Characteristic, Device, Subscription } from "react-native-ble-plx";

import { bleManager } from "@/ble/BleManager";
import { decodeBase64, encodeBase64 } from "@/ble/BleConnection";
import {
  IDENTITY_CHARACTERISTIC_UUID,
  RX_CHARACTERISTIC_UUID,
  SAHA_SERVICE_UUID,
  TX_CHARACTERISTIC_UUID,
} from "@/ble/config";
import { sahaBlePeripheral } from "@/ble/SahaBlePeripheral";
import type { ChatConnectionState, ChatMessage } from "@/ble/types";

export function useBleChat(targetDeviceId?: string | null, targetDeviceName?: string | null) {
  const [connectionState, setConnectionState] = useState<ChatConnectionState>("disconnected");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [peerIdentity, setPeerIdentity] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const connectedDeviceRef = useRef<Device | null>(null);
  const txSubscriptionRef = useRef<Subscription | null>(null);

  // Helper to add a message to chat history state with debugging log
  const addMessage = useCallback((text: string, isSelf: boolean, senderLabel?: string) => {
    const sender = isSelf ? "Me" : senderLabel || "Peer";
    console.log(`[SAHA-BLE][CHAT] Adding message to state - Sender: ${sender}, IsSelf: ${isSelf}, Text: "${text}"`);
    const newMessage: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      senderId: sender,
      text,
      timestamp: Date.now(),
      isSelf,
    };
    setMessages((prev) => [...prev, newMessage]);
  }, []);

  // Disconnect central session cleanly
  const disconnect = useCallback(async () => {
    console.log("[SAHA-BLE][CENTRAL] Disconnecting BLE chat session...");
    if (txSubscriptionRef.current) {
      txSubscriptionRef.current.remove();
      txSubscriptionRef.current = null;
      console.log("[SAHA-BLE][CENTRAL][TX] Unsubscribed from TX notifications");
    }
    if (connectedDeviceRef.current) {
      try {
        await connectedDeviceRef.current.cancelConnection();
        console.log("[SAHA-BLE][CENTRAL] BLE connection cancelled successfully");
      } catch (err) {
        console.log("[SAHA-BLE][CENTRAL] Disconnect warning/error:", err);
      }
      connectedDeviceRef.current = null;
    }
    setConnectionState("disconnected");
  }, []);

  // Connect as Central to target peripheral device
  const connectToPeer = useCallback(async (deviceId: string) => {
    setErrorMessage(null);
    setConnectionState("connecting");
    console.log(`[SAHA-BLE][CENTRAL] Initiating BLE connection to peripheral device: ${deviceId}`);

    const rawManager = bleManager.getNativeManager();
    if (!rawManager) {
      const err = "Native BLE manager is unavailable";
      console.log("[SAHA-BLE][CENTRAL] Error:", err);
      setErrorMessage(err);
      setConnectionState("error");
      return;
    }

    try {
      const device = await rawManager.connectToDevice(deviceId, { timeout: 10000 });
      connectedDeviceRef.current = device;
      console.log(`[SAHA-BLE][CENTRAL] BLE connection established with device: ${deviceId}`);

      setConnectionState("discovering");
      console.log(`[SAHA-BLE][CENTRAL] Starting GATT service discovery for device: ${deviceId}`);
      await device.discoverAllServicesAndCharacteristics();
      console.log(`[SAHA-BLE][CENTRAL] GATT service discovery completed for device: ${deviceId}`);

      // Read identity characteristic if available
      try {
        console.log(`[SAHA-BLE][CENTRAL] Reading Identity characteristic (${IDENTITY_CHARACTERISTIC_UUID})...`);
        const identityChar: Characteristic = await device.readCharacteristicForService(
          SAHA_SERVICE_UUID,
          IDENTITY_CHARACTERISTIC_UUID,
        );
        if (identityChar.value) {
          const identity = decodeBase64(identityChar.value);
          console.log(`[SAHA-BLE][CENTRAL] Read identity from peer: "${identity}"`);
          setPeerIdentity(identity);
        }
      } catch (readErr) {
        console.log("[SAHA-BLE][CENTRAL] Identity characteristic read skipped or failed:", readErr);
      }

      // Subscribe to TX characteristic for incoming Peripheral -> Central notifications
      console.log(`[SAHA-BLE][CENTRAL][TX] Subscribing to TX notifications (${TX_CHARACTERISTIC_UUID})...`);
      txSubscriptionRef.current = device.monitorCharacteristicForService(
        SAHA_SERVICE_UUID,
        TX_CHARACTERISTIC_UUID,
        (error, characteristic) => {
          if (error) {
            console.log("[SAHA-BLE][CENTRAL][TX] Notification subscription error:", error.message);
            return;
          }
          if (characteristic?.value) {
            console.log("[SAHA-BLE][CENTRAL][TX] Received raw TX notification value (Base64):", characteristic.value);
            const decodedText = decodeBase64(characteristic.value);
            console.log("[SAHA-BLE][CENTRAL][TX] Decoded notification text message:", decodedText);
            addMessage(decodedText, false, peerIdentity || targetDeviceName || "Peripheral Node");
          }
        },
      );
      console.log("[SAHA-BLE][CENTRAL][TX] TX notification subscription active");

      setConnectionState("connected");
      console.log(`[SAHA-BLE][CENTRAL] Chat connection ready with peripheral: ${deviceId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to connect to BLE device";
      console.log(`[SAHA-BLE][CENTRAL] BLE Connection failed for ${deviceId}: ${msg}`);
      setErrorMessage(msg);
      setConnectionState("error");
    }
  }, [addMessage, peerIdentity, targetDeviceName]);

  // Handle incoming Peripheral RX write data (Central -> Peripheral)
  useEffect(() => {
    const dataSub = sahaBlePeripheral.onDataReceived((event) => {
      // Incoming message written by a Central to our local Peripheral RX characteristic
      if (event.payload) {
        console.log(`[SAHA-BLE][PERIPHERAL][RX] Peripheral received RX payload from Central (${event.deviceId}): "${event.payload}"`);
        console.log(`[SAHA-BLE][PERIPHERAL][CHAT] Forwarding RX payload to React Native chat state: "${event.payload}"`);
        addMessage(event.payload, false, `Central (${event.deviceId.slice(-4)})`);
      }
    });

    return () => {
      dataSub.remove();
    };
  }, [addMessage]);

  // Connect to target device on mount if provided
  useEffect(() => {
    if (targetDeviceId) {
      void connectToPeer(targetDeviceId);
    }

    return () => {
      void disconnect();
    };
  }, [targetDeviceId, connectToPeer, disconnect]);

  // Send message over BLE
  const sendMessage = useCallback(
    async (text: string): Promise<boolean> => {
      if (!text.trim()) {
        return false;
      }

      const trimmedText = text.trim();

      // If connected as Central to target device (Central -> Peripheral via RX write)
      if (connectedDeviceRef.current && connectionState === "connected") {
        try {
          console.log(`[SAHA-BLE][CENTRAL][RX] Central writing text message to RX characteristic (${RX_CHARACTERISTIC_UUID}): "${trimmedText}"`);
          const base64Payload = encodeBase64(trimmedText);
          console.log(`[SAHA-BLE][CENTRAL][RX] Encoded Base64 payload length: ${base64Payload.length}`);
          
          await connectedDeviceRef.current.writeCharacteristicWithResponseForService(
            SAHA_SERVICE_UUID,
            RX_CHARACTERISTIC_UUID,
            base64Payload,
          );
          console.log("[SAHA-BLE][CENTRAL][RX] RX characteristic write completed successfully");
          addMessage(trimmedText, true);
          return true;
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Failed to send RX write";
          console.log(`[SAHA-BLE][CENTRAL][RX] RX write error: ${msg}`);
          setErrorMessage(`Send failed: ${msg}`);
          return false;
        }
      }

      // Fallback or Peripheral Mode: send TX notification to connected Centrals (Peripheral -> Central via TX notification)
      if (sahaBlePeripheral.isAvailable()) {
        console.log(`[SAHA-BLE][PERIPHERAL][TX] Peripheral sending TX notification to connected Centrals: "${trimmedText}"`);
        const success = await sahaBlePeripheral.sendNotification(trimmedText);
        if (success) {
          console.log("[SAHA-BLE][PERIPHERAL][TX] TX notification delivered successfully");
          addMessage(trimmedText, true);
          return true;
        } else {
          console.log("[SAHA-BLE][PERIPHERAL][TX] Failed to send TX notification (no connected Central)");
          setErrorMessage("Failed to send TX notification (no connected Central)");
          return false;
        }
      }

      console.log("[SAHA-BLE][CHAT] Error: No active BLE connection available to send message");
      setErrorMessage("No active BLE connection to send message");
      return false;
    },
    [connectionState, addMessage],
  );

  return {
    connectionState,
    messages,
    peerIdentity,
    errorMessage,
    sendMessage,
    connectToPeer,
    disconnect,
    isConnected: connectionState === "connected" || (!targetDeviceId && sahaBlePeripheral.isAvailable()),
  };
}
