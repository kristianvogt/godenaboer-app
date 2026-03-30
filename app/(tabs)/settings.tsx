import { View, Text, TouchableOpacity, Alert, StyleSheet } from "react-native";
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
    <View style={s.screen}>
      <View style={s.card}>
        <Text style={s.cardLabel}>Innlogget som</Text>
        <Text style={s.cardValue}>{user?.email}</Text>
      </View>

      <TouchableOpacity style={s.actionCard} onPress={handleEnablePush}>
        <Text style={s.actionText}>Aktiver push-varsler</Text>
      </TouchableOpacity>

      <TouchableOpacity style={s.actionCard} onPress={handleLogout}>
        <Text style={s.logoutText}>Logg ut</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardLabel: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 4,
  },
  cardValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
  },
  actionCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  actionText: {
    fontSize: 16,
    color: "#1F2937",
    textAlign: "center",
  },
  logoutText: {
    fontSize: 16,
    color: "#DC2626",
    textAlign: "center",
    fontWeight: "500",
  },
});
