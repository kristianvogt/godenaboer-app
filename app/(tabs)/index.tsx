import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { colors, fontSize, spacing, radius } from "@/lib/theme";

interface OrgData {
  name: string;
  role: string;
  open_tickets: number;
  overdue_tickets: number;
  active_agreements: number;
}

interface RecentTicket {
  id: string;
  subject: string;
  status: string;
  created_at: string;
  profiles: { full_name: string } | null;
}

interface RecentAgreement {
  id: string;
  status: string;
  agreement: {
    title: string;
    suppliers: { name: string } | null;
  } | null;
}

const agreementStatusLabels: Record<string, string> = {
  enrolled: "Påmeldt",
  awaiting_inspection: "Venter befaring",
  offer_received: "Tilbud mottatt",
  active: "Aktiv",
  terminated: "Avsluttet",
};

const agreementBadgeStyles: Record<string, { bg: string; text: string }> = {
  enrolled: { bg: colors.primaryBg, text: colors.primary },
  awaiting_inspection: { bg: colors.warningBg, text: colors.warning },
  offer_received: { bg: "#E0E7FF", text: "#3730A3" },
  active: { bg: colors.successBg, text: colors.success },
  terminated: { bg: "#F3F4F6", text: "#4B5563" },
};

const statusLabels: Record<string, string> = {
  new: "Ny",
  sent_to_supplier: "Sendt",
  reply_received: "Svar",
  in_progress: "Under beh.",
  resolved: "Løst",
  rejected: "Avvist",
};

const statusBadgeStyles: Record<string, { bg: string; text: string }> = {
  new: { bg: colors.warningBg, text: colors.warning },
  sent_to_supplier: { bg: colors.primaryBg, text: colors.primary },
  reply_received: { bg: "#E0E7FF", text: "#3730A3" },
  in_progress: { bg: colors.primaryBg, text: colors.primary },
  resolved: { bg: colors.successBg, text: colors.success },
  rejected: { bg: colors.dangerBg, text: colors.danger },
};

