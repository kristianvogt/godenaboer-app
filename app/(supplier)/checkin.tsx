import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useSupplierMembership } from "@/hooks/useSupplierMembership";
import { getDistanceMeters } from "@/lib/distance";
import { colors, fontSize, spacing, radius } from "@/lib/theme";

export default function CheckinScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { supplierId } = useSupplierMembership();
  const { organizationId, agreementId } = useLocalSearchParams<{
    organizationId: string;
    agreementId: string;
  }>();

  const [orgName, setOrgName] = useState("");
  const [orgLat, setOrgLat] = useState<number | null>(null);
  const [orgLon, setOrgLon] = useState<number | null>(null);
  const [initials, setInitials] = useState(user?.email ?? "");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const dateStr = now.toLocaleDateString("nb-NO", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = now.toLocaleTimeString("nb-NO", {
    hour: "2-digit",
    minute: "2-digit",
  });

  useEffect(() => {
    supabase
      .from("organizations")
      .select("name, latitude, longitude")
      .eq("id", organizationId)
      .single()
      .then(({ data, error }) => {
        if (error) {
          console.error("Failed to fetch organization:", error.message);
        } else if (data) {
          setOrgName(data.name);
          setOrgLat(data.latitude);
          setOrgLon(data.longitude);
        }
        setLoading(false);
      });
  }, [organizationId]);

  const handleCheckin = async () => {
    if (!user || !organizationId || !agreementId) return;

    setSubmitting(true);
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      let flagged = false;
      let distance: number | null = null;

      if (orgLat != null && orgLon != null) {
        distance = getDistanceMeters(
          loc.coords.latitude,
          loc.coords.longitude,
          orgLat,
          orgLon
        );
        flagged = distance > 200;
      }

      const { error } = await supabase.from("cleaning_logs").insert({
        organization_id: organizationId,
        agreement_id: agreementId,
        supplier_id: supplierId,
        performed_by: user.id,
        performed_at: new Date().toISOString(),
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        initials: initials.trim(),
        notes: note.trim() || null,
        flagged,
        distance_from_address: distance != null ? Math.round(distance) : null,
      });

      if (error) {
        Alert.alert("Feil", "Kunne ikke lagre kvittering. Prøv igjen.");
        console.error("Failed to insert cleaning log:", error.message);
        setSubmitting(false);
        return;
      }

      Alert.alert("Kvittert!", `Kvittering registrert for ${orgName}.`, [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (err) {
      Alert.alert("Feil", "Kunne ikke hente posisjon. Sjekk at GPS er aktivert.");
      console.error("Failed to get location for checkin:", err);
    } finally {
      setSubmitting(false);
    }
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
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
            <Text style={styles.backText}>Tilbake</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Kvittering</Text>

          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="business-outline" size={20} color={colors.muted} />
              <Text style={styles.infoText}>{orgName}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="calendar-outline" size={20} color={colors.muted} />
              <Text style={styles.infoText}>{dateStr}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="time-outline" size={20} color={colors.muted} />
              <Text style={styles.infoText}>{timeStr}</Text>
            </View>
          </View>

          <Text style={styles.label}>Initialer / navn</Text>
          <TextInput
            style={styles.input}
            value={initials}
            onChangeText={setInitials}
            placeholder="Dine initialer"
            placeholderTextColor={colors.muted}
          />

          <Text style={styles.label}>Notat (valgfritt)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={note}
            onChangeText={setNote}
            placeholder="F.eks. ekstra rengjøring av trappeoppgang"
            placeholderTextColor={colors.muted}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={handleCheckin}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.submitButtonText}>Kvitter ut</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  backText: {
    fontSize: fontSize.lg,
    color: colors.text,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.xl,
  },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  infoText: {
    fontSize: fontSize.md,
    color: colors.text,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.muted,
    marginBottom: spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: fontSize.lg,
    color: colors.text,
    marginBottom: spacing.xl,
  },
  textArea: {
    minHeight: 100,
    paddingTop: spacing.md,
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.success,
    paddingVertical: spacing.lg,
    borderRadius: radius.sm,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: fontSize.lg,
    fontWeight: "700",
  },
});
