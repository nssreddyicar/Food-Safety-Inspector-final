import React, { useState, useMemo } from "react";
import { View, StyleSheet, ScrollView, Pressable, Modal } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { Feather } from "@expo/vector-icons";

export type FilterCategory = "month" | "quarter" | "year" | "fy";

export interface TimeSelection {
  category: FilterCategory;
  value: string;
}

const MONTHS = [
  { id: "01", label: "January", short: "Jan" },
  { id: "02", label: "February", short: "Feb" },
  { id: "03", label: "March", short: "Mar" },
  { id: "04", label: "April", short: "Apr" },
  { id: "05", label: "May", short: "May" },
  { id: "06", label: "June", short: "Jun" },
  { id: "07", label: "July", short: "Jul" },
  { id: "08", label: "August", short: "Aug" },
  { id: "09", label: "September", short: "Sep" },
  { id: "10", label: "October", short: "Oct" },
  { id: "11", label: "November", short: "Nov" },
  { id: "12", label: "December", short: "Dec" },
];

const QUARTERS = [
  { id: "Q1", label: "Q1 (Apr-Jun)" },
  { id: "Q2", label: "Q2 (Jul-Sep)" },
  { id: "Q3", label: "Q3 (Oct-Dec)" },
  { id: "Q4", label: "Q4 (Jan-Mar)" },
];

const CATEGORIES: { id: FilterCategory; label: string }[] = [
  { id: "month", label: "Month" },
  { id: "quarter", label: "Quarter" },
  { id: "year", label: "Year" },
  { id: "fy", label: "Financial Year" },
];

function getYearOptions(): string[] {
  const currentYear = new Date().getFullYear();
  return [
    (currentYear - 2).toString(),
    (currentYear - 1).toString(),
    currentYear.toString(),
    (currentYear + 1).toString(),
  ];
}

function getFYOptions(): string[] {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const currentFYStart = currentMonth >= 3 ? currentYear : currentYear - 1;
  return [
    `${currentFYStart - 2}-${(currentFYStart - 1).toString().slice(-2)}`,
    `${currentFYStart - 1}-${currentFYStart.toString().slice(-2)}`,
    `${currentFYStart}-${(currentFYStart + 1).toString().slice(-2)}`,
  ];
}

function getCurrentDefaults(): TimeSelection {
  const now = new Date();
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  return { category: "month", value: `${now.getFullYear()}-${month}` };
}

interface TimeFilterProps {
  selected: TimeSelection;
  onSelect: (selection: TimeSelection) => void;
  compact?: boolean;
}

export function getDateRangeForSelection(selection: TimeSelection): {
  startDate: string;
  endDate: string;
} {
  const formatDate = (date: Date) => date.toISOString().split("T")[0];

  switch (selection.category) {
    case "month": {
      const [year, month] = selection.value.split("-").map(Number);
      const startOfMonth = new Date(year, month - 1, 1);
      const endOfMonth = new Date(year, month, 0);
      return {
        startDate: formatDate(startOfMonth),
        endDate: formatDate(endOfMonth),
      };
    }
    case "quarter": {
      const [fyStr, quarter] = selection.value.split("-");
      const fyYear = parseInt(fyStr);
      const quarterNum = parseInt(quarter.replace("Q", ""));

      let startMonth: number, startYear: number;
      switch (quarterNum) {
        case 1:
          startMonth = 3;
          startYear = fyYear;
          break;
        case 2:
          startMonth = 6;
          startYear = fyYear;
          break;
        case 3:
          startMonth = 9;
          startYear = fyYear;
          break;
        case 4:
          startMonth = 0;
          startYear = fyYear + 1;
          break;
        default:
          startMonth = 3;
          startYear = fyYear;
      }

      const start = new Date(startYear, startMonth, 1);
      const end = new Date(startYear, startMonth + 3, 0);
      return { startDate: formatDate(start), endDate: formatDate(end) };
    }
    case "year": {
      const year = parseInt(selection.value);
      const start = new Date(year, 0, 1);
      const end = new Date(year, 11, 31);
      return { startDate: formatDate(start), endDate: formatDate(end) };
    }
    case "fy": {
      const fyStart = parseInt(selection.value.split("-")[0]);
      const start = new Date(fyStart, 3, 1);
      const end = new Date(fyStart + 1, 2, 31);
      return { startDate: formatDate(start), endDate: formatDate(end) };
    }
    default: {
      const today = new Date();
      return { startDate: formatDate(today), endDate: formatDate(today) };
    }
  }
}

export function getFilterDisplayLabel(selection: TimeSelection): string {
  switch (selection.category) {
    case "month": {
      const [year, month] = selection.value.split("-");
      const monthData = MONTHS.find((m) => m.id === month);
      return `${monthData?.short || month} ${year}`;
    }
    case "quarter": {
      const [fyYear, quarter] = selection.value.split("-");
      return `${quarter} FY ${fyYear}-${(parseInt(fyYear) + 1).toString().slice(-2)}`;
    }
    case "year":
      return selection.value;
    case "fy":
      return `FY ${selection.value}`;
    default:
      return "";
  }
}

