import { useEffect, useState } from "react";
import { Stack, useRouter } from "expo-router";
import * as Location from "expo-location";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  StatusBar,
  Text,
  type StyleProp,
  type ViewStyle,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type {
  BleScannerStatus,
  BluetoothState,
  DiscoveredDevice,
  PeripheralStatus,
} from "@/ble/types";
import { useBleScanner } from "@/hooks/useBleScanner";
import { useBlePeripheral } from "@/hooks/useBlePeripheral";

type ActivityTone = "critical" | "warning" | "community";

type NearbyActivity = {
  id: string;
  label: string;
  title: string;
  meta: string;
  tone: ActivityTone;
};

export default function Index() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isCompact = width < 370;

  const {
    bluetoothState,
    status,
    devices,
    totalDeviceCount,
    errorMessage,
    isScanning,
    startScan,
    stopScan,
  } = useBleScanner();

  const {
    status: peripheralStatus,
    nodeId,
    advertisingName,
    errorMessage: peripheralError,
  } = useBlePeripheral();

  const sahaDevicesCount = devices.filter((d) => d.isSahaDevice).length;

  const handleOpenScanner = () => {
    router.push("/scanner");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" backgroundColor="#F6F3EC" />
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isCompact && styles.scrollContentCompact,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Header identity={nodeId || "N7"} />

        <NetworkStatusCard
          isCompact={isCompact}
          status={status}
          bluetoothState={bluetoothState}
          peripheralStatus={peripheralStatus}
          advertisingName={advertisingName}
          peripheralError={peripheralError}
          sahaCount={sahaDevicesCount}
          totalCount={totalDeviceCount}
          errorMessage={errorMessage}
          onPressCard={handleOpenScanner}
        />

        <PrimaryAction
          isCompact={isCompact}
          isScanning={isScanning}
          onOpenScanner={handleOpenScanner}
        />

        <SectionHeader
          title="Nearby Devices"
          actionText={
            devices.length > 0
              ? `${sahaDevicesCount} SAHA (${totalDeviceCount} BLE total)`
              : "BLE discovery layer"
          }
        />

        <View style={styles.activityList}>
          {devices.length > 0 ? (
            devices.map((device) => (
              <DiscoveredDeviceCard
                key={device.id}
                device={device}
                onPress={handleOpenScanner}
              />
            ))
          ) : (
            <EmptyDevicesView
              isScanning={isScanning}
              status={status}
              errorMessage={errorMessage}
              onOpenScanner={handleOpenScanner}
            />
          )}
        </View>

        <View style={styles.contextGrid}>
          <MeshVisualization activeNodesCount={sahaDevicesCount} />
          <LocationContext />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({ identity }: { identity: string }) {
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.brand}>SAHA</Text>
        <Text style={styles.headerSubtitle}>Local communication layer</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Device identity ${identity}`}
        style={styles.identityButton}
      >
        <View style={styles.identitySignal} />
        <Text style={styles.identityText}>{identity}</Text>
      </Pressable>
    </View>
  );
}

function NetworkStatusCard({
  isCompact,
  status,
  bluetoothState,
  peripheralStatus,
  advertisingName,
  peripheralError,
  sahaCount,
  totalCount,
  errorMessage,
  onPressCard,
}: {
  isCompact: boolean;
  status: BleScannerStatus;
  bluetoothState: BluetoothState;
  peripheralStatus: PeripheralStatus;
  advertisingName: string;
  peripheralError?: string | null;
  sahaCount: number;
  totalCount: number;
  errorMessage: string;
  onPressCard: () => void;
}) {
  let badgeText: string = peripheralStatus;
  let badgeColor = "#55D187";
  let statusText = "Ready to discover nearby nodes";
  let subText = `Broadcasting as ${advertisingName}`;

  if (peripheralStatus === "Advertising") {
    badgeText = "Advertising";
    badgeColor = "#10B981";
    statusText = `Broadcasting BLE service (${advertisingName})`;
    subText = "Peripheral active & discoverable";
  } else if (peripheralStatus === "Connected") {
    badgeText = "Connected";
    badgeColor = "#10B981";
    statusText = `Central node connected to ${advertisingName}`;
    subText = "GATT server active";
  } else if (peripheralStatus === "Advertising Failed") {
    badgeText = "Adv Failed";
    badgeColor = "#EF4444";
    statusText = peripheralError || "BLE advertising failed";
    subText = "Check Bluetooth permissions & hardware";
  } else if (peripheralStatus === "Initializing") {
    badgeText = "Initializing";
    badgeColor = "#60A5FA";
    statusText = "Initializing BLE peripheral & GATT server";
    subText = "Starting advertiser...";
  } else if (status === "bluetooth-off" || bluetoothState === "PoweredOff" || peripheralStatus === "Bluetooth Off") {
    badgeText = "Bluetooth Off";
    badgeColor = "#F59E0B";
    statusText = "Bluetooth is turned off";
    subText = "Turn on Bluetooth to advertise & scan";
  } else if (status === "scanning") {
    badgeText = "Scanning...";
    badgeColor = "#60A5FA";
    statusText = "Scanning for nearby BLE devices";
    subText = `Searching for nodes (Me: ${advertisingName})`;
  } else if (status === "permission-denied") {
    badgeText = "No Access";
    badgeColor = "#F59E0B";
    statusText = "Bluetooth permissions required";
    subText = errorMessage || "Grant location/BLE access";
  } else if (
    status === "bluetooth-unavailable" ||
    bluetoothState === "Unavailable" ||
    peripheralStatus === "Unavailable"
  ) {
    badgeText = "Unavailable";
    badgeColor = "#EF4444";
    statusText = "Bluetooth native module unavailable";
    subText = "Native dev build required for BLE hardware";
  } else if (status === "scan-complete") {
    badgeText = (peripheralStatus as string) === "Advertising" ? "Advertising" : "Scan complete";
    badgeColor = "#10B981";
    statusText = `Discovered ${sahaCount} SAHA node${
      sahaCount === 1 ? "" : "s"
    }`;
    subText = `${totalCount} total BLE signal${
      totalCount === 1 ? "" : "s"
    } detected`;
  } else if (status === "error") {
    badgeText = "Scan error";
    badgeColor = "#EF4444";
    statusText = errorMessage || "BLE scan failed";
    subText = "Tap scan to try again";
  } else if (sahaCount > 0) {
    statusText = `${sahaCount} node${
      sahaCount === 1 ? "" : "s"
    } connected in local range`;
  }

  return (
    <Pressable onPress={onPressCard} style={styles.networkCard}>
      <View style={styles.networkTopRow}>
        <View style={styles.statusTitleGroup}>
          <View style={styles.statusBadge}>
            <View
              style={[styles.statusPulse, { backgroundColor: badgeColor }]}
            />
            <Text style={styles.statusBadgeText}>{badgeText}</Text>
          </View>
          <Text style={styles.networkTitle}>Local Network</Text>
          <Text style={styles.networkStatus}>{statusText}</Text>
        </View>

        <View style={styles.nodeCountBlock}>
          <Text style={styles.nodeCount}>{sahaCount}</Text>
          <Text style={styles.nodeCountLabel}>nodes</Text>
        </View>
      </View>

      <View style={styles.networkBottomRow}>
        <View style={styles.offlineMode}>
          <View style={styles.offlineDot} />
          <Text style={styles.offlineText}>{subText}</Text>
        </View>

        {!isCompact && (
          <View style={styles.miniMesh} accessibilityLabel="Mesh connection">
            <View style={[styles.miniMeshLine, styles.miniLineOne]} />
            <View style={[styles.miniMeshLine, styles.miniLineTwo]} />
            <View style={[styles.miniNode, styles.miniNodeLeft]} />
            <View
              style={[
                styles.miniNode,
                styles.miniNodeCenter,
                { backgroundColor: badgeColor },
              ]}
            />
            <View style={[styles.miniNode, styles.miniNodeRight]} />
          </View>
        )}
      </View>
    </Pressable>
  );
}

function PrimaryAction({
  isCompact,
  isScanning,
  onOpenScanner,
}: {
  isCompact: boolean;
  isScanning: boolean;
  onOpenScanner: () => void;
}) {
  const router = useRouter();
  return (
    <View style={styles.actionsCard}>
      <Pressable
        accessibilityRole="button"
        onPress={onOpenScanner}
        style={({ pressed }) => [
          styles.primaryButton,
          isScanning && styles.primaryButtonScanning,
          pressed && styles.buttonPressed,
        ]}
      >
        <View style={styles.primaryIcon}>
          {isScanning ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryIconText}>📡</Text>
          )}
        </View>
        <View style={styles.primaryCopy}>
          <Text style={styles.primaryButtonText}>
            {isScanning ? "Scanning Area..." : "Scan for nearby devices"}
          </Text>
          <Text style={styles.primaryButtonSubtext} numberOfLines={1}>
            {isScanning
              ? "Open radar scanner & live discovery..."
              : "Discover nearby SAHA nodes & BLE devices"}
          </Text>
        </View>
      </Pressable>

      <View
        style={[
          styles.secondaryActions,
          isCompact && styles.secondaryActionsCompact,
        ]}
      >
        <SecondaryAction
          label="BLE Chat"
          onPress={() => router.push("/chat" as any)}
        />
        <SecondaryAction label="Create channel" />
      </View>
    </View>
  );
}

function SecondaryAction({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondaryButton,
        pressed && styles.buttonPressed,
      ]}
    >
      <Text style={styles.secondaryButtonText} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function SectionHeader({
  title,
  actionText,
}: {
  title: string;
  actionText: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionMeta}>{actionText}</Text>
    </View>
  );
}

function DiscoveredDeviceCard({
  device,
  onPress,
}: {
  device: DiscoveredDevice;
  onPress: () => void;
}) {
  const isSaha = device.isSahaDevice;
  const name = device.name ?? (isSaha ? "SAHA Node" : "Unknown Device");

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.deviceCard,
        isSaha ? styles.sahaDeviceCard : styles.bleDeviceCard,
        pressed && styles.buttonPressed,
      ]}
    >
      <View
        style={[
          styles.deviceAccent,
          { backgroundColor: isSaha ? "#10B981" : "#9CA3AF" },
        ]}
      />
      <View style={styles.deviceContent}>
        <View style={styles.deviceHeader}>
          <Text
            style={[
              styles.deviceTag,
              { color: isSaha ? "#047857" : "#4B5563" },
            ]}
            numberOfLines={1}
          >
            {isSaha ? "● SAHA Device" : "○ Nearby BLE Device"}
          </Text>
          <Text style={styles.deviceRssi}>
            {device.rssi != null ? `${device.rssi} dBm` : "Signal --"}
          </Text>
        </View>
        <Text style={styles.deviceTitle} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.deviceIdText} numberOfLines={1}>
          ID: {device.id}
        </Text>
      </View>
    </Pressable>
  );
}

function EmptyDevicesView({
  isScanning,
  status,
  errorMessage,
  onOpenScanner,
}: {
  isScanning: boolean;
  status: BleScannerStatus;
  errorMessage: string;
  onOpenScanner: () => void;
}) {
  let title = "No nearby devices";
  let message =
    "Tap 'Scan for nearby devices' to open the interactive radar scanner.";

  if (isScanning) {
    title = "Scanning in progress";
    message = "Searching for nearby Bluetooth Low Energy devices...";
  } else if (status === "permission-denied") {
    title = "Permission Required";
    message =
      errorMessage ||
      "Bluetooth permission was denied. Allow Bluetooth access to scan.";
  } else if (status === "bluetooth-off") {
    title = "Bluetooth is Off";
    message =
      "Turn on Bluetooth on your device and tap Scan to discover nearby nodes.";
  } else if (status === "bluetooth-unavailable") {
    title = "BLE Unavailable";
    message =
      "Native Bluetooth hardware is unavailable in Expo Go. Run a custom dev build.";
  } else if (errorMessage) {
    title = "Scan Error";
    message = errorMessage;
  }

  return (
    <View style={styles.emptyStateContainer}>
      <Text style={styles.emptyStateTitle}>{title}</Text>
      <Text style={styles.emptyStateText}>{message}</Text>
      {!isScanning && (
        <Pressable
          accessibilityRole="button"
          onPress={onOpenScanner}
          style={({ pressed }) => [
            styles.emptyStateButton,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.emptyStateButtonText}>Open Radar Scanner</Text>
        </Pressable>
      )}
    </View>
  );
}

function MeshVisualization({ activeNodesCount }: { activeNodesCount: number }) {
  return (
    <View style={[styles.infoCard, styles.meshCard]}>
      <View style={styles.cardHeadingRow}>
        <Text style={styles.infoCardTitle}>Mesh activity</Text>
        <Text style={styles.infoCardKicker}>local</Text>
      </View>
      <View style={styles.meshCanvas} accessibilityLabel="Nearby device mesh">
        <View style={[styles.meshLine, styles.meshLineVertical]} />
        <View style={[styles.meshLine, styles.meshLineUpperLeft]} />
        <View style={[styles.meshLine, styles.meshLineUpperRight]} />
        <View style={[styles.meshLine, styles.meshLineLowerLeft]} />
        <View style={[styles.meshLine, styles.meshLineLowerRight]} />

        <MeshNode style={styles.meshNodeTop} />
        <MeshNode style={styles.meshNodeLeft} />
        <MeshNode
          style={styles.meshNodeRight}
          active={activeNodesCount > 0}
        />
        <MeshNode style={styles.meshNodeBottom} />
      </View>
      <Text style={styles.infoCardText}>
        Your phone can relay communication through nearby SAHA devices.
      </Text>
    </View>
  );
}

function MeshNode({
  active,
  style,
}: {
  active?: boolean;
  style: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.meshNode, active && styles.meshNodeActive, style]}>
      {active && <View style={styles.meshNodeCore} />}
    </View>
  );
}

function formatLocationCoords(location: Location.LocationObject | null) {
  if (!location) {
    return "Finding current location...";
  }

  const { latitude, longitude } = location.coords;

  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

function formatLocationNote(location: Location.LocationObject | null) {
  if (!location) {
    return "Allow location access so SAHA can show this device's live position.";
  }

  const accuracy = location.coords.accuracy;
  const updatedAt = new Date(location.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `Updated ${updatedAt}${
    accuracy === null ? "" : ` - accuracy about ${Math.round(accuracy)}m`
  }`;
}

function LocationContext() {
  const [deviceLocation, setDeviceLocation] =
    useState<Location.LocationObject | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let subscription: Location.LocationSubscription | null = null;

    async function startLocationTracking() {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (!isMounted) {
        return;
      }

      if (status !== Location.PermissionStatus.GRANTED) {
        setLocationError("Location permission is off");
        return;
      }

      try {
        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        if (isMounted) {
          setDeviceLocation(currentLocation);
          setLocationError(null);
        }

        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: 10,
            timeInterval: 5000,
          },
          (updatedLocation: Location.LocationObject) => {
            if (isMounted) {
              setDeviceLocation(updatedLocation);
              setLocationError(null);
            }
          },
          () => {
            if (isMounted) {
              setLocationError("Unable to update live location");
            }
          }
        );

        if (!isMounted) {
          subscription.remove();
        }
      } catch {
        if (isMounted) {
          setLocationError("Unable to read this device's location");
        }
      }
    }

    startLocationTracking();

    return () => {
      isMounted = false;
      subscription?.remove();
    };
  }, []);

  const locationPlace = locationError ?? formatLocationCoords(deviceLocation);
  const locationNote = locationError
    ? "Turn on location permission to show this device's current position."
    : formatLocationNote(deviceLocation);

  return (
    <View style={[styles.infoCard, styles.locationCard]}>
      <Text style={styles.infoCardTitle}>Live device location</Text>
      <Text style={styles.locationPlace}>{locationPlace}</Text>
      <Text style={styles.infoCardText}>{locationNote}</Text>

      <View style={styles.emptyStatePreview}>
        <Text style={styles.emptyStatePreviewTitle}>Local BLE Sync</Text>
        <Text style={styles.emptyStatePreviewText}>
          Messages stay local and sync when another SAHA device is nearby.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F6F3EC",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 34,
  },
  scrollContentCompact: {
    paddingHorizontal: 16,
  },
  header: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  brand: {
    color: "#111827",
    fontSize: 27,
    fontWeight: "800",
    letterSpacing: 2.4,
  },
  headerSubtitle: {
    marginTop: 2,
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  identityButton: {
    minWidth: 48,
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#D8D2C7",
    backgroundColor: "#FFFDF8",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  identitySignal: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#16A34A",
  },
  identityText: {
    color: "#1F2937",
    fontSize: 14,
    fontWeight: "800",
  },
  networkCard: {
    borderRadius: 30,
    padding: 22,
    backgroundColor: "#12211D",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 7,
  },
  networkTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 14,
  },
  statusTitleGroup: {
    flex: 1,
  },
  statusBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(226, 246, 232, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(226, 246, 232, 0.16)",
  },
  statusPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusBadgeText: {
    color: "#D8F8E2",
    fontSize: 12,
    fontWeight: "800",
  },
  networkTitle: {
    marginTop: 18,
    color: "#FFFFFF",
    fontSize: 25,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  networkStatus: {
    marginTop: 7,
    color: "#C9D4CE",
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "600",
  },
  nodeCountBlock: {
    width: 82,
    height: 88,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3EFE4",
  },
  nodeCount: {
    color: "#10201B",
    fontSize: 34,
    fontWeight: "900",
    lineHeight: 38,
  },
  nodeCountLabel: {
    color: "#5B625E",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  networkBottomRow: {
    marginTop: 24,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  offlineMode: {
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  offlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#EACF82",
  },
  offlineText: {
    flexShrink: 1,
    color: "#EFE7D5",
    fontSize: 13,
    fontWeight: "700",
  },
  miniMesh: {
    width: 72,
    height: 40,
  },
  miniMeshLine: {
    position: "absolute",
    height: 1,
    backgroundColor: "rgba(216, 248, 226, 0.45)",
  },
  miniLineOne: {
    top: 19,
    left: 13,
    width: 46,
  },
  miniLineTwo: {
    top: 19,
    left: 24,
    width: 27,
    transform: [{ rotate: "-38deg" }],
  },
  miniNode: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#EAF7EC",
  },
  miniNodeLeft: {
    left: 8,
    top: 14,
  },
  miniNodeCenter: {
    left: 30,
    top: 3,
  },
  miniNodeRight: {
    right: 8,
    top: 14,
  },
  actionsCard: {
    marginTop: 16,
    borderRadius: 26,
    padding: 12,
    backgroundColor: "#FFFDF8",
    borderWidth: 1,
    borderColor: "#E7E0D4",
  },
  primaryButton: {
    minHeight: 74,
    borderRadius: 22,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#DF4E2F",
  },
  primaryButtonScanning: {
    backgroundColor: "#2563EB",
  },
  buttonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
  primaryIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.18)",
  },
  primaryIconText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
  },
  primaryCopy: {
    flex: 1,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: -0.2,
  },
  primaryButtonSubtext: {
    marginTop: 3,
    color: "#FFE5DD",
    fontSize: 12,
    fontWeight: "700",
  },
  secondaryActions: {
    marginTop: 10,
    flexDirection: "row",
    gap: 10,
  },
  secondaryActionsCompact: {
    flexDirection: "column",
  },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    backgroundColor: "#F4F0E8",
  },
  secondaryButtonText: {
    color: "#29332F",
    fontSize: 14,
    fontWeight: "800",
  },
  sectionHeader: {
    marginTop: 24,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionTitle: {
    color: "#111827",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  sectionMeta: {
    flexShrink: 1,
    color: "#73786F",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "right",
  },
  activityList: {
    gap: 10,
  },
  deviceCard: {
    minHeight: 76,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    flexDirection: "row",
  },
  sahaDeviceCard: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
  },
  bleDeviceCard: {
    backgroundColor: "#F9FAFB",
    borderColor: "#E5E7EB",
  },
  deviceAccent: {
    width: 5,
  },
  deviceContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  deviceHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  deviceTag: {
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  deviceRssi: {
    fontSize: 12,
    fontWeight: "800",
    color: "#6B7280",
  },
  deviceTitle: {
    marginTop: 4,
    color: "#111827",
    fontSize: 16,
    fontWeight: "800",
  },
  deviceIdText: {
    marginTop: 2,
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "600",
  },
  emptyStateContainer: {
    padding: 22,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E7E0D4",
    backgroundColor: "#FFFDF8",
    alignItems: "center",
  },
  emptyStateTitle: {
    color: "#1F2937",
    fontSize: 16,
    fontWeight: "800",
  },
  emptyStateText: {
    marginTop: 6,
    color: "#6B7280",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    fontWeight: "600",
  },
  emptyStateButton: {
    marginTop: 14,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "#DF4E2F",
  },
  emptyStateButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  contextGrid: {
    marginTop: 16,
    gap: 12,
  },
  infoCard: {
    borderRadius: 24,
    padding: 18,
    backgroundColor: "#FFFDF8",
    borderWidth: 1,
    borderColor: "#E7E0D4",
  },
  meshCard: {
    minHeight: 228,
  },
  locationCard: {
    minHeight: 178,
  },
  cardHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  infoCardTitle: {
    color: "#17201C",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: -0.1,
  },
  infoCardKicker: {
    color: "#8C8F86",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  meshCanvas: {
    alignSelf: "center",
    width: 170,
    height: 116,
    marginTop: 16,
    marginBottom: 12,
  },
  meshLine: {
    position: "absolute",
    height: 1.5,
    borderRadius: 1,
    backgroundColor: "#A9B5AB",
  },
  meshLineVertical: {
    top: 57,
    left: 67,
    width: 38,
    transform: [{ rotate: "90deg" }],
  },
  meshLineUpperLeft: {
    top: 39,
    left: 55,
    width: 51,
    transform: [{ rotate: "-38deg" }],
  },
  meshLineUpperRight: {
    top: 39,
    right: 55,
    width: 51,
    transform: [{ rotate: "38deg" }],
  },
  meshLineLowerLeft: {
    bottom: 40,
    left: 55,
    width: 51,
    transform: [{ rotate: "38deg" }],
  },
  meshLineLowerRight: {
    right: 55,
    bottom: 40,
    width: 51,
    transform: [{ rotate: "-38deg" }],
  },
  meshNode: {
    position: "absolute",
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#F7F2E8",
    borderWidth: 2,
    borderColor: "#17302A",
  },
  meshNodeActive: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#17302A",
    borderColor: "#55D187",
  },
  meshNodeCore: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#55D187",
  },
  meshNodeTop: {
    top: 0,
    left: 74,
  },
  meshNodeLeft: {
    top: 47,
    left: 25,
  },
  meshNodeRight: {
    top: 44,
    right: 22,
  },
  meshNodeBottom: {
    bottom: 0,
    left: 74,
  },
  infoCardText: {
    color: "#666D66",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },
  locationPlace: {
    marginTop: 10,
    color: "#17201C",
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
  },
  emptyStatePreview: {
    marginTop: 16,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E7E0D4",
    backgroundColor: "#F8F3EA",
  },
  emptyStatePreviewTitle: {
    color: "#34413B",
    fontSize: 14,
    fontWeight: "900",
  },
  emptyStatePreviewText: {
    marginTop: 5,
    color: "#73786F",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
  },
});
