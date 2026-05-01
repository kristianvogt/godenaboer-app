import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useSupplierMembership } from "@/hooks/useSupplierMembership";
import { getDistanceMeters } from "@/lib/distance";
import { colors, fontSize, spacing, radius } from "@/lib/theme";

interface NearbyOrg {
  organizationId: string;
  agreementId: string;
  name: string;
  address: string;
  distance: number;
  latitude: number;
  longitude: number;
}

export default function SupplierHome() {
  const router = useRouter();
  const { supplierId } = useSupplierMembership();
  const [orgs, setOrgs] = useState<NearbyOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLon, setUserLon] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    if (!supplierId) return;

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Tillatelse", "Appen trenger tilgang til posisjon for å vise nærliggende adresser.");
        setLoading(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setUserLat(loc.coords.latitude);
      setUserLon(loc.coords.longitude);

      const { data, error } = await supabase
        .from("organization_agreements")
        .select("id, organization_id, organizations(id, name, address, latitude, longitude)")
        .eq("supplier_id", supplierId)
        .in("status", ["enrolled", "active"]);

      if (error) {
        console.error("Feil ved henting av avtaler:", error);
        return;
      }

      const mapped: NearbyOrg[] = (data ?? [])
        .filter((row: any) => row.organizations?.latitude && row.organizations?.longitude)
        .map((row: any) => {
          const org = row.organizations;
          const dist = getDistanceMeters(
            loc.coords.latitude,
            loc.coords.longitude,
            org.latitude,
            org.longitude
          );
          return {
            organizationId: org.id,
            agreementId: row.id,
            name: org.name,
            address: org.address ?? "",
            distance: dist,
            latitude: org.latitude,
            longitude: org.longitude,
          };
        })
        .sort((a: NearbyOrg, b: NearbyOrg) => a.distance - b.distance);

      setOrgs(mapped);
    } catch (err) {
      console.error("Feil:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [supplierId]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const formatDistance = (meters: number) => {
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const renderItem = ({ item }: { item: NearbyOrg }) => {
    const isNearby = item.distance < 300;
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.indicator, isNearby ? styles.indicatorGreen : styles.indicatorGray]} />
          <View style={styles.cardInfo}>
            <Text style={styles.orgName}>{item.name}</Text>
            <Text style={styles.orgAddress}>{item.address}</Text>
            <Text style={[styles.distance, isNearby && styles.distanceNearby]}>
              {formatDistance(item.distance)}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.checkinButton, isNearby && styles.checkinButtonNearby]}
          onPress={() =>
            router.push({
              pathname: "/(supplier)/checkin",
              params: {
                organizationId: item.organizationId,
                agreementId: item.agreementId,
              },
            })
          }
        >
          <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
          <Text style={styles.checkinButtonText}>Kvitter ut</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Nærliggende adresser</Text>
        <TouchableOpacity onPress={handleSignOut} style={styles.signOutButton}>
          <Ionicons name="log-out-outline" size={22} color={colors.muted} />
        </TouchableOpacity>
      </View>
      <FlatList
        data={orgs}
        keyExtractor={(item) => `${item.organizationId}-${item.agreementId}`}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchData();
            }}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="location-outline" size={48} color={colors.muted} />
            <Text style={styles.emptyText}>Ingen aktive avtaler funnet</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: "700",
    color: colors.text,
  },
  signOutButton: {
    padding: spacing.sm,
  },
  list: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: spacing.md,
  },
  indicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 5,
    marginRight: spacing.md,
  },
  indicatorGreen: {
    backgroundColor: colors.success,
  },
  indicatorGray: {
    backgroundColor: colors.muted,
  },
  cardInfo: {
    flex: 1,
  },
  orgName: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    color: colors.text,
  },
  orgAddress: {
    fontSize: fontSize.md,
    color: colors.muted,
    marginTop: 2,
  },
  distance: {
    fontSize: fontSize.sm,
    color: colors.muted,
    marginTop: spacing.xs,
  },
  distanceNearby: {
    color: colors.success,
    fontWeight: "600",
  },
  checkinButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    gap: spacing.sm,
  },
  checkinButtonNearby: {
    backgroundColor: colors.success,
  },
  checkinButtonText: {
    color: "#fff",
    fontSize: fontSize.md,
    fontWeight: "600",
  },
  empty: {
    alignItems: "center",
    marginTop: 80,
    gap: spacing.md,
  },
  emptyText: {
    fontSize: fontSize.lg,
    color: colors.muted,
  },
});
