import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import DashboardScreen from "@/screens/DashboardScreen";
import ActionDashboardScreen from "@/screens/ActionDashboardScreen";
import GenerateReportScreen from "@/screens/GenerateReportScreen";
import { HeaderTitle } from "@/components/HeaderTitle";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { TimeSelection } from "@/components/TimeFilter";

export type DashboardStackParamList = {
  Dashboard: undefined;
  ActionDashboard: undefined;
  GenerateReport: { timeSelection: TimeSelection };
};

const Stack = createNativeStackNavigator<DashboardStackParamList>();

export default function DashboardStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          headerTitle: () => <HeaderTitle title="Food Safety Inspector" />,
        }}
      />
      <Stack.Screen
        name="ActionDashboard"
        component={ActionDashboardScreen}
        options={{
          headerTitle: "Action Dashboard",
        }}
      />
      <Stack.Screen
        name="GenerateReport"
        component={GenerateReportScreen}
        options={{
          headerTitle: "Generate Report",
        }}
      />
    </Stack.Navigator>
  );
}
