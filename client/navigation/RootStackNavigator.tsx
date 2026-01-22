import React from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MainTabNavigator from "@/navigation/MainTabNavigator";
import LoginScreen from "@/screens/LoginScreen";
import NewInspectionScreen from "@/screens/NewInspectionScreen";
import InspectionDetailsScreen from "@/screens/InspectionDetailsScreen";
import SampleDetailsScreen from "@/screens/SampleDetailsScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useAuthContext } from "@/context/AuthContext";
import { useTheme } from "@/hooks/useTheme";

export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  NewInspection: undefined;
  InspectionDetails: { inspectionId: string };
  SampleDetails: { sampleId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStackNavigator() {
  const screenOptions = useScreenOptions();
  const opaqueScreenOptions = useScreenOptions({ transparent: false });
  const { isAuthenticated, isLoading } = useAuthContext();
  const { theme } = useTheme();

  if (isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      {isAuthenticated ? (
        <>
          <Stack.Screen
            name="Main"
            component={MainTabNavigator}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="NewInspection"
            component={NewInspectionScreen}
            options={{
              ...opaqueScreenOptions,
              presentation: "modal",
              headerTitle: "New Inspection",
            }}
          />
          <Stack.Screen
            name="InspectionDetails"
            component={InspectionDetailsScreen}
            options={{
              headerTitle: "Inspection Details",
            }}
          />
          <Stack.Screen
            name="SampleDetails"
            component={SampleDetailsScreen}
            options={{
              headerTitle: "Sample Details",
            }}
          />
        </>
      ) : (
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
