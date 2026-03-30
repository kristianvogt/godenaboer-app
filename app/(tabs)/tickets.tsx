import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

interface Ticket {
  id: string;
  ticket_id: string;
  title: string;
  status: string;
  created_at: string;
}

const statusLabels: Record<string, string> = {
  open: "Åpen",
  in_progress: "Under arbeid",
  resolved: "Løst",
  closed: "Lukket",
};

const statusColors: Record<string, string> = {
  open: "bg-blue-100 text-blue-800",
  in_progress: "bg-yellow-100 text-yellow-800",
  resolved: "bg-green-100 text-green-800",
  closed: "bg-gray-100 text-gray-600",
};

export default function TicketsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchTickets() {
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("sameie_id")
      .eq("id", user.id)
      .single();

    if (!profile?.sameie_id) {
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("tickets")
      .select("id, ticket_id, title, status, created_at")
      .eq("sameie_id", profile.sameie_id)
      .order("created_at", { ascending: false });

    setTickets(data ?? []);
    setLoading(false);
  }

  useFocusEffect(
    useCallback(() => {
      fetchTickets();
    }, [user])
  );

  async function onRefresh() {
    setRefreshing(true);
    await fetchTickets();
    setRefreshing(false);
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#1F2937" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <FlatList
        contentContainerStyle={{ padding: 20 }}
        data={tickets}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View className="items-center pt-20">
            <Text className="text-secondary">Ingen tickets funnet.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            className="bg-white rounded-xl p-4 mb-3 shadow-sm"
            onPress={() => router.push(`/tickets/${item.id}`)}
            activeOpacity={0.7}
          >
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-xs font-mono text-secondary">
                {item.ticket_id}
              </Text>
              <View
                className={`px-3 py-1 rounded-full ${statusColors[item.status] ?? "bg-gray-100 text-gray-600"}`}
              >
                <Text className="text-xs font-medium">
                  {statusLabels[item.status] ?? item.status}
                </Text>
              </View>
            </View>
            <Text className="text-base font-semibold text-primary">
              {item.title}
            </Text>
            <Text className="text-xs text-secondary mt-1">
              {new Date(item.created_at).toLocaleDateString("nb-NO")}
            </Text>
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity
        className="absolute bottom-6 right-6 bg-primary w-14 h-14 rounded-full items-center justify-center shadow-lg"
        onPress={() => router.push("/tickets/new")}
      >
        <FontAwesome name="plus" size={20} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}
