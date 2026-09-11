package com.anonymous.Saha

import java.util.UUID

/**
 * Android half of the SAHA BLE GATT contract.
 *
 * Keep these identifiers synchronized with src/ble/config.ts. Android code cannot
 * import TypeScript, so this small native contract is intentionally explicit.
 */
object SahaBleConfig {
  val serviceUuid: UUID = UUID.fromString("a3c8e001-4f1e-4d89-9a70-3c1d9f8e4b01")
  val identityCharacteristicUuid: UUID = UUID.fromString("a3c8e002-4f1e-4d89-9a70-3c1d9f8e4b01")
  val rxCharacteristicUuid: UUID = UUID.fromString("a3c8e003-4f1e-4d89-9a70-3c1d9f8e4b01")
  val txCharacteristicUuid: UUID = UUID.fromString("a3c8e004-4f1e-4d89-9a70-3c1d9f8e4b01")
  val clientCharacteristicConfigurationUuid: UUID =
    UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")
}
