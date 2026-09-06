import { bleManager } from "./BleManager";
import {
  IDENTITY_CHARACTERISTIC_UUID,
  RX_CHARACTERISTIC_UUID,
  SAHA_SERVICE_UUID,
  TX_CHARACTERISTIC_UUID,
} from "./config";
import type { ConnectionTestState } from "./types";
import type { Characteristic, Device, Subscription } from "react-native-ble-plx";

const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function encodeUtf8(input: string): number[] {
  const bytes: number[] = [];

  for (let index = 0; index < input.length; index += 1) {
    let codePoint = input.charCodeAt(index);

    if (codePoint >= 0xd800 && codePoint <= 0xdbff) {
      const next = input.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        codePoint = 0x10000 + ((codePoint - 0xd800) << 10) + (next - 0xdc00);
        index += 1;
      } else {
        codePoint = 0xfffd;
      }
    } else if (codePoint >= 0xdc00 && codePoint <= 0xdfff) {
      codePoint = 0xfffd;
    }

    if (codePoint <= 0x7f) {
      bytes.push(codePoint);
    } else if (codePoint <= 0x7ff) {
      bytes.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f));
    } else if (codePoint <= 0xffff) {
      bytes.push(
        0xe0 | (codePoint >> 12),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    } else {
      bytes.push(
        0xf0 | (codePoint >> 18),
        0x80 | ((codePoint >> 12) & 0x3f),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    }
  }

  return bytes;
}

function decodeUtf8(bytes: number[]): string {
  let output = "";

  for (let index = 0; index < bytes.length; index += 1) {
    const first = bytes[index];
    let codePoint: number;
    let sequenceLength: number;

    if (first <= 0x7f) {
      codePoint = first;
      sequenceLength = 1;
    } else if (first >= 0xc2 && first <= 0xdf) {
      codePoint = first & 0x1f;
      sequenceLength = 2;
    } else if (first >= 0xe0 && first <= 0xef) {
      codePoint = first & 0x0f;
      sequenceLength = 3;
    } else if (first >= 0xf0 && first <= 0xf4) {
      codePoint = first & 0x07;
      sequenceLength = 4;
    } else {
      output += "\ufffd";
      continue;
    }

    if (index + sequenceLength > bytes.length) {
      output += "\ufffd";
      break;
    }

    let valid = true;
    for (let offset = 1; offset < sequenceLength; offset += 1) {
      const continuation = bytes[index + offset];
      if ((continuation & 0xc0) !== 0x80) {
        valid = false;
        break;
      }
      codePoint = (codePoint << 6) | (continuation & 0x3f);
    }

    const isOverlong =
      (sequenceLength === 2 && codePoint < 0x80) ||
      (sequenceLength === 3 && codePoint < 0x800) ||
      (sequenceLength === 4 && codePoint < 0x10000);
    const isInvalidCodePoint = codePoint > 0x10ffff || (codePoint >= 0xd800 && codePoint <= 0xdfff);

    if (!valid || isOverlong || isInvalidCodePoint) {
      output += "\ufffd";
      index += valid ? sequenceLength - 2 : 0;
      continue;
    }

    if (codePoint <= 0xffff) {
      output += String.fromCharCode(codePoint);
    } else {
      const adjusted = codePoint - 0x10000;
      output += String.fromCharCode(0xd800 + (adjusted >> 10), 0xdc00 + (adjusted & 0x3ff));
    }
    index += sequenceLength - 1;
  }

  return output;
}

export function encodeBase64(input: string): string {
  const bytes = encodeUtf8(input);
  let output = "";

  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const second = bytes[index + 1];
    const third = bytes[index + 2];

    output += BASE64_CHARS[first >> 2];
    output += BASE64_CHARS[((first & 0x03) << 4) | (second === undefined ? 0 : second >> 4)];
    output += second === undefined
      ? "="
      : BASE64_CHARS[((second & 0x0f) << 2) | (third === undefined ? 0 : third >> 6)];
    output += third === undefined ? "=" : BASE64_CHARS[third & 0x3f];
  }

  return output;
}

export function decodeBase64(input: string): string {
  if (input.length === 0) return "";
  if (input.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(input)) {
    throw new Error("Invalid Base64 input");
  }

  const bytes: number[] = [];
  for (let index = 0; index < input.length; index += 4) {
    const first = BASE64_CHARS.indexOf(input[index]);
    const second = BASE64_CHARS.indexOf(input[index + 1]);
    const third = input[index + 2] === "=" ? 0 : BASE64_CHARS.indexOf(input[index + 2]);
    const fourth = input[index + 3] === "=" ? 0 : BASE64_CHARS.indexOf(input[index + 3]);

    bytes.push((first << 2) | (second >> 4));
    if (input[index + 2] !== "=") bytes.push(((second & 0x0f) << 4) | (third >> 2));
    if (input[index + 3] !== "=") bytes.push(((third & 0x03) << 6) | fourth);
  }

  return decodeUtf8(bytes);
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
        SAHA_SERVICE_UUID,
        IDENTITY_CHARACTERISTIC_UUID,
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
        SAHA_SERVICE_UUID,
        TX_CHARACTERISTIC_UUID,
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
      SAHA_SERVICE_UUID,
      RX_CHARACTERISTIC_UUID,
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
