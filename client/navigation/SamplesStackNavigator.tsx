import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import SamplesScreen from "@/screens/SamplesScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type SamplesStackParamList = {
  Samples: undefined;
};

const Stack = createNativeStackNavigator<SamplesStackParamList>();

export default function SamplesStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Samples"
        component={SamplesScreen}
        options={{
          headerTitle: "Samples",
        }}
      />
    </Stack.Navigator>
  );
}
