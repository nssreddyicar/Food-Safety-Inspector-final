import React, { useState, useRef } from "react";
import {
  View,
  StyleSheet,
  Image,
  TextInput,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { ThemedText } from "@/components/ThemedText";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useAuthContext } from "@/context/AuthContext";
import { Spacing, BorderRadius } from "@/constants/theme";

export default function LoginScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { login, isLoading } = useAuthContext();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const passwordRef = useRef<TextInput>(null);

  const handleLogin = async () => {
    setError("");

    if (!email.trim()) {
      setError("Please enter your email");
      return;
    }

    if (!password.trim()) {
      setError("Please enter your password");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    const success = await login(email, password);
    if (success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError("Invalid credentials. Please try again.");
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.primary }]}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + Spacing["3xl"],
            paddingBottom: insets.bottom + Spacing["2xl"],
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Image
            source={require("../../assets/images/splash-icon.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <ThemedText type="h1" style={[styles.title, { color: "#FFFFFF" }]}>
            Food Safety Inspector
          </ThemedText>
          <ThemedText
            type="body"
            style={[styles.subtitle, { color: "rgba(255,255,255,0.8)" }]}
          >
            Government of India - FSSAI
          </ThemedText>
        </View>

        <View
          style={[styles.card, { backgroundColor: theme.backgroundDefault }]}
        >
          <ThemedText type="h2" style={styles.cardTitle}>
            Sign In
          </ThemedText>
          <ThemedText
            type="body"
            style={[styles.cardSubtitle, { color: theme.textSecondary }]}
          >
            Use your official credentials to access
          </ThemedText>

          <View style={styles.form}>
            <Input
              label="Email"
              placeholder="officer@fssai.gov.in"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              icon="mail"
              testID="input-email"
            />

            <View>
              <Input
                ref={passwordRef}
                label="Password"
                placeholder="Enter your password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="password"
                returnKeyType="done"
                onSubmitEditing={handleLogin}
                icon="lock"
                testID="input-password"
              />
              <Pressable
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
              >
                <Feather
                  name={showPassword ? "eye-off" : "eye"}
                  size={18}
                  color={theme.textSecondary}
                />
              </Pressable>
            </View>

            {error ? (
              <View
                style={[
                  styles.errorContainer,
                  { backgroundColor: theme.accent + "15" },
                ]}
              >
                <Feather name="alert-circle" size={16} color={theme.accent} />
                <ThemedText
                  type="small"
                  style={{ color: theme.accent, flex: 1 }}
                >
                  {error}
                </ThemedText>
              </View>
            ) : null}

            <Button
              onPress={handleLogin}
              disabled={isLoading}
              style={styles.loginButton}
              testID="button-login"
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                "Sign In"
              )}
            </Button>
          </View>

          <ThemedText
            type="small"
            style={[styles.helpText, { color: theme.textSecondary }]}
          >
            This is an invite-only system. Contact your administrator if you
            need access.
          </ThemedText>
        </View>

        <ThemedText
          type="small"
          style={[styles.footer, { color: "rgba(255,255,255,0.6)" }]}
        >
          Food Safety and Standards Authority of India
        </ThemedText>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing["3xl"],
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: Spacing.lg,
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.xs,
  },
  subtitle: {
    textAlign: "center",
  },
  card: {
    borderRadius: BorderRadius.xl,
    padding: Spacing["2xl"],
    gap: Spacing.sm,
  },
  cardTitle: {
    textAlign: "center",
  },
  cardSubtitle: {
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  form: {
    gap: Spacing.lg,
  },
  eyeButton: {
    position: "absolute",
    right: Spacing.lg,
    top: 38,
    height: Spacing.inputHeight,
    justifyContent: "center",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  loginButton: {
    marginTop: Spacing.sm,
  },
  helpText: {
    textAlign: "center",
    marginTop: Spacing.lg,
  },
  footer: {
    textAlign: "center",
    marginTop: "auto",
    paddingTop: Spacing["2xl"],
  },
});
