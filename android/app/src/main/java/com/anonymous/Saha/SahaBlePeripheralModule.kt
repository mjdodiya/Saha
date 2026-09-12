package com.anonymous.Saha

import android.Manifest
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import android.bluetooth.BluetoothGattServer
import android.bluetooth.BluetoothGattServerCallback
import android.bluetooth.BluetoothGattService
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.bluetooth.le.AdvertiseCallback
import android.bluetooth.le.AdvertiseData
import android.bluetooth.le.AdvertiseSettings
import android.bluetooth.le.BluetoothLeAdvertiser
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.ParcelUuid
import android.provider.Settings
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import org.json.JSONObject
import java.nio.charset.StandardCharsets
import java.util.UUID

class SahaBlePeripheralModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private val lock = Any()
  private val bluetoothManager =
    reactContext.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
  private val bluetoothAdapter: BluetoothAdapter?
    get() = bluetoothManager?.adapter
  private val nodeId = createNodeId()
  private val advertisingName = "SAHA-$nodeId"
  private val connectedCentrals = mutableMapOf<String, BluetoothDevice>()

  private var advertiser: BluetoothLeAdvertiser? = null
  private var gattServer: BluetoothGattServer? = null
  private var txCharacteristic: BluetoothGattCharacteristic? = null
  private var isAdvertising = false
  private var status = STATUS_STOPPED
  private var errorMessage: String? = null

  override fun getName() = MODULE_NAME

  @ReactMethod
  fun addListener(@Suppress("UNUSED_PARAMETER") eventName: String) = Unit

  @ReactMethod
  fun removeListeners(@Suppress("UNUSED_PARAMETER") count: Double) = Unit

  @ReactMethod
  fun getNodeId(promise: Promise) = promise.resolve(nodeId)

  @ReactMethod
  fun getPeripheralStatus(promise: Promise) = promise.resolve(statusMap())

  @ReactMethod
  fun startPeripheral(promise: Promise) {
    synchronized(lock) {
      if (!hasPermissions()) {
        fail(STATUS_ADVERTISING_FAILED, "Bluetooth advertise/connect permission is not granted")
        promise.reject("PERMISSION_DENIED", errorMessage)
        return
      }
      val adapter = bluetoothAdapter
      if (adapter == null) {
        fail(STATUS_UNAVAILABLE, "Bluetooth is not supported on this device")
        promise.reject("BLUETOOTH_UNAVAILABLE", errorMessage)
        return
      }
      if (!adapter.isEnabled) {
        fail(STATUS_BLUETOOTH_OFF, "Bluetooth is turned off")
        promise.reject("BLUETOOTH_OFF", errorMessage)
        return
      }
      if (isAdvertising && gattServer != null) {
        promise.resolve(statusMap())
        return
      }

      status = STATUS_INITIALIZING
      errorMessage = null
      emitState()
      try {
        val server = bluetoothManager?.openGattServer(reactContext, gattServerCallback)
          ?: throw IllegalStateException("Unable to open the Bluetooth GATT server")
        gattServer = server
        addSahaService(server)

        val leAdvertiser = adapter.bluetoothLeAdvertiser
          ?: throw IllegalStateException("BLE advertising is not supported on this device")
        advertiser = leAdvertiser
        leAdvertiser.startAdvertising(advertiseSettings(), advertiseData(), advertiseCallback)
        promise.resolve(statusMap())
      } catch (error: Exception) {
        cleanupPeripheral()
        fail(STATUS_ADVERTISING_FAILED, error.message ?: "Unable to start SAHA peripheral")
        promise.reject("PERIPHERAL_START_FAILED", errorMessage, error)
      }
    }
  }

  @ReactMethod
  fun stopPeripheral(promise: Promise) {
    synchronized(lock) {
      cleanupPeripheral()
      status = STATUS_STOPPED
      errorMessage = null
      emitState()
      promise.resolve(statusMap())
    }
  }

  @ReactMethod
  fun sendNotification(payload: String, promise: Promise) {
    synchronized(lock) {
      if (!hasConnectPermission()) {
        promise.reject("PERMISSION_DENIED", "Bluetooth connect permission is not granted")
        return
      }
      if (bluetoothAdapter?.isEnabled != true) {
        promise.resolve(false)
        return
      }
      val server = gattServer
      val tx = txCharacteristic
      if (server == null || tx == null || connectedCentrals.isEmpty()) {
        promise.resolve(false)
        return
      }
      tx.value = encodeTransportPayload(payload)
      val queued = connectedCentrals.values.toList().fold(false) { sent, central ->
        server.notifyCharacteristicChanged(central, tx, false) || sent
      }
      promise.resolve(queued)
    }
  }

  private fun addSahaService(server: BluetoothGattServer) {
    val identity = BluetoothGattCharacteristic(
      SahaBleConfig.identityCharacteristicUuid,
      BluetoothGattCharacteristic.PROPERTY_READ,
      BluetoothGattCharacteristic.PERMISSION_READ,
    )
    val rx = BluetoothGattCharacteristic(
      SahaBleConfig.rxCharacteristicUuid,
      BluetoothGattCharacteristic.PROPERTY_WRITE or BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE,
      BluetoothGattCharacteristic.PERMISSION_WRITE,
    )
    val tx = BluetoothGattCharacteristic(
      SahaBleConfig.txCharacteristicUuid,
      BluetoothGattCharacteristic.PROPERTY_NOTIFY,
      BluetoothGattCharacteristic.PERMISSION_READ,
    )
    tx.addDescriptor(BluetoothGattDescriptor(
      SahaBleConfig.clientCharacteristicConfigurationUuid,
      BluetoothGattDescriptor.PERMISSION_READ or BluetoothGattDescriptor.PERMISSION_WRITE,
    ))
    val service = BluetoothGattService(
      SahaBleConfig.serviceUuid,
      BluetoothGattService.SERVICE_TYPE_PRIMARY,
    ).apply {
      addCharacteristic(identity)
      addCharacteristic(rx)
      addCharacteristic(tx)
    }
    check(server.addService(service)) { "Unable to register SAHA GATT service" }
    txCharacteristic = tx
  }

  private val gattServerCallback = object : BluetoothGattServerCallback() {
    override fun onConnectionStateChange(device: BluetoothDevice, statusCode: Int, newState: Int) {
      synchronized(lock) {
        if (newState == BluetoothProfile.STATE_CONNECTED) {
          connectedCentrals[device.address] = device
          status = STATUS_CONNECTED
        } else {
          connectedCentrals.remove(device.address)
          status = if (isAdvertising) STATUS_ADVERTISING else STATUS_STOPPED
        }
        emitCentralConnection(device.address, newState == BluetoothProfile.STATE_CONNECTED)
        emitState()
      }
    }

    override fun onCharacteristicReadRequest(
      device: BluetoothDevice,
      requestId: Int,
      offset: Int,
      characteristic: BluetoothGattCharacteristic,
    ) {
      if (characteristic.uuid != SahaBleConfig.identityCharacteristicUuid) {
        gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_REQUEST_NOT_SUPPORTED, offset, null)
        return
      }
      // react-native-ble-plx exposes raw GATT bytes to JS as Base64. Keep the
      // characteristic value itself UTF-8 so it is encoded exactly once.
      val value = encodeTransportPayload(advertisingName)
      val response = if (offset <= value.size) value.copyOfRange(offset, value.size) else byteArrayOf()
      gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, response)
    }

    override fun onCharacteristicWriteRequest(
      device: BluetoothDevice,
      requestId: Int,
      characteristic: BluetoothGattCharacteristic,
      preparedWrite: Boolean,
      responseNeeded: Boolean,
      offset: Int,
      value: ByteArray,
    ) {
      if (characteristic.uuid != SahaBleConfig.rxCharacteristicUuid || preparedWrite || offset != 0) {
        if (responseNeeded) gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_REQUEST_NOT_SUPPORTED, offset, null)
        return
      }
      if (responseNeeded) gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, null)
      val payload = decodeTransportPayload(value)
      emitDataReceived(device.address, payload)
      createProtocolPong(payload)?.let(::notifyCentrals)
    }

    override fun onDescriptorWriteRequest(
      device: BluetoothDevice,
      requestId: Int,
      descriptor: BluetoothGattDescriptor,
      preparedWrite: Boolean,
      responseNeeded: Boolean,
      offset: Int,
      value: ByteArray,
    ) {
      val isTxCccd = descriptor.uuid == SahaBleConfig.clientCharacteristicConfigurationUuid &&
        descriptor.characteristic.uuid == SahaBleConfig.txCharacteristicUuid
      if (isTxCccd && !preparedWrite && offset == 0) {
        descriptor.value = value
        if (responseNeeded) gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, value)
      } else if (responseNeeded) {
        gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_REQUEST_NOT_SUPPORTED, offset, null)
      }
    }
  }

  private val advertiseCallback = object : AdvertiseCallback() {
    override fun onStartSuccess(settingsInEffect: AdvertiseSettings) {
      synchronized(lock) {
        isAdvertising = true
        status = if (connectedCentrals.isEmpty()) STATUS_ADVERTISING else STATUS_CONNECTED
        errorMessage = null
        emitState()
      }
    }

    override fun onStartFailure(errorCode: Int) {
      synchronized(lock) {
        cleanupPeripheral()
        fail(STATUS_ADVERTISING_FAILED, "BLE advertising failed (code $errorCode)")
      }
    }
  }

  private fun cleanupPeripheral() {
    if (hasAdvertisePermission()) advertiser?.stopAdvertising(advertiseCallback)
    advertiser = null
    gattServer?.close()
    gattServer = null
    txCharacteristic = null
    connectedCentrals.clear()
    isAdvertising = false
  }

  private fun notifyCentrals(payload: String): Boolean {
    val server = gattServer ?: return false
    val tx = txCharacteristic ?: return false
    tx.value = encodeTransportPayload(payload)
    return connectedCentrals.values.toList().fold(false) { sent, central ->
      server.notifyCharacteristicChanged(central, tx, false) || sent
    }
  }

  private fun advertiseSettings() = AdvertiseSettings.Builder()
    .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
    .setConnectable(true)
    .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_HIGH)
    .build()

  private fun advertiseData() = AdvertiseData.Builder()
    .addServiceUuid(ParcelUuid(SahaBleConfig.serviceUuid))
    // Do not change the device-wide Bluetooth name. Discovery identifies SAHA by service UUID.
    .setIncludeDeviceName(false)
    .build()

  private fun statusMap(): WritableMap = Arguments.createMap().apply {
    putString("status", status)
    putString("nodeId", nodeId)
    putString("advertisingName", advertisingName)
    if (errorMessage == null) putNull("errorMessage") else putString("errorMessage", errorMessage)
  }

  private fun emitState() = emit("onPeripheralStateChange", statusMap())

  private fun emitCentralConnection(deviceId: String, connected: Boolean) = emit(
    "onCentralConnected",
    Arguments.createMap().apply {
      putString("deviceId", deviceId)
      putBoolean("connected", connected)
    },
  )

  private fun emitDataReceived(deviceId: String, payload: String) = emit(
    "onDataReceived",
    Arguments.createMap().apply {
      putString("deviceId", deviceId)
      putString("payload", payload)
    },
  )

  private fun emit(eventName: String, payload: WritableMap) {
    reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(eventName, payload)
  }

  private fun fail(nextStatus: String, message: String) {
    status = nextStatus
    errorMessage = message
    emitState()
  }

  private fun hasPermissions() = hasAdvertisePermission() && hasConnectPermission()

  private fun hasAdvertisePermission() = Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
    reactContext.checkSelfPermission(Manifest.permission.BLUETOOTH_ADVERTISE) == PackageManager.PERMISSION_GRANTED

  private fun hasConnectPermission() = Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
    reactContext.checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED

  private fun createNodeId(): String {
    val androidId = Settings.Secure.getString(reactContext.contentResolver, Settings.Secure.ANDROID_ID)
      ?: UUID.randomUUID().toString()
    return androidId.takeLast(4).uppercase()
  }

  private fun encodeTransportPayload(payload: String): ByteArray =
    payload.toByteArray(StandardCharsets.UTF_8)

  private fun decodeTransportPayload(value: ByteArray): String =
    String(value, StandardCharsets.UTF_8)

  // Ping/pong is part of the established SAHA GATT contract, not a chat feature.
  private fun createProtocolPong(payload: String): String? {
    return try {
      val message = JSONObject(payload)
      if (message.optString("type") != "ping") return null
      val id = message.optString("id")
      if (id.isEmpty()) return null
      JSONObject().put("type", "pong").put("id", id).toString()
    } catch (_: Exception) {
      null
    }
}

  private companion object {
    const val MODULE_NAME = "SahaBlePeripheral"
    const val STATUS_STOPPED = "Stopped"
    const val STATUS_INITIALIZING = "Initializing"
    const val STATUS_ADVERTISING = "Advertising"
    const val STATUS_ADVERTISING_FAILED = "Advertising Failed"
    const val STATUS_CONNECTED = "Connected"
    const val STATUS_BLUETOOTH_OFF = "Bluetooth Off"
    const val STATUS_UNAVAILABLE = "Unavailable"
  }
}
