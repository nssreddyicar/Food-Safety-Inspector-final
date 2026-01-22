import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Image,
  Pressable,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { JurisdictionSwitcher } from "@/components/JurisdictionSwitcher";
import { useTheme } from "@/hooks/useTheme";
import { useAuthContext } from "@/context/AuthContext";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";
import { ProfileStackParamList } from "@/navigation/ProfileStackNavigator";

interface MenuItemProps {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
}

function MenuItem({ icon, label, value, onPress, danger }: MenuItemProps) {
  const { theme } = useTheme();
  const color = danger ? theme.accent : theme.text;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuItem,
        { backgroundColor: theme.backgroundDefault },
        pressed && { opacity: 0.8 },
      ]}
    >
      <View
        style={[
          styles.menuIcon,
          { backgroundColor: (danger ? theme.accent : theme.primary) + "15" },
        ]}
      >
        <Feather
          name={icon}
          size={18}
          color={danger ? theme.accent : theme.primary}
        />
      </View>
      <View style={styles.menuContent}>
        <ThemedText type="body" style={{ color }}>
          {label}
        </ThemedText>
        {value ? (
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {value}
          </ThemedText>
        ) : null}
      </View>
      {onPress ? (
        <Feather name="chevron-right" size={18} color={theme.textSecondary} />
      ) : null}
    </Pressable>
  );
}

type ProfileNavigationProp = NativeStackNavigationProp<
  ProfileStackParamList,
  "Profile"
>;

