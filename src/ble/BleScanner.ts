import { PermissionsAndroid, Platform } from 'react-native';
import type { Device, Subscription } from 'react-native-ble-plx';

import { bleManager } from './BleManager';
import { SAHA_BLE_CONFIG } from './config';
import type {
  BleScanResult,
  BleScannerStatus,
  BluetoothState,
  DiscoveredDevice,
} from './types';

type BleScannerCallbacks = {
  onBluetoothStateChange: (state: BluetoothState) => void;
  onStatusChange: (status: BleScannerStatus) => void;
  onDevicesChange: (result: BleScanResult) => void;
  onError: (message: string) => void;
};

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

function normalizeUuid(value: string) {
  return value.toLowerCase();
}

function isSahaCompatibleDevice(device: Device) {
  const advertisedName = device.name ?? device.localName ?? '';
  const hasSahaName = SAHA_BLE_CONFIG.namePrefixes.some((prefix) =>
    advertisedName.startsWith(prefix),
  );
  const serviceUuids = device.serviceUUIDs ?? [];
  const hasSahaService = serviceUuids
    .map(normalizeUuid)
    .includes(normalizeUuid(SAHA_BLE_CONFIG.serviceUuid));

  return hasSahaName || hasSahaService;
}

function toDiscoveredDevice(device: Device): DiscoveredDevice {
  return {
    id: device.id,
    name: device.name ?? device.localName ?? null,
    rssi: device.rssi ?? null,
    isSahaDevice: isSahaCompatibleDevice(device),
    serviceUUIDs: device.serviceUUIDs ?? undefined,
  };
}

async function requestBlePermissions() {
  if (Platform.OS !== 'android') {
    return true;
  }

  try {
    if (Platform.Version >= 31) {
      const result = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);

      const isGranted =
        result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] ===
          PermissionsAndroid.RESULTS.GRANTED &&
        result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] ===
          PermissionsAndroid.RESULTS.GRANTED;

      if (!isGranted) {
        log('Permission denied');
      }
      return isGranted;
    }

    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );

    const isGranted = result === PermissionsAndroid.RESULTS.GRANTED;
    if (!isGranted) {
      log('Permission denied');
    }
    return isGranted;
  } catch (error) {
    log('Permission request error', error);
    return false;
  }
}

export class BleScanner {
  private callbacks: BleScannerCallbacks;

  private devices = new Map<string, DiscoveredDevice>();

  private stateSubscription: Subscription | null = null;

  private scanTimeout: ReturnType<typeof setTimeout> | null = null;

  private isScanning = false;

  constructor(callbacks: BleScannerCallbacks) {
    this.callbacks = callbacks;
  }

  listenForState() {
    this.removeStateListener();
    this.stateSubscription = bleManager.onStateChange((state) => {
      log(`Bluetooth state: ${state}`);
      this.callbacks.onBluetoothStateChange(state);
    }, true);
  }

  async startScan() {
    if (this.isScanning) {
      this.callbacks.onStatusChange('error');
      this.callbacks.onError('A Bluetooth scan is already running.');
      return;
    }

    this.callbacks.onStatusChange('checking');
    this.callbacks.onError('');
    this.devices.clear();
    this.emitDevices();

    const hasPermission = await requestBlePermissions();

    if (!hasPermission) {
      this.callbacks.onStatusChange('permission-denied');
      this.callbacks.onError(
        'Bluetooth permission was denied. Allow Bluetooth access to scan nearby devices.',
      );
      log('Permission denied');
      return;
    }

    const state = await bleManager.getState();
    log(`Bluetooth state: ${state}`);
    this.callbacks.onBluetoothStateChange(state);

    if (state === 'Unavailable') {
      this.callbacks.onStatusChange('bluetooth-unavailable');
      this.callbacks.onError(
        'SAHA BLE scanning requires a native development build (react-native-ble-plx is unavailable in Expo Go).',
      );
      return;
    }

    if (state === 'Unsupported' || state === 'Unauthorized') {
      this.callbacks.onStatusChange('bluetooth-unavailable');
      this.callbacks.onError(
        'Bluetooth is unsupported or unauthorized on this device.',
      );
      return;
    }

    if (state !== 'PoweredOn') {
      this.callbacks.onStatusChange('bluetooth-off');
      this.callbacks.onError(
        'Bluetooth is turned off. Turn on Bluetooth to scan.',
      );
      return;
    }

    try {
      this.isScanning = true;
      this.callbacks.onStatusChange('scanning');
      log('Scan started');

      await bleManager.startDeviceScan(
        null,
        { allowDuplicates: false },
        (error, scannedDevice) => {
          if (error) {
            this.callbacks.onStatusChange('error');
            this.callbacks.onError(`Scan error: ${error.message}`);
            log(`Scan error: ${error.message}`);
            void this.stopScan('error');
            return;
          }

          if (!scannedDevice) {
            return;
          }

          const discoveredDevice = toDiscoveredDevice(scannedDevice);
          this.devices.set(discoveredDevice.id, discoveredDevice);
          const displayName = discoveredDevice.name ?? 'Unknown Device';
          log(`Device discovered: ${displayName} (${discoveredDevice.id})`);
          this.emitDevices();
        },
      );

      this.scanTimeout = setTimeout(() => {
        void this.stopScan('scan-complete');
      }, SAHA_BLE_CONFIG.scanTimeoutMs);
    } catch (error) {
      this.isScanning = false;
      const errorMsg =
        error instanceof Error ? error.message : 'Unable to start BLE scan.';
      this.callbacks.onStatusChange('error');
      this.callbacks.onError(`Scan error: ${errorMsg}`);
      log(`Scan error: ${errorMsg}`);
    }
  }

  async stopScan(nextStatus: BleScannerStatus = 'scan-complete') {
    if (this.scanTimeout) {
      clearTimeout(this.scanTimeout);
      this.scanTimeout = null;
    }

    if (!this.isScanning) {
      return;
    }

    this.isScanning = false;

    try {
      await bleManager.stopDeviceScan();
      log('Scan stopped');
    } catch (error) {
      this.callbacks.onStatusChange('error');
      this.callbacks.onError('Unable to stop BLE scan cleanly.');
      log('Scan error on stop', error);
      return;
    }

    this.callbacks.onStatusChange(nextStatus);
  }

  cleanup() {
    void this.stopScan('idle');
    this.removeStateListener();
  }

  private removeStateListener() {
    this.stateSubscription?.remove();
    this.stateSubscription = null;
  }

  private emitDevices() {
    const devices = [...this.devices.values()].sort((left, right) => {
      if (left.isSahaDevice !== right.isSahaDevice) {
        return left.isSahaDevice ? -1 : 1;
      }

      return (right.rssi ?? -999) - (left.rssi ?? -999);
    });

    this.callbacks.onDevicesChange({
      devices,
      totalDeviceCount: devices.length,
    });
  }
}
