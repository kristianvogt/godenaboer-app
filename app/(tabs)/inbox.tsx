import { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
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

interface Conversation {
  id: string;
  subject: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
}

export default function InboxScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchConversations() {
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
      .from("conversations")
      .select("id, subject, last_message_at, last_message_preview, unread_count")
      .eq("entity_type", "organization")
      .eq("entity_id", membership.organization_id)
      .order("last_message_at", { ascending: false });

    setConversations(data ?? []);
    setLoading(false);
  }

  useFocusEffect(
    useCallback(() => {
      fetchConversations();
    }, [user])
  );

  async function onRefresh() {
    setRefreshing(true);
    await fetchConversations();
    setRefreshing(false);
  }

  function timeAgo(dateStr: string | null) {
    if (!dateStr) return "";
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Nå";
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}t`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
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
      data={conversations}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      ListEmptyComponent={
        <View style={{ alignItems: "center", paddingTop: 80 }}>
          <FontAwesome name="inbox" size={48} color={colors.border} />
          <Text style={s.emptyText}>Ingen meldinger ennå.</Text>
        </View>
      }
      renderItem={({ item }) => {
        const isUnread = item.unread_count > 0;
        return (
          <TouchableOpacity
            style={s.card}
            onPress={() => router.push(`/conversations/${item.id}`)}
            activeOpacity={0.7}
          >
            <View style={s.row}>
              <View style={[s.iconWrap, isUnread && s.iconWrapUnread]}>
                <FontAwesome
                  name="envelope-o"
                  size={18}
                  color={isUnread ? colors.primary : colors.muted}
                />
              </View>
              <View style={s.content}>
                <View style={s.topRow}>
                  <Text
                    style={[s.subject, isUnread && s.subjectUnread]}
                    numberOfLines={1}
                  >
                    {item.subject}
                  </Text>
                  <Text style={s.time}>{timeAgo(item.last_message_at)}</Text>
                </View>
                <Text style={s.preview} numberOfLines={2}>
                  {item.last_message_preview ?? "Ingen meldinger"}
                </Text>
              </View>
              {isUnread && (
                <View style={s.unreadBadge}>
                  <Text style={s.unreadText}>
                    {item.unread_count > 99 ? "99+" : item.unread_count}
                  </Text>
                </View>
              )}
            </View>
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
    fontSize: fontSize.md,
    marginTop: spacing.lg,
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
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  iconWrapUnread: {
    backgroundColor: colors.primaryBg,
  },
  content: {
    flex: 1,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  subject: {
    fontSize: fontSize.md,
    fontWeight: "500",
    color: colors.text,
    flex: 1,
    marginRight: spacing.sm,
  },
  subjectUnread: {
    fontWeight: "700",
  },
  time: {
    fontSize: fontSize.xs,
    color: colors.muted,
  },
  preview: {
    fontSize: fontSize.sm,
    color: colors.muted,
    lineHeight: 18,
  },
  unreadBadge: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    marginLeft: spacing.sm,
  },
  unreadText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
});
