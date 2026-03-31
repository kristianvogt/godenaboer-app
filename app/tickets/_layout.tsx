import { Stack } from "expo-router";

export default function TicketsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackVisible: true,
        headerStyle: { backgroundColor: "#fff" },
        headerTintColor: "#1F2937",
      }}
    />
  );
}