export default function ProfileScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<ProfileNavigationProp>();
  const { user, logout } = useAuthContext();
  const [showJurisdictionSwitcher, setShowJurisdictionSwitcher] =
    useState(false);

  const hasMultipleJurisdictions = (user?.allJurisdictions?.length || 0) > 1;

  const handleLogout = () => {
    if (Platform.OS === "web") {
      logout();
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out of Food Safety Inspector?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            logout();
          },
        },
      ],
    );
  };

  const handleOpenAdminPanel = async () => {
    const adminUrl = `${getApiUrl()}/admin`;
    if (Platform.OS === "web") {
      window.open(adminUrl, "_blank");
    } else {
      await WebBrowser.openBrowserAsync(adminUrl);
    }
  };

  return (
    <KeyboardAwareScrollViewCompat
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: tabBarHeight + Spacing.xl,
        },
      ]}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
    >
      <View
        style={[
          styles.profileCard,
          { backgroundColor: theme.backgroundDefault },
          Shadows.md,
        ]}
      >
        <View
          style={[styles.avatarContainer, { backgroundColor: theme.primary }]}
        >
          <ThemedText type="h1" style={{ color: "#FFFFFF" }}>
            {user?.name?.charAt(0).toUpperCase() || "U"}
          </ThemedText>
        </View>
        <ThemedText type="h2" style={styles.name}>
          {user?.name || "Officer"}
        </ThemedText>
        <ThemedText type="body" style={{ color: theme.textSecondary }}>
          {user?.email || "officer@fssai.gov.in"}
        </ThemedText>
        <View style={[styles.badge, { backgroundColor: theme.primary + "15" }]}>
          <Feather name="shield" size={14} color={theme.primary} />
          <ThemedText
            type="small"
            style={{ color: theme.primary, fontWeight: "600" }}
          >
            {user?.designation || "Food Safety Officer"}
          </ThemedText>
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          Account Information
        </ThemedText>
        <View style={[styles.menuGroup, Shadows.sm]}>
          <MenuItem
            icon="map-pin"
            label="Jurisdiction"
            value={user?.jurisdiction?.unitName || "Not assigned"}
            onPress={
              hasMultipleJurisdictions
                ? () => setShowJurisdictionSwitcher(true)
                : undefined
            }
          />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <MenuItem
            icon="briefcase"
            label="Assignment"
            value={
              user?.jurisdiction?.roleName && user?.jurisdiction?.capacityName
                ? `${user.jurisdiction.roleName} (${user.jurisdiction.capacityName})`
                : user?.jurisdiction?.roleName ||
                  user?.role?.toUpperCase() ||
                  "FSO"
            }
          />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          {user?.employeeId ? (
            <>
              <MenuItem
                icon="hash"
                label="Employee ID"
                value={user.employeeId}
              />
              <View
                style={[styles.divider, { backgroundColor: theme.border }]}
              />
            </>
          ) : null}
          {user?.phone ? (
            <>
              <MenuItem icon="phone" label="Phone" value={user.phone} />
              <View
                style={[styles.divider, { backgroundColor: theme.border }]}
              />
            </>
          ) : null}
          <MenuItem
            icon="user"
            label="User ID"
            value={user?.id?.substring(0, 8) || "N/A"}
          />
        </View>
      </View>

      {hasMultipleJurisdictions ? (
        <View style={styles.section}>
          <ThemedText type="h4" style={styles.sectionTitle}>
            Jurisdiction
          </ThemedText>
          <View style={[styles.menuGroup, Shadows.sm]}>
            <MenuItem
              icon="repeat"
              label="Switch Jurisdiction"
              value={`${user?.allJurisdictions?.length || 0} assigned jurisdictions`}
              onPress={() => setShowJurisdictionSwitcher(true)}
            />
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          Sample Management
        </ThemedText>
        <View style={[styles.menuGroup, Shadows.sm]}>
          <MenuItem
            icon="database"
            label="Sample Code Bank"
            value="Generate & manage sample codes"
            onPress={() => navigation.navigate("SampleCodeBank")}
          />
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          Prosecution
        </ThemedText>
        <View style={[styles.menuGroup, Shadows.sm]}>
          <MenuItem
            icon="briefcase"
            label="Court Cases"
            value="Track prosecution cases & hearings"
            onPress={() => navigation.navigate("CourtCases")}
          />
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          Travel Records
        </ThemedText>
        <View style={[styles.menuGroup, Shadows.sm]}>
          <MenuItem
            icon="map"
            label="Tour Diary"
            value="Monthly travel log & distance tracking"
            onPress={() => navigation.navigate("TourDiary")}
          />
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          Settings
        </ThemedText>
        <View style={[styles.menuGroup, Shadows.sm]}>
          <MenuItem icon="bell" label="Notifications" onPress={() => {}} />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <MenuItem
            icon="help-circle"
            label="Help & Support"
            onPress={() => {}}
          />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <MenuItem icon="info" label="About" value="Version 1.0.0" />
        </View>
      </View>

      {user?.showAdminPanel ? (
        <View style={styles.section}>
          <ThemedText type="h4" style={styles.sectionTitle}>
            Administration
          </ThemedText>
          <View style={[styles.menuGroup, Shadows.sm]}>
            <MenuItem
              icon="shield"
              label="Super Admin Panel"
              onPress={handleOpenAdminPanel}
            />
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <View style={[styles.menuGroup, Shadows.sm]}>
          <MenuItem
            icon="log-out"
            label="Sign Out"
            onPress={handleLogout}
            danger
          />
        </View>
      </View>

      <ThemedText
        type="small"
        style={[styles.footer, { color: theme.textSecondary }]}
      >
        Food Safety and Standards Authority of India
      </ThemedText>

      <JurisdictionSwitcher
        visible={showJurisdictionSwitcher}
        onClose={() => setShowJurisdictionSwitcher(false)}
      />
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.xl,
  },
  profileCard: {
    alignItems: "center",
    padding: Spacing["2xl"],
    borderRadius: BorderRadius.xl,
    gap: Spacing.sm,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  name: {
    textAlign: "center",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.sm,
  },
  section: {
    gap: Spacing.md,
  },
  sectionTitle: {
    marginLeft: Spacing.xs,
  },
  menuGroup: {
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  menuContent: {
    flex: 1,
    gap: 2,
  },
  divider: {
    height: 1,
    marginLeft: 68,
  },
  footer: {
    textAlign: "center",
    marginTop: Spacing.lg,
  },
});
