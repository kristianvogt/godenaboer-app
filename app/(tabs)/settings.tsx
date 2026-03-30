import { View, Text, TouchableOpacity, Alert } from "react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { registerForPushNotifications } from "@/lib/notifications";

export default function SettingsScreen() {
  const { user } = useAuth();

  async function handleLogout() {
    Alert.alert("Logg ut", "Er du sikker på at du vil logge ut?", [
      { text: "Avbryt", style: "cancel" },
      {
        text: "Logg ut",
        style: "destructive",
        onPress: async () => {
          await supabase.auth.signOut();
        },
      },
    ]);
  }

  async function handleEnablePush() {
    if (!user) return;
    const token = await registerForPushNotifications(user.id);
    if (token) {
      Alert.alert("Aktivert", "Push-varsler er nå aktivert.");
    } else {
      Alert.alert(
        "Ikke tilgjengelig",
        "Kunne ikke aktivere push-varsler. Sjekk at du bruker en fysisk enhet og har gitt tillatelse."
      );
    }
  }

  return (
    <View className="flex-1 bg-gray-50 px-5 pt-6">
      <View className="bg-white rounded-xl p-5 shadow-sm mb-4">
        <Text className="text-sm text-secondary mb-1">Innlogget som</Text>
        <Text className="text-base font-semibold text-primary">
          {user?.email}
        </Text>
      </View>

      <TouchableOpacity
        className="bg-white rounded-xl p-4 shadow-sm mb-3"
        onPress={handleEnablePush}
      >
        <Text className="text-base text-primary text-center">
          Aktiver push-varsler
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        className="bg-white rounded-xl p-4 shadow-sm"
        onPress={handleLogout}
      >
        <Text className="text-base text-red-600 text-center font-medium">
          Logg ut
        </Text>
      </TouchableOpacity>
    </View>
  );
}
