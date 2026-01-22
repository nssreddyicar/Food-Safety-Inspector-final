import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ProfileScreen from "@/screens/ProfileScreen";
import TemplatesScreen from "@/screens/TemplatesScreen";
import SampleCodeBankScreen from "@/screens/SampleCodeBankScreen";
import CourtCasesScreen from "@/screens/CourtCasesScreen";
import CaseDetailsScreen from "@/screens/CaseDetailsScreen";
import NewCaseScreen from "@/screens/NewCaseScreen";
import TourDiaryScreen from "@/screens/TourDiaryScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type ProfileStackParamList = {
  Profile: undefined;
  Templates: undefined;
  SampleCodeBank: undefined;
  CourtCases: undefined;
  CaseDetails: { caseId: string };
  NewCase: undefined;
  TourDiary: undefined;
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export default function ProfileStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          headerTitle: "Profile",
        }}
      />
      <Stack.Screen
        name="Templates"
        component={TemplatesScreen}
        options={{
          headerTitle: "Document Templates",
        }}
      />
      <Stack.Screen
        name="SampleCodeBank"
        component={SampleCodeBankScreen}
        options={{
          headerTitle: "Sample Code Bank",
        }}
      />
      <Stack.Screen
        name="CourtCases"
        component={CourtCasesScreen}
        options={{
          headerTitle: "Court Cases",
        }}
      />
      <Stack.Screen
        name="CaseDetails"
        component={CaseDetailsScreen}
        options={{
          headerTitle: "Case Details",
        }}
      />
      <Stack.Screen
        name="NewCase"
        component={NewCaseScreen}
        options={{
          headerTitle: "New Court Case",
        }}
      />
      <Stack.Screen
        name="TourDiary"
        component={TourDiaryScreen}
        options={{
          headerTitle: "Tour Diary",
        }}
      />
    </Stack.Navigator>
  );
}
