import { Stack } from "expo-router";
import {
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

type ActivityTone = "critical" | "warning" | "community";

type NearbyActivity = {
  id: string;
  label: string;
  title: string;
  meta: string;
  tone: ActivityTone;
};

const MOCK_HOME = {
  identity: "N7",
  network: {
    title: "Local Network",
    status: "Connected to nearby nodes",
    nearbyNodes: 3,
    mode: "Offline mode active",
  },
  activity: [
    {
      id: "road-blocked",
      label: "Emergency Alert",
      title: "Road blocked near Sector 4",
      meta: "2 min ago · 1.2 km",
      tone: "critical",
    },
    {
      id: "water-supply",
      label: "Local Alert",
      title: "Water supply interruption",
      meta: "8 min ago · Nearby",
      tone: "warning",
    },
    {
      id: "campus-network",
      label: "Community",
      title: "Campus Network",
      meta: "12 active nodes",
      tone: "community",
    },
  ] satisfies NearbyActivity[],
  location: {
    title: "Your area",
    place: "Amsterdam · Approximate location",
    note: "Location is shown as context only",
  },
};

const TONE_STYLES: Record<
  ActivityTone,
  {
    accent: string;
    background: string;
    label: string;
  }
> = {
  critical: {
    accent: "#C2410C",
    background: "#FFF4ED",
    label: "#9A3412",
  },
  warning: {
    accent: "#B7791F",
    background: "#FFFAEB",
    label: "#8A5A10",
  },
  community: {
    accent: "#2563EB",
    background: "#EFF6FF",
    label: "#1D4ED8",
  },
};

export default function Index() {
  const { width } = useWindowDimensions();
  const isCompact = width < 370;

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
        <Header identity={MOCK_HOME.identity} />
        <NetworkStatusCard isCompact={isCompact} />
        <PrimaryAction isCompact={isCompact} />

        <SectionHeader title="Nearby" actionText="Live local activity" />
        <View style={styles.activityList}>
          {MOCK_HOME.activity.map((item) => (
            <NearbyActivityCard key={item.id} activity={item} />
          ))}
        </View>

        <View style={styles.contextGrid}>
          <MeshVisualization />
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

function NetworkStatusCard({ isCompact }: { isCompact: boolean }) {
  return (
    <View style={styles.networkCard}>
      <View style={styles.networkTopRow}>
        <View style={styles.statusTitleGroup}>
          <View style={styles.statusBadge}>
            <View style={styles.statusPulse} />
            <Text style={styles.statusBadgeText}>Mesh ready</Text>
          </View>
          <Text style={styles.networkTitle}>{MOCK_HOME.network.title}</Text>
          <Text style={styles.networkStatus}>{MOCK_HOME.network.status}</Text>
        </View>

        <View style={styles.nodeCountBlock}>
          <Text style={styles.nodeCount}>
            {MOCK_HOME.network.nearbyNodes}
          </Text>
          <Text style={styles.nodeCountLabel}>nodes</Text>
        </View>
      </View>

      <View style={styles.networkBottomRow}>
        <View style={styles.offlineMode}>
          <View style={styles.offlineDot} />
          <Text style={styles.offlineText}>{MOCK_HOME.network.mode}</Text>
        </View>

        {!isCompact && (
          <View style={styles.miniMesh} accessibilityLabel="Mesh connection">
            <View style={[styles.miniMeshLine, styles.miniLineOne]} />
            <View style={[styles.miniMeshLine, styles.miniLineTwo]} />
            <View style={[styles.miniNode, styles.miniNodeLeft]} />
            <View style={[styles.miniNode, styles.miniNodeCenter]} />
            <View style={[styles.miniNode, styles.miniNodeRight]} />
          </View>
        )}
      </View>
    </View>
  );
}

function PrimaryAction({ isCompact }: { isCompact: boolean }) {
  return (
    <View style={styles.actionsCard}>
      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.primaryButton,
          pressed && styles.buttonPressed,
        ]}
      >
        <View style={styles.primaryIcon}>
          <Text style={styles.primaryIconText}>!</Text>
        </View>
        <View style={styles.primaryCopy}>
          <Text style={styles.primaryButtonText}>Create Alert</Text>
          <Text style={styles.primaryButtonSubtext} numberOfLines={1}>
            Broadcast urgent local information
          </Text>
        </View>
      </Pressable>

      <View
        style={[
          styles.secondaryActions,
          isCompact && styles.secondaryActionsCompact,
        ]}
      >
        <SecondaryAction label="Create message" />
        <SecondaryAction label="Create channel" />
      </View>
    </View>
  );
}

function SecondaryAction({ label }: { label: string }) {
  return (
    <Pressable
      accessibilityRole="button"
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

function NearbyActivityCard({ activity }: { activity: NearbyActivity }) {
  const tone = TONE_STYLES[activity.tone];

  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.activityCard,
        { backgroundColor: tone.background },
        pressed && styles.cardPressed,
      ]}
    >
      <View style={[styles.activityAccent, { backgroundColor: tone.accent }]} />
      <View style={styles.activityContent}>
        <View style={styles.activityHeader}>
          <Text
            style={[styles.activityLabel, { color: tone.label }]}
            numberOfLines={1}
          >
            {activity.label}
          </Text>
          <View style={[styles.priorityDot, { backgroundColor: tone.accent }]} />
        </View>
        <Text style={styles.activityTitle} numberOfLines={2}>
          {activity.title}
        </Text>
        <Text style={styles.activityMeta} numberOfLines={1}>
          {activity.meta}
        </Text>
      </View>
    </Pressable>
  );
}

function MeshVisualization() {
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
        <MeshNode style={styles.meshNodeRight} active />
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

function LocationContext() {
  return (
    <View style={[styles.infoCard, styles.locationCard]}>
      <Text style={styles.infoCardTitle}>{MOCK_HOME.location.title}</Text>
      <Text style={styles.locationPlace}>{MOCK_HOME.location.place}</Text>
      <Text style={styles.infoCardText}>{MOCK_HOME.location.note}</Text>

      <View style={styles.emptyStatePreview}>
        <Text style={styles.emptyStateTitle}>No nearby nodes</Text>
        <Text style={styles.emptyStateText}>
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
    backgroundColor: "#55D187",
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
    backgroundColor: "#55D187",
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
    fontSize: 24,
    fontWeight: "900",
  },
  primaryCopy: {
    flex: 1,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.2,
  },
  primaryButtonSubtext: {
    marginTop: 3,
    color: "#FFE5DD",
    fontSize: 13,
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
  activityCard: {
    minHeight: 86,
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(17, 24, 39, 0.06)",
    flexDirection: "row",
  },
  cardPressed: {
    opacity: 0.88,
  },
  activityAccent: {
    width: 5,
  },
  activityContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  activityHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  activityLabel: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  priorityDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  activityTitle: {
    marginTop: 7,
    color: "#17201C",
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "800",
  },
  activityMeta: {
    marginTop: 6,
    color: "#6B716B",
    fontSize: 13,
    fontWeight: "600",
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
  emptyStateTitle: {
    color: "#34413B",
    fontSize: 14,
    fontWeight: "900",
  },
  emptyStateText: {
    marginTop: 5,
    color: "#73786F",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
  },
});
