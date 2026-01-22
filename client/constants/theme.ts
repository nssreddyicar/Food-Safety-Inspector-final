import { Platform } from "react-native";

export const Colors = {
  light: {
    text: "#111827",
    textSecondary: "#6B7280",
    textDisabled: "#D1D5DB",
    buttonText: "#FFFFFF",
    tabIconDefault: "#6B7280",
    tabIconSelected: "#1E40AF",
    link: "#1E40AF",
    primary: "#1E40AF",
    primaryVariant: "#3B82F6",
    accent: "#DC2626",
    success: "#059669",
    warning: "#D97706",
    backgroundRoot: "#F9FAFB",
    backgroundDefault: "#FFFFFF",
    backgroundSecondary: "#F3F4F6",
    backgroundTertiary: "#E5E7EB",
    border: "#D1D5DB",
    statusDraft: "#9CA3AF",
    statusSubmitted: "#3B82F6",
    statusUnderReview: "#D97706",
    statusClosed: "#059669",
    statusOverdue: "#DC2626",
    backgroundElevated: "#FFFFFF",
  },
  dark: {
    text: "#F9FAFB",
    textSecondary: "#9CA3AF",
    textDisabled: "#4B5563",
    buttonText: "#FFFFFF",
    tabIconDefault: "#9CA3AF",
    tabIconSelected: "#3B82F6",
    link: "#3B82F6",
    primary: "#3B82F6",
    primaryVariant: "#60A5FA",
    accent: "#EF4444",
    success: "#10B981",
    warning: "#F59E0B",
    backgroundRoot: "#111827",
    backgroundDefault: "#1F2937",
    backgroundSecondary: "#374151",
    backgroundTertiary: "#4B5563",
    border: "#374151",
    statusDraft: "#6B7280",
    statusSubmitted: "#3B82F6",
    statusUnderReview: "#F59E0B",
    statusClosed: "#10B981",
    statusOverdue: "#EF4444",
    backgroundElevated: "#374151",
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
  inputHeight: 48,
  buttonHeight: 52,
};

export const FontSize = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  "2xl": 20,
  "3xl": 24,
  "4xl": 28,
};

export const BorderRadius = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  "2xl": 20,
  "3xl": 24,
  full: 9999,
};

export const Typography = {
  h1: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "700" as const,
  },
  h2: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "600" as const,
  },
  h3: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600" as const,
  },
  h4: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600" as const,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400" as const,
  },
  small: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "400" as const,
  },
  link: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600" as const,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
});

export const Shadows = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
};
