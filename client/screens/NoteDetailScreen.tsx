import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Share,
  Alert,
  Platform,
} from "react-native";
import { useRoute, RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import { Card } from "@/components/Card";
import { ScannerStackParamList } from "@/navigation/ScannerStackNavigator";

type NoteDetailRouteProp = RouteProp<ScannerStackParamList, "NoteDetail">;

export default function NoteDetailScreen() {
  const { theme } = useTheme();
  const route = useRoute<NoteDetailRouteProp>();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { note } = route.params;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-IN", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const copyToClipboard = async () => {
    await Clipboard.setStringAsync(note.data);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Copied", "Data copied to clipboard");
  };

  const shareNote = async () => {
    try {
      await Share.share({
        title: note.heading,
        message: `${note.heading}\n\nType: ${note.type}\nData: ${note.data}\n\nScanned on: ${formatDate(note.scannedAt)}`,
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const openUrl = async () => {
    const data = note.data;
    if (data.startsWith("http://") || data.startsWith("https://")) {
      try {
        await Linking.openURL(data);
      } catch (error) {
        Alert.alert("Error", "Could not open this URL");
      }
    } else {
      Alert.alert("Not a URL", "This data is not a valid URL");
    }
  };

  const isUrl =
    note.data.startsWith("http://") || note.data.startsWith("https://");

  const getCodeIcon = (type: string): keyof typeof Feather.glyphMap => {
    if (type.toLowerCase().includes("qr")) return "grid";
    return "align-justify";
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: headerHeight + Spacing.md,
          paddingBottom: insets.bottom + Spacing["3xl"],
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: Colors.light.primary + "15" },
          ]}
        >
          <Feather
            name={getCodeIcon(note.type)}
            size={32}
            color={Colors.light.primary}
          />
        </View>
        <Text style={[styles.heading, { color: theme.text }]}>
          {note.heading}
        </Text>
        <View
          style={[
            styles.typeTag,
            { backgroundColor: Colors.light.primary + "20" },
          ]}
        >
          <Text style={[styles.typeText, { color: Colors.light.primary }]}>
            {note.type.toUpperCase()}
          </Text>
        </View>
      </View>

      <Card style={styles.dataCard}>
        <View style={styles.dataHeader}>
          <Text style={[styles.dataLabel, { color: theme.textSecondary }]}>
            Scanned Data
          </Text>
          <Pressable onPress={copyToClipboard} style={styles.copyButton}>
            <Feather name="copy" size={18} color={Colors.light.primary} />
          </Pressable>
        </View>
        <Text style={[styles.dataText, { color: theme.text }]} selectable>
          {note.data}
        </Text>
      </Card>

      <Card style={styles.infoCard}>
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Feather name="calendar" size={18} color={theme.textSecondary} />
            <View>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>
                Scanned On
              </Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>
                {formatDate(note.scannedAt)}
              </Text>
            </View>
          </View>
        </View>
      </Card>

      <View style={styles.actions}>
        {isUrl ? (
          <Pressable
            style={[
              styles.actionButton,
              { backgroundColor: Colors.light.success },
            ]}
            onPress={openUrl}
          >
            <Feather name="external-link" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Open URL</Text>
          </Pressable>
        ) : null}
        <Pressable
          style={[
            styles.actionButton,
            { backgroundColor: Colors.light.primary },
          ]}
          onPress={shareNote}
        >
          <Feather name="share-2" size={20} color="#fff" />
          <Text style={styles.actionButtonText}>Share</Text>
        </Pressable>
        <Pressable
          style={[
            styles.actionButton,
            styles.outlineButton,
            { borderColor: theme.border },
          ]}
          onPress={copyToClipboard}
        >
          <Feather name="copy" size={20} color={theme.text} />
          <Text style={[styles.actionButtonText, { color: theme.text }]}>
            Copy
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.md,
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.xl,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  heading: {
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  typeTag: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  typeText: {
    fontSize: 14,
    fontWeight: "600",
  },
  dataCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  dataHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  dataLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  copyButton: {
    padding: Spacing.xs,
  },
  dataText: {
    fontSize: 16,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    lineHeight: 24,
  },
  infoCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  infoRow: {
    gap: Spacing.lg,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  infoLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "500",
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  actionButton: {
    flex: 1,
    minWidth: 100,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  outlineButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