const roleLabels: Record<string, string> = {
  admin: "Styre",
  board: "Styre",
  member: "Medlem",
  manager: "Forvalter",
};

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<OrgData | null>(null);
  const [recentTickets, setRecentTickets] = useState<RecentTicket[]>([]);
  const [recentAgreements, setRecentAgreements] = useState<RecentAgreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchData() {
    if (!user) return;

    console.log("[Home] fetchData start, user:", user?.id);

    try {
      const { data: membership, error: membershipError } = await supabase
        .from("memberships")
        .select("organization_id, role")
        .eq("user_id", user.id)
        .single();

      console.log("[Home] membership result:", membership, membershipError?.message);

      if (!membership?.organization_id) {
        setLoading(false);
        return;
      }

      const orgId = membership.organization_id;

      const [orgRes, agreementsRes, openTicketsRes, overdueRes, recentRes, upcomingRes] =
        await Promise.all([
          supabase
            .from("organizations")
            .select("name")
            .eq("id", orgId)
            .single(),
          supabase
            .from("organization_agreements")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", orgId)
            .in("status", ["enrolled", "awaiting_inspection", "offer_received", "active"]),
          supabase
            .from("tickets")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", orgId)
            .in("status", ["new", "sent_to_supplier", "reply_received", "in_progress"]),
          supabase
            .from("tickets")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", orgId)
            .eq("status", "new")
            .lt("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
          supabase
            .from("tickets")
            .select("id, subject, status, created_at, profiles:created_by(full_name)")
            .eq("organization_id", orgId)
            .order("created_at", { ascending: false })
            .limit(3),
          supabase
            .from("organization_agreements")
            .select(`
              id,
              status,
              agreement:agreements (title, suppliers:supplier_id (name))
            `)
            .eq("organization_id", orgId)
            .in("status", ["active", "enrolled", "awaiting_inspection", "offer_received"])
            .order("joined_at", { ascending: false })
            .limit(3),
        ]);

      console.log("[Home] org result:", orgRes.data, orgRes.error?.message);

      if (orgRes.data) {
        setData({
          name: orgRes.data.name,
          role: membership.role ?? "member",
          open_tickets: openTicketsRes.count ?? 0,
          overdue_tickets: overdueRes.count ?? 0,
          active_agreements: agreementsRes.count ?? 0,
        });
      }

      setRecentTickets(
        (recentRes.data ?? []).map((t: any) => ({
          ...t,
          profiles: Array.isArray(t.profiles) ? t.profiles[0] : t.profiles,
        }))
      );

      setRecentAgreements(
        (upcomingRes.data ?? []).map((a: any) => ({
          ...a,
          agreement: Array.isArray(a.agreement) ? a.agreement[0] : a.agreement,
        }))
      );

      setLoading(false);
    } catch (err) {
      console.error("[Home] fetchData error:", err);
      setLoading(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [user])
  );

  async function onRefresh() {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }

  if (loading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={[s.centered, { paddingHorizontal: spacing.xxxl }]}>
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
        <Text style={s.heroTitle}>Gode Naboer</Text>
        <Text style={s.subtitle}>
          {roleLabels[data.role] ?? data.role} · {data.name}
        </Text>
      </View>

      <View style={s.content}>
        {/* Stats row */}
        <View style={s.statsRow}>
          <View style={[s.statCard, { backgroundColor: colors.primaryBg }]}>
            <Text style={[s.statValue, { color: colors.primary }]}>
              {data.open_tickets}
            </Text>
            <Text style={[s.statLabel, { color: colors.primary }]}>
              Åpne saker
            </Text>
          </View>
          <View style={[s.statCard, { backgroundColor: colors.warningBg }]}>
            <Text style={[s.statValue, { color: colors.warning }]}>
              {data.overdue_tickets}
            </Text>
            <Text style={[s.statLabel, { color: colors.warning }]}>
              Forfalt
            </Text>
          </View>
          <View style={[s.statCard, { backgroundColor: colors.successBg }]}>
            <Text style={[s.statValue, { color: colors.success }]}>
              {data.active_agreements}
            </Text>
            <Text style={[s.statLabel, { color: colors.success }]}>
              Aktive avtaler
            </Text>
          </View>
        </View>

        {/* Recent tickets */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Siste henvendelser</Text>
          {recentTickets.length === 0 ? (
            <Text style={s.emptySection}>Ingen saker ennå.</Text>
          ) : (
            recentTickets.map((ticket) => {
              const badge = statusBadgeStyles[ticket.status] ?? { bg: "#F3F4F6", text: "#4B5563" };
              return (
                <TouchableOpacity
                  key={ticket.id}
                  style={s.listCard}
                  onPress={() => router.push(`/tickets/${ticket.id}`)}
                  activeOpacity={0.7}
                >
                  <View style={s.listIconWrap}>
                    <FontAwesome name="commenting-o" size={18} color={colors.primary} />
                  </View>
                  <View style={s.listContent}>
                    <Text style={s.listTitle} numberOfLines={1}>
                      {ticket.subject}
                    </Text>
                    <Text style={s.listMeta}>
                      {ticket.profiles?.full_name ?? "Ukjent"} ·{" "}
                      {new Date(ticket.created_at).toLocaleDateString("nb-NO")}
                    </Text>
                  </View>
                  <View style={[s.badge, { backgroundColor: badge.bg }]}>
                    <Text style={[s.badgeText, { color: badge.text }]}>
                      {statusLabels[ticket.status] ?? ticket.status}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* Agreements */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Avtaler</Text>
          {recentAgreements.length === 0 ? (
            <Text style={s.emptySection}>Ingen avtaler.</Text>
          ) : (
            recentAgreements.map((a) => {
              const aBadge = agreementBadgeStyles[a.status] ?? { bg: "#F3F4F6", text: "#4B5563" };
              return (
                <View key={a.id} style={s.listCard}>
                  <View style={s.listIconWrap}>
                    <FontAwesome name="file-text-o" size={18} color={colors.primary} />
                  </View>
                  <View style={s.listContent}>
                    <Text style={s.listTitle} numberOfLines={1}>
                      {a.agreement?.title ?? "Ukjent avtale"}
                    </Text>
                    <Text style={s.listMeta}>
                      {a.agreement?.suppliers?.name ?? "Ukjent leverandør"}
                    </Text>
                  </View>
                  <View style={[s.badge, { backgroundColor: aBadge.bg }]}>
                    <Text style={[s.badgeText, { color: aBadge.text }]}>
                      {agreementStatusLabels[a.status] ?? a.status}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </View>
    </ScrollView>
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
    textAlign: "center",
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.lg,
  },
  heroTitle: {
    fontSize: fontSize.hero,
    fontWeight: "700",
    color: colors.text,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.muted,
    marginTop: spacing.xs,
  },
  content: {
    paddingHorizontal: spacing.xl,
  },
  statsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.xxl,
  },
  statCard: {
    flex: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "center",
  },
  statValue: {
    fontSize: fontSize.xxl,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: fontSize.xs,
    fontWeight: "500",
    marginTop: spacing.xs,
    textAlign: "center",
  },
  section: {
    marginBottom: spacing.xxl,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    color: colors.text,
    marginBottom: spacing.md,
  },
  emptySection: {
    color: colors.muted,
    fontSize: fontSize.md,
  },
  listCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  listIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  listContent: {
    flex: 1,
  },
  listTitle: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.text,
  },
  listMeta: {
    fontSize: fontSize.sm,
    color: colors.muted,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    marginLeft: spacing.sm,
  },
  badgeText: {
    fontSize: fontSize.xs,
    fontWeight: "600",
  },
});
