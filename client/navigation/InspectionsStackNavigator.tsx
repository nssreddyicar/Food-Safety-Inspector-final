import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import InspectionsScreen from "@/screens/InspectionsScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type InspectionsStackParamList = {
  Inspections: undefined;
};

const Stack = createNativeStackNavigator<InspectionsStackParamList>();

export default function InspectionsStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Inspections"
        component={InspectionsScreen}
        options={{
          headerTitle: "Inspections",
        }}
      />
    </Stack.Navigator>
  );
}
