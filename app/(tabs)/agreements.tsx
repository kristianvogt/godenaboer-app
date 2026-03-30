import { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
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

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  expired: "bg-gray-100 text-gray-600",
  cancelled: "bg-red-100 text-red-800",
};

export default function AgreementsScreen() {
  const { user } = useAuth();
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function fetchAgreements() {
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
      .from("agreements")
      .select("id, vendor, type, status, start_date, end_date")
      .eq("sameie_id", profile.sameie_id)
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
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#1F2937" />
      </View>
    );
  }

  return (
    <FlatList
      className="flex-1 bg-gray-50"
      contentContainerStyle={{ padding: 20 }}
      data={agreements}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      ListEmptyComponent={
        <View className="items-center pt-20">
          <Text className="text-secondary">Ingen avtaler funnet.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          className="bg-white rounded-xl p-4 mb-3 shadow-sm"
          onPress={() => setExpanded(expanded === item.id ? null : item.id)}
          activeOpacity={0.7}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-base font-semibold text-primary">
                {item.vendor}
              </Text>
              <Text className="text-sm text-secondary mt-0.5">{item.type}</Text>
            </View>
            <View
              className={`px-3 py-1 rounded-full ${statusColors[item.status] ?? "bg-gray-100 text-gray-600"}`}
            >
              <Text className="text-xs font-medium">
                {statusLabels[item.status] ?? item.status}
              </Text>
            </View>
          </View>

          {expanded === item.id && (
            <View className="mt-3 pt-3 border-t border-gray-100">
              <View className="flex-row justify-between mb-1">
                <Text className="text-sm text-secondary">Startdato</Text>
                <Text className="text-sm text-primary">
                  {formatDate(item.start_date)}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-sm text-secondary">Sluttdato</Text>
                <Text className="text-sm text-primary">
                  {formatDate(item.end_date)}
                </Text>
              </View>
            </View>
          )}
        </TouchableOpacity>
      )}
    />
  );
}
