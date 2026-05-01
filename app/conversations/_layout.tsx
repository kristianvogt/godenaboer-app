import { Stack } from "expo-router";

export default function ConversationsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#FFFFFF" },
        headerTitleStyle: { color: "#1F2937", fontWeight: "600" },
        headerBackTitle: "Innboks",
      }}
    />
  );
}
