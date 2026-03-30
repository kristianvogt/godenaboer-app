import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
  Platform,
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

const statusBadgeStyles: Record<string, { bg: string; text: string }> = {
  open: { bg: "#DBEAFE", text: "#1E40AF" },
  in_progress: { bg: "#FEF3C7", text: "#92400E" },
  resolved: { bg: "#DCFCE7", text: "#166534" },
  closed: { bg: "#F3F4F6", text: "#4B5563" },
};

const defaultBadge = { bg: "#F3F4F6", text: "#4B5563" };

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
      <View style={s.centered}>
        <ActivityIndicator size="large" color="#1F2937" />
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <FlatList
        contentContainerStyle={{ padding: 20 }}
        data={tickets}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingTop: 80 }}>
            <Text style={s.emptyText}>Ingen tickets funnet.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const badge = statusBadgeStyles[item.status] ?? defaultBadge;
          return (
            <TouchableOpacity
              style={s.card}
              onPress={() => router.push(`/tickets/${item.id}`)}
              activeOpacity={0.7}
            >
              <View style={s.cardHeader}>
                <Text style={s.ticketId}>{item.ticket_id}</Text>
                <View style={[s.badge, { backgroundColor: badge.bg }]}>
                  <Text style={[s.badgeText, { color: badge.text }]}>
                    {statusLabels[item.status] ?? item.status}
                  </Text>
                </View>
              </View>
              <Text style={s.ticketTitle}>{item.title}</Text>
              <Text style={s.ticketDate}>
                {new Date(item.created_at).toLocaleDateString("nb-NO")}
              </Text>
            </TouchableOpacity>
          );
        }}
      />

      <TouchableOpacity
        style={s.fab}
        onPress={() => router.push("/tickets/new")}
      >
        <FontAwesome name="plus" size={20} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F9FAFB",
  },
  emptyText: {
    color: "#6B7280",
  },
  card: {
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
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  ticketId: {
    fontSize: 12,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
    color: "#6B7280",
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "500",
  },
  ticketTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
  },
  ticketDate: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
  },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    backgroundColor: "#1F2937",
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
});
