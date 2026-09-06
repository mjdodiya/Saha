import { bleManager } from "./BleManager";
import { SAHA_BLE_CONFIG } from "./config";
import type { ConnectionTestState } from "./types";
import type { Characteristic, Device, Subscription } from "react-native-ble-plx";

const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

export function encodeBase64(input: string): string {
  let output = "";
  let i = 0;
  while (i < input.length) {
    const chr1 = input.charCodeAt(i++);
    const chr2 = input.charCodeAt(i++);
    const chr3 = input.charCodeAt(i++);

    const enc1 = chr1 >> 2;
    const enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
    let enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
    let enc4 = chr3 & 63;

    if (isNaN(chr2)) {
      enc3 = enc4 = 64;
    } else if (isNaN(chr3)) {
      enc4 = 64;
    }

    output =
      output +
      BASE64_CHARS.charAt(enc1) +
      BASE64_CHARS.charAt(enc2) +
      BASE64_CHARS.charAt(enc3) +
      BASE64_CHARS.charAt(enc4);
  }
  return output;
}

export function decodeBase64(input: string): string {
  let output = "";
  let i = 0;
  const cleaned = input.replace(/[^A-Za-z0-9+/=]/g, "");

  while (i < cleaned.length) {
    const enc1 = BASE64_CHARS.indexOf(cleaned.charAt(i++));
    const enc2 = BASE64_CHARS.indexOf(cleaned.charAt(i++));
    const enc3 = BASE64_CHARS.indexOf(cleaned.charAt(i++));
    const enc4 = BASE64_CHARS.indexOf(cleaned.charAt(i++));

    const chr1 = (enc1 << 2) | (enc2 >> 4);
    const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    const chr3 = ((enc3 & 3) << 6) | enc4;

    output += String.fromCharCode(chr1);
    if (enc3 !== 64) {
      output += String.fromCharCode(chr2);
    }
    if (enc4 !== 64) {
      output += String.fromCharCode(chr3);
    }
  }
  return output;
}

export type ConnectionTestResult = {
  success: boolean;
  readIdentity: string | null;
  receivedNotification: string | null;
  errorMessage: string | null;
  stepsLog: string[];
};

export async function runSahaConnectionTest(
  deviceId: string,
  onStateChange?: (state: ConnectionTestState, stepLog: string) => void,
): Promise<ConnectionTestResult> {
  const stepsLog: string[] = [];

  const logStep = (state: ConnectionTestState, message: string) => {
    const logLine = `[BLE-TEST] ${message}`;
    stepsLog.push(logLine);
    if (__DEV__) {
      console.log(logLine);
    }
    onStateChange?.(state, message);
  };

  let connectedDevice: Device | null = null;
  let txSubscription: Subscription | null = null;

  try {
    logStep("connecting", `Connecting to device ${deviceId}...`);

    const rawManager = bleManager.getNativeManager();
    if (!rawManager) {
      throw new Error("react-native-ble-plx manager unavailable");
    }

    connectedDevice = await rawManager.connectToDevice(deviceId, { timeout: 10000 });
    logStep("connecting", `Connected to ${deviceId}`);

    logStep("discovering", "Discovering services and characteristics...");
    await connectedDevice.discoverAllServicesAndCharacteristics();
    logStep("discovering", "Discovered GATT services");

    logStep("reading_identity", "Reading Identity characteristic...");
    let readIdentity: string | null = null;
    try {
      const identityChar: Characteristic = await connectedDevice.readCharacteristicForService(
        SAHA_BLE_CONFIG.serviceUuid,
        SAHA_BLE_CONFIG.identityUuid,
      );
      if (identityChar.value) {
        readIdentity = decodeBase64(identityChar.value);
        logStep("reading_identity", `Read Identity: "${readIdentity}"`);
      } else {
        logStep("reading_identity", "Identity characteristic was empty");
      }
    } catch (readError) {
      const msg = readError instanceof Error ? readError.message : "Read error";
      logStep("reading_identity", `Identity read warning: ${msg}`);
    }

    logStep("subscribing_tx", "Subscribing to TX characteristic notifications...");

    let receivedNotification: string | null = null;

    const notificationPromise = new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Timeout waiting for TX notification (pong)"));
      }, 7000);

      if (!connectedDevice) {
        clearTimeout(timeout);
        reject(new Error("Device disconnected before subscribing"));
        return;
      }

      txSubscription = connectedDevice.monitorCharacteristicForService(
        SAHA_BLE_CONFIG.serviceUuid,
        SAHA_BLE_CONFIG.txUuid,
        (error, characteristic) => {
          if (error) {
            clearTimeout(timeout);
            reject(new Error(`Notification error: ${error.message}`));
            return;
          }
          if (characteristic?.value) {
            const decoded = decodeBase64(characteristic.value);
            clearTimeout(timeout);
            resolve(decoded);
          }
        },
      );
    });

    logStep("writing_ping", 'Writing "ping" to RX characteristic...');
    const pingBase64 = encodeBase64("ping");
    await connectedDevice.writeCharacteristicWithResponseForService(
      SAHA_BLE_CONFIG.serviceUuid,
      SAHA_BLE_CONFIG.rxUuid,
      pingBase64,
    );
    logStep("writing_ping", 'Wrote "ping" to RX. Awaiting "pong" notification...');

    receivedNotification = await notificationPromise;
    logStep("ping_pong_success", `Received TX notification: "${receivedNotification}"`);

    // Clean disconnect
    if (txSubscription) {
      (txSubscription as Subscription).remove();
    }
    await connectedDevice.cancelConnection();

    return {
      success: true,
      readIdentity,
      receivedNotification,
      errorMessage: null,
      stepsLog,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Connection test failed";
    logStep("error", `Error: ${msg}`);

    if (txSubscription) {
      (txSubscription as Subscription).remove();
    }
    if (connectedDevice) {
      try {
        await connectedDevice.cancelConnection();
      } catch {
        // Ignore cleanup errors
      }
    }

    return {
      success: false,
      readIdentity: null,
      receivedNotification: null,
      errorMessage: msg,
      stepsLog,
    };
  }
}
