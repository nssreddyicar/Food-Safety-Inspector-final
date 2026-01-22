import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  Pressable,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useHeaderHeight } from "@react-navigation/elements";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { Card } from "@/components/Card";
import { ScannerStackParamList } from "@/navigation/ScannerStackNavigator";

interface ScannedNote {
  id: string;
  data: string;
  type: string;
  heading: string;
  scannedAt: string;
}

interface Section {
  title: string;
  data: ScannedNote[];
}

const NOTES_STORAGE_KEY = "@scanned_notes";

export default function ScannedNotesScreen() {
  const { theme } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<ScannerStackParamList>>();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const [notes, setNotes] = useState<ScannedNote[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingNote, setEditingNote] = useState<ScannedNote | null>(null);
  const [editHeading, setEditHeading] = useState("");

  const loadNotes = useCallback(async () => {
    try {
      const storedNotes = await AsyncStorage.getItem(NOTES_STORAGE_KEY);
      if (storedNotes) {
        const parsedNotes: ScannedNote[] = JSON.parse(storedNotes);
        setNotes(parsedNotes);
        groupNotesByDate(parsedNotes);
      } else {
        setNotes([]);
        setSections([]);
      }
    } catch (error) {
      console.error("Error loading notes:", error);
    }
  }, []);

  const groupNotesByDate = (notesList: ScannedNote[]) => {
    const grouped: { [key: string]: ScannedNote[] } = {};

    notesList.forEach((note) => {
      const date = new Date(note.scannedAt);
      const dateKey = date.toLocaleDateString("en-IN", {
        weekday: "long",
        day: "2-digit",
        month: "short",
        year: "numeric",
      });

      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(note);
    });

    const sectionData: Section[] = Object.keys(grouped).map((key) => ({
      title: key,
      data: grouped[key],
    }));

    setSections(sectionData);
  };

  useFocusEffect(
    useCallback(() => {
      loadNotes();
    }, [loadNotes]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotes();
    setRefreshing(false);
  };

  const deleteNote = async (id: string) => {
    Alert.alert("Delete Note", "Are you sure you want to delete this note?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const updatedNotes = notes.filter((n) => n.id !== id);
            await AsyncStorage.setItem(
              NOTES_STORAGE_KEY,
              JSON.stringify(updatedNotes),
            );
            setNotes(updatedNotes);
            groupNotesByDate(updatedNotes);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch (error) {
            console.error("Error deleting note:", error);
          }
        },
      },
    ]);
  };

  const openEditModal = (note: ScannedNote) => {
    setEditingNote(note);
    setEditHeading(note.heading);
    setEditModalVisible(true);
  };

  const saveEdit = async () => {
    if (!editingNote) return;

    try {
      const updatedNotes = notes.map((n) =>
        n.id === editingNote.id
          ? { ...n, heading: editHeading.trim() || "Untitled Scan" }
          : n,
      );
      await AsyncStorage.setItem(
        NOTES_STORAGE_KEY,
        JSON.stringify(updatedNotes),
      );
      setNotes(updatedNotes);
      groupNotesByDate(updatedNotes);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEditModalVisible(false);
      setEditingNote(null);
    } catch (error) {
      console.error("Error saving edit:", error);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getCodeIcon = (type: string): keyof typeof Feather.glyphMap => {
    if (type.toLowerCase().includes("qr")) return "grid";
    return "align-justify";
  };

  const renderNote = ({ item }: { item: ScannedNote }) => (
    <Pressable
      onPress={() => navigation.navigate("NoteDetail", { note: item })}
      onLongPress={() => deleteNote(item.id)}
    >
      <Card style={styles.noteCard}>
        <View style={styles.noteHeader}>
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: Colors.light.primary + "15" },
            ]}
          >
            <Feather
              name={getCodeIcon(item.type)}
              size={20}
              color={Colors.light.primary}
            />
          </View>
          <View style={styles.noteInfo}>
            <Text
              style={[styles.noteHeading, { color: theme.text }]}
              numberOfLines={1}
            >
              {item.heading}
            </Text>
            <View style={styles.noteMeta}>
              <Text style={[styles.noteType, { color: Colors.light.primary }]}>
                {item.type.toUpperCase()}
              </Text>
              <Text style={[styles.noteDot, { color: theme.textSecondary }]}>
                •
              </Text>
              <Text style={[styles.noteTime, { color: theme.textSecondary }]}>
                {formatTime(item.scannedAt)}
              </Text>
            </View>
          </View>
          <Pressable
            style={styles.editButton}
            onPress={() => openEditModal(item)}
            hitSlop={8}
          >
            <Feather name="edit-2" size={18} color={theme.textSecondary} />
          </Pressable>
        </View>
        <Text
          style={[styles.noteData, { color: theme.textSecondary }]}
          numberOfLines={1}
        >
          {item.data}
        </Text>
      </Card>
    </Pressable>
  );

  const renderSectionHeader = ({ section }: { section: Section }) => (
    <View
      style={[styles.sectionHeader, { backgroundColor: theme.backgroundRoot }]}
    >
      <Feather name="calendar" size={14} color={theme.textSecondary} />
      <Text style={[styles.sectionTitle, { color: theme.text }]}>
        {section.title}
      </Text>
      <Text style={[styles.sectionCount, { color: theme.textSecondary }]}>
        {section.data.length} {section.data.length === 1 ? "scan" : "scans"}
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderNote}
        renderSectionHeader={renderSectionHeader}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: headerHeight + Spacing.md,
            paddingBottom: tabBarHeight + Spacing.xl,
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.light.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View
              style={[
                styles.emptyIcon,
                { backgroundColor: Colors.light.primary + "15" },
              ]}
            >
              <Feather
                name="file-text"
                size={48}
                color={Colors.light.primary}
              />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              No Scanned Notes
            </Text>
            <Text style={[styles.emptyMessage, { color: theme.textSecondary }]}>
              Point your camera at a QR code or barcode to automatically save it
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
      />

      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: theme.backgroundDefault },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                Edit Title
              </Text>
              <Pressable onPress={() => setEditModalVisible(false)}>
                <Feather name="x" size={24} color={theme.textSecondary} />
              </Pressable>
            </View>

            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.backgroundSecondary,
                  color: theme.text,
                  borderColor: theme.border,
                },
              ]}
              placeholder="Enter title"
              placeholderTextColor={theme.textSecondary}
              value={editHeading}
              onChangeText={setEditHeading}
              autoFocus
            />

            <View style={styles.modalButtons}>
              <Pressable
                style={[
                  styles.modalButton,
                  styles.cancelButton,
                  { borderColor: theme.border },
                ]}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={[styles.cancelButtonText, { color: theme.text }]}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.modalButton,
                  styles.saveButton,
                  { backgroundColor: Colors.light.primary },
                ]}
                onPress={saveEdit}
              >
                <Feather name="check" size={18} color="#fff" />
                <Text style={styles.saveButtonText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.md,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
    marginTop: Spacing.md,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
  },
  sectionCount: {
    fontSize: 13,
  },
  noteCard: {
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  noteHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  noteInfo: {
    flex: 1,
  },
  noteHeading: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  noteMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  noteType: {
    fontSize: 12,
    fontWeight: "500",
  },
  noteDot: {
    fontSize: 12,
  },
  noteTime: {
    fontSize: 12,
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  noteData: {
    fontSize: 14,
    fontFamily: "monospace",
    marginLeft: 44 + Spacing.md,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["5xl"],
    gap: Spacing.md,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: BorderRadius.xl,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
  emptyMessage: {
    fontSize: 14,
    textAlign: "center",
    maxWidth: 280,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  modalContent: {
    width: "100%",
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: 16,
    marginBottom: Spacing.lg,
  },
  modalButtons: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  modalButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  cancelButton: {
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "500",
  },
  saveButton: {},
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
