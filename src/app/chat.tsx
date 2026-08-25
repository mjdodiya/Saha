import React, { useRef, useState } from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useBleChat } from "@/hooks/useBleChat";
import { useBlePeripheral } from "@/hooks/useBlePeripheral";
import type { ChatMessage } from "@/ble/types";

export default function ChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ deviceId?: string; deviceName?: string }>();
  const targetDeviceId = params.deviceId ?? null;
  const targetDeviceName = params.deviceName ?? null;

  const { nodeId: myNodeId } = useBlePeripheral();
  const {
    connectionState,
    messages,
    peerIdentity,
    errorMessage,
    sendMessage,
    disconnect,
    isConnected,
  } = useBleChat(targetDeviceId, targetDeviceName);

  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const handleSend = async () => {
    if (!inputText.trim() || isSending) return;
    const textToSend = inputText;
    setInputText("");
    setIsSending(true);
    await sendMessage(textToSend);
    setIsSending(false);
  };

  const displayName = peerIdentity
    ? `Node ${peerIdentity}`
    : targetDeviceName || (targetDeviceId ? `Device (${targetDeviceId.slice(-5)})` : "SAHA Broadcast");

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </Pressable>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {displayName}
            </Text>
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor:
                      connectionState === "connected"
                        ? "#10B981"
                        : connectionState === "connecting" || connectionState === "discovering"
                        ? "#60A5FA"
                        : "#F59E0B",
                  },
                ]}
              />
              <Text style={styles.statusText}>
                {connectionState === "connected"
                  ? `Connected (My Node: ${myNodeId || "Me"})`
                  : connectionState === "connecting"
                  ? "Connecting via BLE..."
                  : connectionState === "discovering"
                  ? "Discovering GATT Services..."
                  : `Peripheral Mode (${myNodeId || "Broadcasting"})`}
              </Text>
            </View>
          </View>

          {targetDeviceId && (
            <Pressable
              onPress={disconnect}
              style={({ pressed }) => [styles.disconnectButton, pressed && styles.pressed]}
            >
              <Text style={styles.disconnectText}>End</Text>
            </Pressable>
          )}
        </View>

        {/* Error Banner */}
        {errorMessage && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{errorMessage}</Text>
          </View>
        )}

        {/* Connection Loading State */}
        {(connectionState === "connecting" || connectionState === "discovering") && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#10B981" />
            <Text style={styles.loadingText}>
              {connectionState === "connecting"
                ? "Connecting to SAHA BLE Peripheral..."
                : "Reading Identity & Subscribing to TX Notifications..."}
            </Text>
          </View>
        )}

        {/* Messages List */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <EmptyChatView
              targetDeviceName={displayName}
              targetDeviceId={targetDeviceId}
              isConnecting={connectionState === "connecting" || connectionState === "discovering"}
            />
          }
          renderItem={({ item }) => <ChatMessageItem message={item} />}
        />

        {/* Input Bar */}
        <View style={styles.inputContainer}>
          <View style={styles.inputSubheader}>
            <Text style={styles.inputSubheaderText}>
              📡 RX (Central→Peripheral) / TX (Peripheral→Central)
            </Text>
          </View>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.textInput}
              placeholder="Type message over BLE..."
              placeholderTextColor="#9CA3AF"
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={handleSend}
              returnKeyType="send"
              editable={!isSending}
            />
            <Pressable
              onPress={handleSend}
              disabled={!inputText.trim() || isSending}
              style={({ pressed }) => [
                styles.sendButton,
                (!inputText.trim() || isSending) && styles.sendButtonDisabled,
                pressed && styles.pressed,
              ]}
            >
              {isSending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.sendButtonText}>Send</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ChatMessageItem({ message }: { message: ChatMessage }) {
  const isSelf = message.isSelf;
  const timeString = new Date(message.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <View style={[styles.messageRow, isSelf ? styles.messageRowSelf : styles.messageRowPeer]}>
      <View style={[styles.messageBubble, isSelf ? styles.bubbleSelf : styles.bubblePeer]}>
        {!isSelf && <Text style={styles.senderLabel}>{message.senderId}</Text>}
        <Text style={[styles.messageText, isSelf ? styles.textSelf : styles.textPeer]}>
          {message.text}
        </Text>
        <Text style={[styles.timestampText, isSelf ? styles.timeSelf : styles.timePeer]}>
          {timeString}
        </Text>
      </View>
    </View>
  );
}

function EmptyChatView({
  targetDeviceName,
  targetDeviceId,
  isConnecting,
}: {
  targetDeviceName: string;
  targetDeviceId?: string | null;
  isConnecting: boolean;
}) {
  if (isConnecting) {
    return null;
  }

  return (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>💬</Text>
      <Text style={styles.emptyTitle}>BLE Chat Session</Text>
      <Text style={styles.emptySubtitle}>
        {targetDeviceId
          ? `Connected to ${targetDeviceName}. Send a message over BLE RX characteristic!`
          : "Broadcasting as BLE Peripheral. Incoming messages from connected Centrals will appear here."}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0F172A",
  },
  container: {
    flex: 1,
    backgroundColor: "#F6F3EC",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#0F172A",
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  backButtonText: {
    color: "#E2E8F0",
    fontSize: 14,
    fontWeight: "600",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    marginHorizontal: 12,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    gap: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "500",
  },
  disconnectButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#EF4444",
  },
  disconnectText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  errorBanner: {
    backgroundColor: "#FEE2E2",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#FECACA",
  },
  errorBannerText: {
    color: "#B91C1C",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  loadingContainer: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#E2E8F0",
  },
  loadingText: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "600",
  },
  messageList: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 10,
    flexGrow: 1,
  },
  messageRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  messageRowSelf: {
    justifyContent: "flex-end",
  },
  messageRowPeer: {
    justifyContent: "flex-start",
  },
  messageBubble: {
    maxWidth: "80%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleSelf: {
    backgroundColor: "#12211D",
    borderBottomRightRadius: 4,
  },
  bubblePeer: {
    backgroundColor: "#FFFDF8",
    borderWidth: 1,
    borderColor: "#E5E0D8",
    borderBottomLeftRadius: 4,
  },
  senderLabel: {
    color: "#059669",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 2,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  textSelf: {
    color: "#FFFFFF",
  },
  textPeer: {
    color: "#1E293B",
  },
  timestampText: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: "flex-end",
  },
  timeSelf: {
    color: "#A7F3D0",
  },
  timePeer: {
    color: "#94A3B8",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    marginTop: 60,
  },
  emptyIcon: {
    fontSize: 44,
    marginBottom: 12,
  },
  emptyTitle: {
    color: "#1F2937",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 6,
  },
  emptySubtitle: {
    color: "#6B7280",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  inputContainer: {
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: Platform.OS === "ios" ? 24 : 12,
  },
  inputSubheader: {
    marginBottom: 6,
  },
  inputSubheaderText: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "600",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  textInput: {
    flex: 1,
    height: 44,
    backgroundColor: "#F1F5F9",
    borderRadius: 22,
    paddingHorizontal: 16,
    color: "#0F172A",
    fontSize: 15,
  },
  sendButton: {
    height: 44,
    paddingHorizontal: 20,
    borderRadius: 22,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "#9CA3AF",
  },
  sendButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.8,
  },
});
