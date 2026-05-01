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
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { colors, fontSize, spacing, radius } from "@/lib/theme";

interface Agreement {
  id: string;
  status: string;
  joined_at: string;
  agreement: {
    title: string;
    category: string | null;
    status: string;
    valid_from: string | null;
    valid_to: string | null;
    suppliers: { name: string } | null;
  } | null;
}

const statusLabels: Record<string, string> = {
  enrolled: "Påmeldt",
  awaiting_inspection: "Venter befaring",
  offer_received: "Tilbud mottatt",
  active: "Aktiv",
  terminated: "Avsluttet",
};

const statusBadgeStyles: Record<string, { bg: string; text: string }> = {
  enrolled: { bg: colors.primaryBg, text: colors.primary },
  awaiting_inspection: { bg: colors.warningBg, text: colors.warning },
  offer_received: { bg: "#E0E7FF", text: "#3730A3" },
  active: { bg: colors.successBg, text: colors.success },
  terminated: { bg: "#F3F4F6", text: "#4B5563" },
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
      .from("organization_agreements")
      .select(`
        id,
        status,
        joined_at,
        agreement:agreements (
          title,
          category,
          status,
          valid_from,
          valid_to,
          suppliers:supplier_id (name)
        )
      `)
      .eq("organization_id", membership.organization_id)
      .order("joined_at", { ascending: false });

    const mapped = (data ?? [])
      .filter((d: any) => d.agreement !== null)
      .map((d: any) => ({
        id: d.id,
        status: d.status,
        joined_at: d.joined_at,
        agreement: Array.isArray(d.agreement) ? d.agreement[0] : d.agreement,
      }));
    setAgreements(mapped as Agreement[]);
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
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      style={s.screen}
      contentContainerStyle={{ padding: spacing.xl }}
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
        const agr = item.agreement;
        return (
          <TouchableOpacity
            style={s.card}
            onPress={() => setExpanded(expanded === item.id ? null : item.id)}
            activeOpacity={0.7}
          >
            <View style={s.cardRow}>
              <View style={s.iconWrap}>
                <FontAwesome name="calendar-o" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.vendor}>
                  {agr?.suppliers?.name ?? "Ukjent leverandør"}
                </Text>
                <Text style={s.type}>
                  {agr?.title ?? agr?.category ?? "—"}
                </Text>
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
                  <Text style={s.detailLabel}>Gyldig fra</Text>
                  <Text style={s.detailValue}>{formatDate(agr?.valid_from ?? null)}</Text>
                </View>
                <View style={s.detailRow}>
                  <Text style={s.detailLabel}>Gyldig til</Text>
                  <Text style={s.detailValue}>{formatDate(agr?.valid_to ?? null)}</Text>
                </View>
                <View style={s.detailRow}>
                  <Text style={s.detailLabel}>Påmeldt</Text>
                  <Text style={s.detailValue}>{formatDate(item.joined_at)}</Text>
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
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  emptyText: {
    color: colors.muted,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryBg,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  vendor: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    color: colors.text,
  },
  type: {
    fontSize: fontSize.md,
    color: colors.muted,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.full,
    marginLeft: spacing.sm,
  },
  badgeText: {
    fontSize: fontSize.xs,
    fontWeight: "600",
  },
  details: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  detailLabel: {
    fontSize: fontSize.md,
    color: colors.muted,
  },
  detailValue: {
    fontSize: fontSize.md,
    color: colors.text,
  },
});
