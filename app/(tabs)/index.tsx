import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

interface SameieData {
  name: string;
  address: string;
  unit_count: number;
  active_agreements: number;
  open_tickets: number;
}

export default function HomeScreen() {
  const { user } = useAuth();
  const [data, setData] = useState<SameieData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchData() {
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

    const [sameieRes, agreementsRes, ticketsRes] = await Promise.all([
      supabase
        .from("sameier")
        .select("name, address, unit_count")
        .eq("id", profile.sameie_id)
        .single(),
      supabase
        .from("agreements")
        .select("id", { count: "exact", head: true })
        .eq("sameie_id", profile.sameie_id)
        .eq("status", "active"),
      supabase
        .from("tickets")
        .select("id", { count: "exact", head: true })
        .eq("sameie_id", profile.sameie_id)
        .in("status", ["open", "in_progress"]),
    ]);

    if (sameieRes.data) {
      setData({
        name: sameieRes.data.name,
        address: sameieRes.data.address,
        unit_count: sameieRes.data.unit_count,
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
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#1F2937" />
      </View>
    );
  }

  if (!data) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 px-8">
        <Text className="text-secondary text-center">
          Ingen sameie tilknyttet din bruker.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View className="px-5 pt-6 pb-4">
        <Text className="text-2xl font-bold text-primary">{data.name}</Text>
        <Text className="text-secondary mt-1">{data.address}</Text>
      </View>

      <View className="px-5">
        <View className="bg-white rounded-xl p-5 shadow-sm mb-4">
          <Text className="text-sm text-secondary mb-1">Enheter</Text>
          <Text className="text-3xl font-bold text-primary">
            {data.unit_count}
          </Text>
        </View>

        <View className="flex-row gap-4">
          <View className="flex-1 bg-white rounded-xl p-5 shadow-sm">
            <Text className="text-sm text-secondary mb-1">Aktive avtaler</Text>
            <Text className="text-3xl font-bold text-accent">
              {data.active_agreements}
            </Text>
          </View>

          <View className="flex-1 bg-white rounded-xl p-5 shadow-sm">
            <Text className="text-sm text-secondary mb-1">Åpne tickets</Text>
            <Text className="text-3xl font-bold text-accent">
              {data.open_tickets}
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