export function TimeFilter({
  selected,
  onSelect,
  compact = false,
}: TimeFilterProps) {
  const { theme } = useTheme();
  const [showPicker, setShowPicker] = useState(false);
  const [tempCategory, setTempCategory] = useState<FilterCategory>(
    selected.category,
  );

  const yearOptions = useMemo(() => getYearOptions(), []);
  const fyOptions = useMemo(() => getFYOptions(), []);

  const getOptionsForCategory = (category: FilterCategory) => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    const currentFYStart = currentMonth >= 3 ? currentYear : currentYear - 1;

    switch (category) {
      case "month":
        const monthOptions: { id: string; label: string }[] = [];
        yearOptions.forEach((year) => {
          MONTHS.forEach((month) => {
            monthOptions.push({
              id: `${year}-${month.id}`,
              label: `${month.short} ${year}`,
            });
          });
        });
        return monthOptions.reverse();
      case "quarter":
        const quarterOptions: { id: string; label: string }[] = [];
        fyOptions.forEach((fy) => {
          const fyYear = fy.split("-")[0];
          QUARTERS.forEach((q) => {
            quarterOptions.push({
              id: `${fyYear}-${q.id}`,
              label: `${q.id} (${fy})`,
            });
          });
        });
        return quarterOptions.reverse();
      case "year":
        return yearOptions.map((y) => ({ id: y, label: y })).reverse();
      case "fy":
        return fyOptions.map((fy) => ({ id: fy, label: `FY ${fy}` })).reverse();
      default:
        return [];
    }
  };

  const handleCategorySelect = (category: FilterCategory) => {
    setTempCategory(category);
  };

  const handleValueSelect = (value: string) => {
    onSelect({ category: tempCategory, value });
    setShowPicker(false);
  };

  const displayLabel = getFilterDisplayLabel(selected);

  return (
    <>
      <Pressable
        onPress={() => {
          setTempCategory(selected.category);
          setShowPicker(true);
        }}
        style={[
          styles.filterButton,
          {
            backgroundColor: theme.backgroundElevated,
            borderColor: theme.border,
          },
        ]}
      >
        <Feather name="calendar" size={16} color={theme.primary} />
        <ThemedText type="small" style={styles.filterButtonText}>
          {displayLabel}
        </ThemedText>
        <Feather name="chevron-down" size={16} color={theme.textSecondary} />
      </Pressable>

      <Modal
        visible={showPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPicker(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowPicker(false)}
        >
          <Pressable
            style={[
              styles.modalContent,
              { backgroundColor: theme.backgroundRoot },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View
              style={[styles.modalHeader, { borderBottomColor: theme.border }]}
            >
              <ThemedText type="h3">Select Time Period</ThemedText>
              <Pressable onPress={() => setShowPicker(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            <View style={styles.categoryTabs}>
              {CATEGORIES.map((cat) => {
                const isSelected = tempCategory === cat.id;
                return (
                  <Pressable
                    key={cat.id}
                    onPress={() => handleCategorySelect(cat.id)}
                    style={[
                      styles.categoryTab,
                      {
                        backgroundColor: isSelected
                          ? theme.primary
                          : "transparent",
                        borderColor: isSelected ? theme.primary : theme.border,
                      },
                    ]}
                  >
                    <ThemedText
                      type="small"
                      style={{
                        color: isSelected ? "#FFFFFF" : theme.text,
                        fontWeight: isSelected ? "600" : "400",
                      }}
                    >
                      {cat.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>

            <ScrollView
              style={styles.optionsList}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.optionsGrid}>
                {getOptionsForCategory(tempCategory).map((option) => {
                  const isSelected =
                    selected.category === tempCategory &&
                    selected.value === option.id;
                  return (
                    <Pressable
                      key={option.id}
                      onPress={() => handleValueSelect(option.id)}
                      style={[
                        styles.optionItem,
                        {
                          backgroundColor: isSelected
                            ? theme.primary
                            : theme.backgroundElevated,
                          borderColor: isSelected
                            ? theme.primary
                            : theme.border,
                        },
                      ]}
                    >
                      <ThemedText
                        type="small"
                        style={{
                          color: isSelected ? "#FFFFFF" : theme.text,
                          fontWeight: isSelected ? "600" : "400",
                          textAlign: "center",
                        }}
                      >
                        {option.label}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

export { getCurrentDefaults };

const styles = StyleSheet.create({
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: "500",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: "70%",
    paddingBottom: Spacing.xl,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.lg,
    borderBottomWidth: 1,
  },
  categoryTabs: {
    flexDirection: "row",
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  categoryTab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: "center",
  },
  optionsList: {
    maxHeight: 300,
  },
  optionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  optionItem: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    minWidth: "30%",
    flexGrow: 1,
  },
});
