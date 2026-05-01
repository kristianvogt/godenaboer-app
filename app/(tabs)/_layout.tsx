import { useEffect, useState } from "react";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Tabs } from "expo-router";
import { View, Text, StyleSheet } from "react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { colors } from "@/lib/theme";

function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>["name"];
  color: string;
}) {
  return <FontAwesome size={24} style={{ marginBottom: -3 }} {...props} />;
}

function TabBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <View style={badgeStyles.container}>
      <Text style={badgeStyles.text}>{count > 99 ? "99+" : count}</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  container: {
    position: "absolute",
    top: -4,
    right: -12,
    backgroundColor: colors.danger,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  text: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
});

export default function TabLayout() {
  const { user } = useAuth();
  const [openTicketCount, setOpenTicketCount] = useState(0);
  const [unreadInboxCount, setUnreadInboxCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    async function fetchCounts() {
      const { data: membership } = await supabase
        .from("memberships")
        .select("organization_id")
        .eq("user_id", user!.id)
        .single();

      if (!membership?.organization_id) return;

      const [ticketRes, inboxRes] = await Promise.all([
        supabase
          .from("tickets")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", membership.organization_id)
          .in("status", ["new", "sent_to_supplier", "reply_received", "in_progress"]),
        supabase
          .from("conversations")
          .select("unread_count")
          .eq("entity_type", "organization")
          .eq("entity_id", membership.organization_id)
          .gt("unread_count", 0),
      ]);

      setOpenTicketCount(ticketRes.count ?? 0);

      const totalUnread = (inboxRes.data ?? []).reduce(
        (sum: number, c: any) => sum + (c.unread_count ?? 0),
        0
      );
      setUnreadInboxCount(totalUnread);
    }

    fetchCounts();
  }, [user]);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: "#9CA3AF",
        tabBarStyle: { backgroundColor: "#FFFFFF" },
        headerStyle: { backgroundColor: "#FFFFFF" },
        headerTitleStyle: { color: colors.text, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Hjem",
          tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: "Innboks",
          tabBarIcon: ({ color }) => (
            <View>
              <TabBarIcon name="envelope-o" color={color} />
              <TabBadge count={unreadInboxCount} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="agreements"
        options={{
          title: "Avtaler",
          tabBarIcon: ({ color }) => (
            <TabBarIcon name="file-text-o" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="tickets"
        options={{
          title: "Saker",
          tabBarIcon: ({ color }) => (
            <View>
              <TabBarIcon name="commenting-o" color={color} />
              <TabBadge count={openTicketCount} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Innstillinger",
          tabBarIcon: ({ color }) => <TabBarIcon name="cog" color={color} />,
        }}
      />
    </Tabs>
  );
}
