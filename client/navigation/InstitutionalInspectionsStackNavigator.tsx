import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import InstitutionalInspectionsScreen from "@/screens/InstitutionalInspectionsScreen";
import SafetyAssessmentScreen from "@/screens/SafetyAssessmentScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type InstitutionalInspectionsStackParamList = {
  InspectionsList: undefined;
  SafetyAssessment: undefined;
  InspectionDetails: { inspectionId: string };
};

const Stack = createNativeStackNavigator<InstitutionalInspectionsStackParamList>();

export default function InstitutionalInspectionsStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="InspectionsList"
        component={InstitutionalInspectionsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="SafetyAssessment"
        component={SafetyAssessmentScreen}
        options={{ headerTitle: "New Assessment" }}
      />
      <Stack.Screen
        name="InspectionDetails"
        component={SafetyAssessmentScreen}
        options={{ headerTitle: "Inspection Details" }}
      />
    </Stack.Navigator>
  );
}
