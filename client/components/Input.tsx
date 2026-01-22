import React, { forwardRef } from "react";
import {
  View,
  TextInput,
  StyleSheet,
  TextInputProps,
  ViewStyle,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing } from "@/constants/theme";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  icon?: keyof typeof Feather.glyphMap;
  containerStyle?: ViewStyle;
}

export const Input = forwardRef<TextInput, InputProps>(
  ({ label, error, icon, containerStyle, style, ...props }, ref) => {
    const { theme, isDark } = useTheme();

    return (
      <View style={[styles.container, containerStyle]}>
        {label ? (
          <ThemedText type="h4" style={styles.label}>
            {label}
          </ThemedText>
        ) : null}
        <View
          style={[
            styles.inputContainer,
            {
              backgroundColor: theme.backgroundSecondary,
              borderColor: error ? theme.accent : theme.border,
            },
          ]}
        >
          {icon ? (
            <Feather
              name={icon}
              size={18}
              color={theme.textSecondary}
              style={styles.icon}
            />
          ) : null}
          <TextInput
            ref={ref}
            style={[
              styles.input,
              { color: theme.text },
              icon && { paddingLeft: 0 },
              style,
            ]}
            placeholderTextColor={theme.textSecondary}
            selectionColor={theme.primary}
            {...props}
          />
        </View>
        {error ? (
          <ThemedText
            type="small"
            style={[styles.error, { color: theme.accent }]}
          >
            {error}
          </ThemedText>
        ) : null}
      </View>
    );
  },
);

Input.displayName = "Input";

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
  },
  label: {
    marginLeft: Spacing.xs,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
  },
  icon: {
    marginRight: Spacing.md,
  },
  input: {
    flex: 1,
    fontSize: 14,
    height: "100%",
  },
  error: {
    marginLeft: Spacing.xs,
  },
});
