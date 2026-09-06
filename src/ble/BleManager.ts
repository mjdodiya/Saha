import type {
  BleError,
  Device,
  BleManager as NativeBleManager,
  ScanOptions,
  State,
  Subscription,
} from 'react-native-ble-plx';

import type { BluetoothState } from './types';

declare const require: (moduleName: string) => unknown;

type BlePlxModule = typeof import('react-native-ble-plx');

let manager: NativeBleManager | null = null;
let moduleLoadError: Error | null = null;

function log(message: string, details?: unknown) {
  if (!__DEV__) {
    return;
  }

  if (details === undefined) {
    console.log(`[BLE] ${message}`);
    return;
  }

  console.log(`[BLE] ${message}`, details);
}

function loadBleModule(): BlePlxModule | null {
  try {
    return require('react-native-ble-plx') as BlePlxModule;
  } catch (error) {
    moduleLoadError =
      error instanceof Error ? error : new Error('Unable to load BLE module');
    log('Native module unavailable', moduleLoadError.message);
    return null;
  }
}

function getNativeManager(): NativeBleManager | null {
  if (manager) {
    return manager;
  }

  const bleModule = loadBleModule();

  if (!bleModule) {
    return null;
  }

  try {
    manager = new bleModule.BleManager();
    return manager;
  } catch (error) {
    moduleLoadError =
      error instanceof Error ? error : new Error('Failed to create BleManager');
    log('Native manager creation failed', moduleLoadError.message);
    return null;
  }
}

export const bleManager = {
  getNativeManager(): NativeBleManager | null {
    return getNativeManager();
  },

  getModuleError() {
    return moduleLoadError;
  },

  async getState(): Promise<BluetoothState> {
    const nativeManager = getNativeManager();

    if (!nativeManager) {
      return 'Unavailable';
    }

    try {
      const state = await nativeManager.state();
      log(`Bluetooth state: ${state}`);
      return state;
    } catch (error) {
      moduleLoadError =
        error instanceof Error
          ? error
          : new Error('Unable to read Bluetooth state');
      log('Bluetooth state read failed', moduleLoadError.message);
      return 'Unavailable';
    }
  },

  onStateChange(
    listener: (newState: BluetoothState) => void,
    emitCurrentState = false,
  ): Subscription | null {
    const nativeManager = getNativeManager();

    if (!nativeManager) {
      if (emitCurrentState) {
        listener('Unavailable');
      }

      return null;
    }

    return nativeManager.onStateChange((newState: State) => {
      log(`Bluetooth state: ${newState}`);
      listener(newState);
    }, emitCurrentState);
  },

  onDeviceDisconnected(
    deviceId: string,
    listener: (error: BleError | null, device: Device | null) => void,
  ): Subscription | null {
    const nativeManager = getNativeManager();
    if (!nativeManager) return null;
    return nativeManager.onDeviceDisconnected(deviceId, listener);
  },

  async startDeviceScan(
    serviceUUIDs: string[] | null,
    options: ScanOptions | null,
    listener: (error: BleError | null, scannedDevice: Device | null) => void,
  ) {
    const nativeManager = getNativeManager();

    if (!nativeManager) {
      throw new Error(
        'Bluetooth native module is unavailable. Build a development/native app; Expo Go cannot run react-native-ble-plx.',
      );
    }

    await nativeManager.startDeviceScan(serviceUUIDs, options, listener);
    log('Scan started');
  },

  async stopDeviceScan() {
    const nativeManager = getNativeManager();

    if (!nativeManager) {
      return;
    }

    await nativeManager.stopDeviceScan();
    log('Scan stopped');
  },

  async requestMtu(device: Device, mtu: number): Promise<Device> {
    return device.requestMTU(mtu);
  },
};
