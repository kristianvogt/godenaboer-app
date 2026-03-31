import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

interface OrgData {
  name: string;
  address: string;
  unit_count: number;
  active_agreements: number;
  open_tickets: number;
}

export default function HomeScreen() {
  const { user } = useAuth();
  const [data, setData] = useState<OrgData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchData() {
    if (!user) return;

    const { data: membership, error: membershipError } = await supabase
      .from("memberships")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    console.log("Membership:", membership, "Error:", membershipError?.message);

    if (!membership?.organization_id) {
      setLoading(false);
      return;
    }

    const orgId = membership.organization_id;
    console.log("Organization ID:", orgId);

    const [orgRes, agreementsRes, ticketsRes] = await Promise.all([
      supabase
        .from("organizations")
        .select("name, address, unit_count")
        .eq("id", orgId)
        .single(),
      supabase
        .from("organization_agreements")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("status", "active"),
      supabase
        .from("tickets")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .in("status", ["new", "sent_to_supplier", "reply_received", "in_progress"]),
    ]);

    if (orgRes.data) {
      setData({
        name: orgRes.data.name,
        address: orgRes.data.address,
        unit_count: orgRes.data.unit_count,
        active_agreements: agreementsRes.count ?? 0,
        open_tickets: ticketsRes.count ?? 0,
      });
    }

    setLoading(false);
  }

  useEffect(() => {
    fetchData();
  }, [user]);

  async function onRefresh() {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }

  if (loading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color="#1F2937" />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={[s.centered, { paddingHorizontal: 32 }]}>
        <Text style={s.emptyText}>
          Ingen organisasjon tilknyttet din bruker.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={s.screen}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={s.header}>
        <Text style={s.name}>{data.name}</Text>
        <Text style={s.address}>{data.address}</Text>
      </View>

      <View style={s.content}>
        <View style={s.card}>
          <Text style={s.cardLabel}>Enheter</Text>
          <Text style={s.cardValueLarge}>{data.unit_count}</Text>
        </View>

        <View style={s.row}>
          <View style={[s.card, s.halfCard]}>
            <Text style={s.cardLabel}>Aktive avtaler</Text>
            <Text style={s.cardValueAccent}>{data.active_agreements}</Text>
          </View>

          <View style={[s.card, s.halfCard]}>
            <Text style={s.cardLabel}>Åpne tickets</Text>
            <Text style={s.cardValueAccent}>{data.open_tickets}</Text>
          </View>
        </View>
      </View>
    </ScrollView>
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
    textAlign: "center",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
  },
  name: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1F2937",
  },
  address: {
    color: "#6B7280",
    marginTop: 4,
  },
  content: {
    paddingHorizontal: 20,
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
  halfCard: {
    flex: 1,
  },
  row: {
    flexDirection: "row",
    gap: 16,
  },
  cardLabel: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 4,
  },
  cardValueLarge: {
    fontSize: 30,
    fontWeight: "700",
    color: "#1F2937",
  },
  cardValueAccent: {
    fontSize: 30,
    fontWeight: "700",
    color: "#3B82F6",
  },
});
