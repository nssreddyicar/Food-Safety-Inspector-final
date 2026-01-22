import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet } from "react-native";
import DashboardStackNavigator from "@/navigation/DashboardStackNavigator";
import InspectionsStackNavigator from "@/navigation/InspectionsStackNavigator";
import SamplesStackNavigator from "@/navigation/SamplesStackNavigator";
import ComplaintsStackNavigator from "@/navigation/ComplaintsStackNavigator";
import InstitutionalInspectionsStackNavigator from "@/navigation/InstitutionalInspectionsStackNavigator";
import ProfileStackNavigator from "@/navigation/ProfileStackNavigator";
import { useTheme } from "@/hooks/useTheme";

export type MainTabParamList = {
  DashboardTab: undefined;
  InspectionsTab: undefined;
  InstitutionalTab: undefined;
  SamplesTab: undefined;
  ComplaintsTab: undefined;
  ProfileTab: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabNavigator() {
  const { theme, isDark } = useTheme();

  return (
    <Tab.Navigator
      initialRouteName="DashboardTab"
      screenOptions={{
        tabBarActiveTintColor: theme.tabIconSelected,
        tabBarInactiveTintColor: theme.tabIconDefault,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: Platform.select({
            ios: "transparent",
            android: theme.backgroundRoot,
            web: theme.backgroundRoot,
          }),
          borderTopWidth: 0,
          elevation: 0,
        },
        tabBarBackground: () =>
          Platform.OS === "ios" ? (
            <BlurView
              intensity={100}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : null,
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="DashboardTab"
        component={DashboardStackNavigator}
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }) => (
            <Feather name="home" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="InspectionsTab"
        component={InspectionsStackNavigator}
        options={{
          title: "FBO",
          tabBarIcon: ({ color, size }) => (
            <Feather name="clipboard" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="InstitutionalTab"
        component={InstitutionalInspectionsStackNavigator}
        options={{
          title: "Institutional",
          tabBarIcon: ({ color, size }) => (
            <Feather name="home" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="SamplesTab"
        component={SamplesStackNavigator}
        options={{
          title: "Samples",
          tabBarIcon: ({ color, size }) => (
            <Feather name="droplet" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ComplaintsTab"
        component={ComplaintsStackNavigator}
        options={{
          title: "Complaints",
          tabBarIcon: ({ color, size }) => (
            <Feather name="alert-circle" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStackNavigator}
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Feather name="user" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
