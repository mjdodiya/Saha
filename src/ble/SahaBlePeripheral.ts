import { NativeEventEmitter, NativeModules, PermissionsAndroid, Platform } from "react-native";
import type { PeripheralInfo, PeripheralStatus } from "./types";

const { SahaBlePeripheral } = NativeModules;

const peripheralEmitter = SahaBlePeripheral
  ? new NativeEventEmitter(SahaBlePeripheral)
  : null;

function log(message: string, details?: unknown) {
  if (!__DEV__) {
    return;
  }
  if (details === undefined) {
    console.log(`[SAHA-PERIPHERAL-JS] ${message}`);
    return;
  }
  console.log(`[SAHA-PERIPHERAL-JS] ${message}`, details);
}

export async function requestPeripheralPermissions(): Promise<boolean> {
  if (Platform.OS !== "android") {
    return true;
  }

  try {
    if (Platform.Version >= 31) {
      const permissions = [
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      ];

      const result = await PermissionsAndroid.requestMultiple(permissions);

      const isGranted =
        result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE] ===
          PermissionsAndroid.RESULTS.GRANTED &&
        result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] ===
          PermissionsAndroid.RESULTS.GRANTED;

      log(`Android 12+ advertising permissions granted: ${isGranted}`);
      return isGranted;
    }

    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );
    const isGranted = result === PermissionsAndroid.RESULTS.GRANTED;
    log(`Location permission granted: ${isGranted}`);
    return isGranted;
  } catch (error) {
    log("Permission request error", error);
    return false;
  }
}

export const sahaBlePeripheral = {
  isAvailable(): boolean {
    return Platform.OS === "android" && Boolean(SahaBlePeripheral);
  },

  async getStatus(): Promise<PeripheralInfo> {
    if (!this.isAvailable()) {
      return {
        status: "Unavailable",
        nodeId: "UNKNOWN",
        advertisingName: "SAHA-UNKNOWN",
        errorMessage: "Native SahaBlePeripheral module is unavailable (requires native Android build)",
      };
    }
    return await SahaBlePeripheral.getPeripheralStatus();
  },

  async getNodeId(): Promise<string> {
    if (!this.isAvailable()) {
      return "UNKNOWN";
    }
    return await SahaBlePeripheral.getNodeId();
  },

  async startPeripheral(): Promise<PeripheralInfo> {
    if (!this.isAvailable()) {
      log("Native module unavailable for startPeripheral");
      return {
        status: "Unavailable",
        nodeId: "UNKNOWN",
        advertisingName: "SAHA-UNKNOWN",
        errorMessage: "Native module unavailable",
      };
    }

    const hasPerms = await requestPeripheralPermissions();
    if (!hasPerms) {
      log("Bluetooth advertising permission denied");
      return {
        status: "Advertising Failed",
        nodeId: await this.getNodeId(),
        advertisingName: `SAHA-${await this.getNodeId()}`,
        errorMessage: "Bluetooth advertising permission denied",
      };
    }

    try {
      await SahaBlePeripheral.startPeripheral();
      return await this.getStatus();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to start peripheral";
      log("startPeripheral error", msg);
      return {
        status: "Advertising Failed",
        nodeId: await this.getNodeId(),
        advertisingName: `SAHA-${await this.getNodeId()}`,
        errorMessage: msg,
      };
    }
  },

  async stopPeripheral(): Promise<PeripheralInfo> {
    if (!this.isAvailable()) {
      return {
        status: "Stopped",
        nodeId: "UNKNOWN",
        advertisingName: "SAHA-UNKNOWN",
      };
    }
    try {
      await SahaBlePeripheral.stopPeripheral();
      return await this.getStatus();
    } catch (error) {
      log("stopPeripheral error", error);
      return await this.getStatus();
    }
  },

  async sendNotification(payload: string): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }
    try {
      return await SahaBlePeripheral.sendNotification(payload);
    } catch (error) {
      log("sendNotification error", error);
      return false;
    }
  },

  onStateChange(listener: (info: PeripheralInfo) => void) {
    if (!peripheralEmitter) {
      return { remove: () => {} };
    }
    const sub = peripheralEmitter.addListener("onPeripheralStateChange", (data) => {
      log("State change event", data);
      listener(data);
    });
    return sub;
  },

  onDataReceived(listener: (event: { deviceId: string; payload: string }) => void) {
    if (!peripheralEmitter) {
      return { remove: () => {} };
    }
    const sub = peripheralEmitter.addListener("onDataReceived", (data) => {
      log("Data received event", data);
      listener(data);
    });
    return sub;
  },

  onCentralConnected(listener: (event: { deviceId: string; connected: boolean }) => void) {
    if (!peripheralEmitter) {
      return { remove: () => {} };
    }
    const sub = peripheralEmitter.addListener("onCentralConnected", (data) => {
      log("Central connected event", data);
      listener(data);
    });
    return sub;
  },
};
