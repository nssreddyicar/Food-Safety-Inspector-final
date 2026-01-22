import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ScannerScreen from "@/screens/ScannerScreen";
import ScannedNotesScreen from "@/screens/ScannedNotesScreen";
import NoteDetailScreen from "@/screens/NoteDetailScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

interface ScannedNote {
  id: string;
  data: string;
  type: string;
  heading: string;
  scannedAt: string;
}

export type ScannerStackParamList = {
  Scanner: undefined;
  ScannedNotes: undefined;
  NoteDetail: { note: ScannedNote };
};

const Stack = createNativeStackNavigator<ScannerStackParamList>();

export default function ScannerStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Scanner"
        component={ScannerScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="ScannedNotes"
        component={ScannedNotesScreen}
        options={{
          headerTitle: "Scanned Notes",
        }}
      />
      <Stack.Screen
        name="NoteDetail"
        component={NoteDetailScreen}
        options={{
          headerTitle: "Note Details",
        }}
      />
    </Stack.Navigator>
  );
}
