import { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

interface Agreement {
  id: string;
  vendor: string;
  type: string;
  status: string;
  start_date: string;
  end_date: string | null;
}

const statusLabels: Record<string, string> = {
  active: "Aktiv",
  expired: "Utløpt",
  cancelled: "Kansellert",
};

const statusBadgeStyles: Record<string, { bg: string; text: string }> = {
  active: { bg: "#DCFCE7", text: "#166534" },
  expired: { bg: "#F3F4F6", text: "#4B5563" },
  cancelled: { bg: "#FEE2E2", text: "#991B1B" },
};

const defaultBadge = { bg: "#F3F4F6", text: "#4B5563" };

export default function AgreementsScreen() {
  const { user } = useAuth();
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function fetchAgreements() {
    if (!user) return;

    const { data: membership } = await supabase
      .from("memberships")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    if (!membership?.organization_id) {
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("org_agreements")
      .select("id, vendor, type, status, start_date, end_date")
      .eq("organization_id", membership.organization_id)
      .order("status", { ascending: true })
      .order("start_date", { ascending: false });

    setAgreements(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    fetchAgreements();
  }, [user]);

  async function onRefresh() {
    setRefreshing(true);
    await fetchAgreements();
    setRefreshing(false);
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("nb-NO");
  }

  if (loading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color="#1F2937" />
      </View>
    );
  }

  return (
    <FlatList
      style={s.screen}
      contentContainerStyle={{ padding: 20 }}
      data={agreements}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      ListEmptyComponent={
        <View style={{ alignItems: "center", paddingTop: 80 }}>
          <Text style={s.emptyText}>Ingen avtaler funnet.</Text>
        </View>
      }
      renderItem={({ item }) => {
        const badge = statusBadgeStyles[item.status] ?? defaultBadge;
        return (
          <TouchableOpacity
            style={s.card}
            onPress={() => setExpanded(expanded === item.id ? null : item.id)}
            activeOpacity={0.7}
          >
            <View style={s.cardRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.vendor}>{item.vendor}</Text>
                <Text style={s.type}>{item.type}</Text>
              </View>
              <View style={[s.badge, { backgroundColor: badge.bg }]}>
                <Text style={[s.badgeText, { color: badge.text }]}>
                  {statusLabels[item.status] ?? item.status}
                </Text>
              </View>
            </View>

            {expanded === item.id && (
              <View style={s.details}>
                <View style={s.detailRow}>
                  <Text style={s.detailLabel}>Startdato</Text>
                  <Text style={s.detailValue}>{formatDate(item.start_date)}</Text>
                </View>
                <View style={s.detailRow}>
                  <Text style={s.detailLabel}>Sluttdato</Text>
                  <Text style={s.detailValue}>{formatDate(item.end_date)}</Text>
                </View>
              </View>
            )}
          </TouchableOpacity>
        );
      }}
    />
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
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  vendor: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
  },
  type: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 2,
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
  details: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  detailLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  detailValue: {
    fontSize: 14,
    color: "#1F2937",
  },
});
