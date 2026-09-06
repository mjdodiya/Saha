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
import android.bluetooth.le.AdvertiseCallback
import android.bluetooth.le.AdvertiseData
import android.bluetooth.le.AdvertiseSettings
import android.bluetooth.le.BluetoothLeAdvertiser
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.ParcelUuid
import android.provider.Settings
import android.util.Base64
import org.json.JSONObject
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import java.nio.charset.StandardCharsets
import java.util.UUID

class SahaBlePeripheralModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private val bluetoothManager: BluetoothManager? =
    reactContext.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
  private val bluetoothAdapter: BluetoothAdapter?
    get() = bluetoothManager?.adapter
  private val nodeId = createNodeId()
  private val advertisingName = "SAHA-$nodeId"
  private val connectedCentrals = mutableMapOf<String, BluetoothDevice>()

  private var advertiser: BluetoothLeAdvertiser? = null
  private var gattServer: BluetoothGattServer? = null
  private var txCharacteristic: BluetoothGattCharacteristic? = null
  private var originalBluetoothName: String? = null
  private var isAdvertising = false
  private var status = STATUS_STOPPED
  private var errorMessage: String? = null

  private val serviceUuid = UUID.fromString(BuildConfig.SAHA_SERVICE_UUID)
  private val identityUuid = UUID.fromString(BuildConfig.SAHA_IDENTITY_CHARACTERISTIC_UUID)
  private val rxUuid = UUID.fromString(BuildConfig.SAHA_RX_CHARACTERISTIC_UUID)
  private val txUuid = UUID.fromString(BuildConfig.SAHA_TX_CHARACTERISTIC_UUID)
  private val cccdUuid = UUID.fromString(CCCD_UUID)

  override fun getName() = MODULE_NAME

  @ReactMethod
  fun addListener(@Suppress("UNUSED_PARAMETER") eventName: String) = Unit

  @ReactMethod
  fun removeListeners(@Suppress("UNUSED_PARAMETER") count: Double) = Unit

  @ReactMethod
  fun getNodeId(promise: Promise) {
    promise.resolve(nodeId)
  }

  @ReactMethod
  fun getPeripheralStatus(promise: Promise) {
    promise.resolve(statusMap())
  }

  @ReactMethod
  fun startPeripheral(promise: Promise) {
    if (!hasBluetoothPermissions()) {
      fail(STATUS_ADVERTISING_FAILED, "Bluetooth permission is not granted")
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
      configureBluetoothName(adapter)
      val server = bluetoothManager?.openGattServer(reactContext, gattServerCallback)
      if (server == null) {
        throw IllegalStateException("Unable to open the Bluetooth GATT server")
      }
      gattServer = server
      addSahaService(server)

      val leAdvertiser = adapter.bluetoothLeAdvertiser
        ?: throw IllegalStateException("BLE advertising is not supported on this device")
      advertiser = leAdvertiser
      leAdvertiser.startAdvertising(advertiseSettings(), advertiseData(), advertiseCallback)
      // Advertising becomes active in onStartSuccess.
      promise.resolve(statusMap())
    } catch (error: Exception) {
      cleanupPeripheral()
      fail(STATUS_ADVERTISING_FAILED, error.message ?: "Unable to start SAHA peripheral")
      promise.reject("PERIPHERAL_START_FAILED", errorMessage, error)
    }
  }

  @ReactMethod
  fun stopPeripheral(promise: Promise) {
    cleanupPeripheral()
    status = STATUS_STOPPED
    errorMessage = null
    emitState()
    promise.resolve(statusMap())
  }

  @ReactMethod
  fun sendNotification(payload: String, promise: Promise) {
    val server = gattServer
    val tx = txCharacteristic
    if (server == null || tx == null || connectedCentrals.isEmpty()) {
      promise.resolve(false)
      return
    }

    tx.value = encodeTransportPayload(payload)
    var notificationQueued = false
    connectedCentrals.values.toList().forEach { central ->
      notificationQueued = server.notifyCharacteristicChanged(central, tx, false) || notificationQueued
    }
    promise.resolve(notificationQueued)
  }

  private fun addSahaService(server: BluetoothGattServer) {
    val identity = BluetoothGattCharacteristic(
      identityUuid,
      BluetoothGattCharacteristic.PROPERTY_READ,
      BluetoothGattCharacteristic.PERMISSION_READ,
    )
    val rx = BluetoothGattCharacteristic(
      rxUuid,
      BluetoothGattCharacteristic.PROPERTY_WRITE or BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE,
      BluetoothGattCharacteristic.PERMISSION_WRITE,
    )
    val tx = BluetoothGattCharacteristic(
      txUuid,
      BluetoothGattCharacteristic.PROPERTY_NOTIFY,
      BluetoothGattCharacteristic.PERMISSION_READ,
    )
    tx.addDescriptor(
      BluetoothGattDescriptor(
        cccdUuid,
        BluetoothGattDescriptor.PERMISSION_READ or BluetoothGattDescriptor.PERMISSION_WRITE,
      ),
    )

    check(server.addService(BluetoothGattService(serviceUuid, BluetoothGattService.SERVICE_TYPE_PRIMARY).apply {
      addCharacteristic(identity)
      addCharacteristic(rx)
      addCharacteristic(tx)
    })) { "Unable to register SAHA GATT service" }
    txCharacteristic = tx
  }

  private val gattServerCallback = object : BluetoothGattServerCallback() {
    override fun onConnectionStateChange(device: BluetoothDevice, statusCode: Int, newState: Int) {
      if (newState == BluetoothProfileState.CONNECTED) {
        connectedCentrals[device.address] = device
        status = STATUS_CONNECTED
      } else {
        connectedCentrals.remove(device.address)
        status = if (isAdvertising) STATUS_ADVERTISING else STATUS_STOPPED
      }
      emitCentralConnection(device.address, newState == BluetoothProfileState.CONNECTED)
      emitState()
    }

    override fun onCharacteristicReadRequest(
      device: BluetoothDevice,
      requestId: Int,
      offset: Int,
      characteristic: BluetoothGattCharacteristic,
    ) {
      if (characteristic.uuid != identityUuid) {
        gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_REQUEST_NOT_SUPPORTED, offset, null)
        return
      }
      val identity = advertisingName.toByteArray(StandardCharsets.UTF_8)
      val value = if (offset <= identity.size) identity.copyOfRange(offset, identity.size) else byteArrayOf()
      gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, value)
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
      if (characteristic.uuid != rxUuid || preparedWrite || offset != 0) {
        if (responseNeeded) {
          gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_REQUEST_NOT_SUPPORTED, offset, null)
        }
        return
      }
      if (responseNeeded) {
        gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, null)
      }

      val payload = decodeTransportPayload(value)
      emitDataReceived(device.address, payload)
      if (payload == PING_PAYLOAD) {
        notifyCentrals(PONG_PAYLOAD)
      } else {
        createProtocolPong(payload)?.let(::notifyCentrals)
      }
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
      val isTxCccd = descriptor.uuid == cccdUuid && descriptor.characteristic.uuid == txUuid
      if (isTxCccd && !preparedWrite && offset == 0) {
        descriptor.value = value
        if (responseNeeded) {
          gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, value)
        }
        return
      }
      if (responseNeeded) {
        gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_REQUEST_NOT_SUPPORTED, offset, null)
      }
    }
  }

  private val advertiseCallback = object : AdvertiseCallback() {
    override fun onStartSuccess(settingsInEffect: AdvertiseSettings) {
      isAdvertising = true
      status = if (connectedCentrals.isEmpty()) STATUS_ADVERTISING else STATUS_CONNECTED
      errorMessage = null
      emitState()
    }

    override fun onStartFailure(errorCode: Int) {
      cleanupPeripheral()
      fail(STATUS_ADVERTISING_FAILED, "BLE advertising failed (code $errorCode)")
    }
  }

  private fun notifyCentrals(payload: String): Boolean {
    val server = gattServer ?: return false
    val tx = txCharacteristic ?: return false
    tx.value = encodeTransportPayload(payload)
    return connectedCentrals.values.toList().fold(false) { sent, central ->
      server.notifyCharacteristicChanged(central, tx, false) || sent
    }
  }

  @Suppress("DEPRECATION")
  private fun configureBluetoothName(adapter: BluetoothAdapter) {
    if (adapter.name == advertisingName) return
    originalBluetoothName = adapter.name
    adapter.name = advertisingName
  }

  @Suppress("DEPRECATION")
  private fun cleanupPeripheral() {
    advertiser?.stopAdvertising(advertiseCallback)
    advertiser = null
    gattServer?.close()
    gattServer = null
    txCharacteristic = null
    connectedCentrals.clear()
    isAdvertising = false
    originalBluetoothName?.let { bluetoothAdapter?.name = it }
    originalBluetoothName = null
  }

  private fun advertiseSettings() = AdvertiseSettings.Builder()
    .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
    .setConnectable(true)
    .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_HIGH)
    .build()

  private fun advertiseData() = AdvertiseData.Builder()
    .addServiceUuid(ParcelUuid(serviceUuid))
    .setIncludeDeviceName(true)
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
    reactContext
      .getJSModule(com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(eventName, payload)
  }

  private fun fail(nextStatus: String, message: String) {
    status = nextStatus
    errorMessage = message
    emitState()
  }

  private fun hasBluetoothPermissions(): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
    return reactContext.checkSelfPermission(Manifest.permission.BLUETOOTH_ADVERTISE) == PackageManager.PERMISSION_GRANTED &&
      reactContext.checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED
  }

  private fun createNodeId(): String {
    val androidId = Settings.Secure.getString(reactContext.contentResolver, Settings.Secure.ANDROID_ID)
      ?: UUID.randomUUID().toString()
    return androidId.takeLast(4).uppercase()
  }

  private fun encodeTransportPayload(payload: String): ByteArray =
    Base64.encode(payload.toByteArray(StandardCharsets.UTF_8), Base64.NO_WRAP)

  private fun decodeTransportPayload(value: ByteArray): String = try {
    String(Base64.decode(value, Base64.DEFAULT), StandardCharsets.UTF_8)
  } catch (_: IllegalArgumentException) {
    String(value, StandardCharsets.UTF_8)
  }

  private fun createProtocolPong(payload: String): String? = try {
    val message = JSONObject(payload)
    if (message.optString("type") != "ping") return null
    val id = message.optString("id")
    if (id.isEmpty()) return null
    JSONObject().put("type", "pong").put("id", id).toString()
  } catch (_: Exception) {
    null
  }

  private object BluetoothProfileState {
    const val CONNECTED = 2
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
    const val PING_PAYLOAD = "ping"
    const val PONG_PAYLOAD = "pong"
    const val CCCD_UUID = "00002902-0000-1000-8000-00805f9b34fb"
  }
}
