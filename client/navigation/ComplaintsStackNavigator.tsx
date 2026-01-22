import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ComplaintsScreen from "@/screens/ComplaintsScreen";
import ComplaintDetailsScreen from "@/screens/ComplaintDetailsScreen";
import SubmitComplaintScreen from "@/screens/SubmitComplaintScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type ComplaintsStackParamList = {
  Complaints: undefined;
  ComplaintDetails: { complaintId: string };
  SubmitComplaint: { token?: string; districtId?: string } | undefined;
};

const Stack = createNativeStackNavigator<ComplaintsStackParamList>();

export default function ComplaintsStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Complaints"
        component={ComplaintsScreen}
        options={{
          headerTitle: "Complaints",
        }}
      />
      <Stack.Screen
        name="ComplaintDetails"
        component={ComplaintDetailsScreen}
        options={{
          headerTitle: "Complaint Details",
        }}
      />
      <Stack.Screen
        name="SubmitComplaint"
        component={SubmitComplaintScreen}
        options={{
          headerTitle: "Submit Complaint",
        }}
      />
    </Stack.Navigator>
  );
}
