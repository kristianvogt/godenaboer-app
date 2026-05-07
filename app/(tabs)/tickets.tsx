import { useState, useCallback } from "react";
import {
  View,
  Text,
  SectionList,
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
import { ticketStatusLabels, ticketStatusBadgeStyles, defaultTicketBadge, OPEN_TICKET_STATUSES } from "@/lib/ticketStatus";

interface Ticket {
  id: string;
  subject: string;
  status: string;
  created_at: string;
  profiles: { full_name: string } | null;
}

const avatarColors = [
  "#2563EB", "#7C3AED", "#DB2777", "#EA580C", "#059669", "#0891B2",
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function TicketsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchTickets() {
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
      .from("tickets")
      .select("id, subject, status, created_at, profiles:created_by(full_name)")
      .eq("organization_id", membership.organization_id)
      .order("created_at", { ascending: false });

    const mapped = (data ?? []).map((t: any) => ({
      ...t,
      profiles: Array.isArray(t.profiles) ? t.profiles[0] : t.profiles,
    }));

    setTickets(mapped);
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

  const openTickets = tickets.filter((t) => OPEN_TICKET_STATUSES.includes(t.status));
  const resolvedTickets = tickets.filter((t) => !OPEN_TICKET_STATUSES.includes(t.status));

  const sections = [
    ...(openTickets.length > 0
      ? [{ title: `Åpne · ${openTickets.length}`, data: openTickets }]
      : []),
    ...(resolvedTickets.length > 0
      ? [{ title: `Løste · ${resolvedTickets.length}`, data: resolvedTickets }]
      : []),
  ];

  if (loading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <SectionList
        contentContainerStyle={{ padding: spacing.xl }}
        sections={sections}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingTop: 80 }}>
            <Text style={s.emptyText}>Ingen saker funnet.</Text>
          </View>
        }
        renderSectionHeader={({ section: { title } }) => (
          <Text style={s.sectionHeader}>{title}</Text>
        )}
        renderItem={({ item }) => {
          const badge = ticketStatusBadgeStyles[item.status] ?? defaultTicketBadge;
          const name = item.profiles?.full_name ?? "Ukjent";
          const avatarBg = getAvatarColor(name);
          const initials = getInitials(name);
          return (
            <TouchableOpacity
              style={s.card}
              onPress={() => router.push(`/tickets/${item.id}`)}
              activeOpacity={0.7}
            >
              <View style={[s.avatar, { backgroundColor: avatarBg }]}>
                <Text style={s.avatarText}>{initials}</Text>
              </View>
              <View style={s.cardContent}>
                <View style={s.cardHeader}>
                  <Text style={s.ticketTitle} numberOfLines={1}>
                    {item.subject}
                  </Text>
                  <View style={[s.badge, { backgroundColor: badge.bg }]}>
                    <Text style={[s.badgeText, { color: badge.text }]}>
                      {ticketStatusLabels[item.status] ?? item.status}
                    </Text>
                  </View>
                </View>
                <Text style={s.ticketMeta}>
                  {name} ·{" "}
                  {new Date(item.created_at).toLocaleDateString("nb-NO")}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      <TouchableOpacity
        style={s.fab}
        onPress={() => router.push("/tickets/new")}
      >
        <FontAwesome name="plus" size={18} color="#fff" />
        <Text style={s.fabText}>Ny henvendelse</Text>
      </TouchableOpacity>
    </View>
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
  sectionHeader: {
    fontSize: fontSize.md,
    fontWeight: "700",
    color: colors.muted,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  card: {
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
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  avatarText: {
    color: "#fff",
    fontSize: fontSize.sm,
    fontWeight: "700",
  },
  cardContent: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
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
  ticketTitle: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.text,
    flex: 1,
  },
  ticketMeta: {
    fontSize: fontSize.sm,
    color: colors.muted,
    marginTop: 2,
  },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 20,
    left: 20,
    backgroundColor: colors.primary,
    height: 52,
    borderRadius: radius.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  fabText: {
    color: "#fff",
    fontSize: fontSize.lg,
    fontWeight: "600",
  },
});
