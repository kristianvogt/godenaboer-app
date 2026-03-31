import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActionSheetIOS,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { decode } from "base64-arraybuffer";

interface AgreementOption {
  agreement_id: string;
  label: string;
}

export default function NewTicketScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [loading, setLoading] = useState(false);
  const [agreements, setAgreements] = useState<AgreementOption[]>([]);
  const [selectedAgreement, setSelectedAgreement] = useState<AgreementOption | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);

  const imagePickerOptions: ImagePicker.ImagePickerOptions = {
    mediaTypes: ["images"],
    quality: 0.7,
    base64: true,
  };

  useEffect(() => {
    async function fetchAgreements() {
      if (!user) return;

      const { data: membership } = await supabase
        .from("memberships")
        .select("organization_id")
        .eq("user_id", user.id)
        .single();

      if (!membership?.organization_id) return;
      setOrgId(membership.organization_id);

      const { data } = await supabase
        .from("organization_agreements")
        .select(`
          agreement_id,
          status,
          agreement:agreements (
            title,
            suppliers:supplier_id (name)
          )
        `)
        .eq("organization_id", membership.organization_id)
        .in("status", ["enrolled", "awaiting_inspection", "offer_received", "active"]);

      const options: AgreementOption[] = (data ?? [])
        .filter((d: any) => d.agreement !== null)
        .map((d: any) => {
          const agr = Array.isArray(d.agreement) ? d.agreement[0] : d.agreement;
          const supplier = Array.isArray(agr?.suppliers) ? agr.suppliers[0] : agr?.suppliers;
          const label = supplier?.name
            ? `${supplier.name} — ${agr?.title ?? ""}`
            : agr?.title ?? "Ukjent avtale";
          return { agreement_id: d.agreement_id, label };
        });

      setAgreements(options);
    }

    fetchAgreements();
  }, [user]);

  function pickAgreement() {
    const labels = ["Ingen spesifikk avtale", ...agreements.map((a) => a.label)];

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Avbryt", ...labels],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            setSelectedAgreement(null);
          } else if (buttonIndex > 1) {
            setSelectedAgreement(agreements[buttonIndex - 2]);
          }
        }
      );
    } else {
      Alert.alert(
        "Velg avtale",
        "",
        [
          { text: "Ingen spesifikk avtale", onPress: () => setSelectedAgreement(null) },
          ...agreements.map((a) => ({
            text: a.label,
            onPress: () => setSelectedAgreement(a),
          })),
          { text: "Avbryt", style: "cancel" as const },
        ]
      );
    }
  }

  async function launchCamera() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Tillatelse kreves",
        "Appen trenger tilgang til kameraet for å ta bilder."
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync(imagePickerOptions);
    if (!result.canceled && result.assets[0]) {
      setImage(result.assets[0]);
    }
  }

  async function launchLibrary() {
    const result = await ImagePicker.launchImageLibraryAsync(imagePickerOptions);
    if (!result.canceled && result.assets[0]) {
      setImage(result.assets[0]);
    }
  }

  function pickImage() {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Avbryt", "Ta bilde", "Velg fra album"],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) launchCamera();
          if (buttonIndex === 2) launchLibrary();
        }
      );
    } else {
      Alert.alert("Legg til bilde", "", [
        { text: "Ta bilde", onPress: launchCamera },
        { text: "Velg fra album", onPress: launchLibrary },
        { text: "Avbryt", style: "cancel" },
      ]);
    }
  }

  async function handleSubmit() {
    if (!subject.trim()) {
      Alert.alert("Feil", "Vennligst fyll inn en tittel.");
      return;
    }

    if (!user) return;

    setLoading(true);

    const organizationId = orgId;
    if (!organizationId) {
      const { data: membership } = await supabase
        .from("memberships")
        .select("organization_id")
        .eq("user_id", user.id)
        .single();

      if (!membership?.organization_id) {
        Alert.alert("Feil", "Ingen organisasjon tilknyttet din bruker.");
        setLoading(false);
        return;
      }
    }

    const finalOrgId = organizationId!;

    let imageUrl: string | null = null;

    if (image?.base64) {
      console.log("Bilde valgt, base64-lengde:", image.base64.length);
      const fileName = `${user.id}/${Date.now()}.jpg`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("ticket-images")
        .upload(fileName, decode(image.base64), {
          contentType: "image/jpeg",
        });

      if (uploadError) {
        console.log("Bildeopplasting feilet:", uploadError.message);
        Alert.alert(
          "Bilde ikke lastet opp",
          'Storage-bucket "ticket-images" finnes kanskje ikke. ' +
          "Opprett den i Supabase Dashboard → Storage → New bucket → " +
          '"ticket-images" (sett som Public).'
        );
      }

      if (uploadData && !uploadError) {
        const {
          data: { publicUrl },
        } = supabase.storage
          .from("ticket-images")
          .getPublicUrl(uploadData.path);

        imageUrl = publicUrl;
        console.log("Bildeopplasting OK, publicUrl:", publicUrl);
      }
    }

    const insertData: Record<string, unknown> = {
      organization_id: finalOrgId,
      created_by: user.id,
      subject: subject.trim(),
      status: "new",
    };

    if (selectedAgreement) {
      insertData.agreement_id = selectedAgreement.agreement_id;
    }

    const { data: newTicket, error } = await supabase
      .from("tickets")
      .insert(insertData)
      .select("id")
      .single();

    if (error) {
      setLoading(false);
      console.log("Ticket-oppretting feilet:", error.message, error.details, error.hint);
      Alert.alert("Feil", `Kunne ikke opprette ticket: ${error.message}`);
      return;
    }

    if (newTicket) {
      const messagesToInsert: {
        ticket_id: string;
        content: string;
        author_id: string;
        is_internal: boolean;
      }[] = [];

      if (description.trim()) {
        messagesToInsert.push({
          ticket_id: newTicket.id,
          content: description.trim(),
          author_id: user.id,
          is_internal: false,
        });
      }

      if (imageUrl) {
        messagesToInsert.push({
          ticket_id: newTicket.id,
          content: imageUrl,
          author_id: user.id,
          is_internal: false,
        });
      }

      if (messagesToInsert.length > 0) {
        const { error: msgError } = await supabase
          .from("ticket_messages")
          .insert(messagesToInsert);

        if (msgError) {
          console.log("Melding-oppretting feilet:", msgError.message, msgError.details, msgError.hint);
        }
      }
    }

    setLoading(false);
    router.back();
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: "Ny ticket",
          headerStyle: { backgroundColor: "#fff" },
          headerTintColor: "#1F2937",
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={s.screen}
      >
        <ScrollView style={s.scroll}>
          <Text style={s.label}>Tittel</Text>
          <TextInput
            style={s.input}
            placeholder="Kort beskrivelse av problemet"
            value={subject}
            onChangeText={setSubject}
          />

          {agreements.length > 0 && (
            <View style={{ marginBottom: 16 }}>
              <Text style={s.label}>Avtale</Text>
              <TouchableOpacity style={s.agreementPicker} onPress={pickAgreement}>
                <Text
                  style={selectedAgreement ? s.agreementText : s.agreementPlaceholder}
                  numberOfLines={1}
                >
                  {selectedAgreement?.label ?? "Velg avtale (valgfritt)"}
                </Text>
                <FontAwesome name="chevron-down" size={12} color="#9CA3AF" />
              </TouchableOpacity>
              {selectedAgreement && (
                <TouchableOpacity
                  style={s.chip}
                  onPress={() => setSelectedAgreement(null)}
                >
                  <Text style={s.chipText} numberOfLines={1}>
                    {selectedAgreement.label}
                  </Text>
                  <FontAwesome name="times" size={12} color="#6B7280" />
                </TouchableOpacity>
              )}
            </View>
          )}

          <Text style={s.label}>Beskrivelse</Text>
          <TextInput
            style={[s.input, s.textArea]}
            placeholder="Utfyllende beskrivelse..."
            value={description}
            onChangeText={setDescription}
            multiline
            textAlignVertical="top"
          />

          <TouchableOpacity style={s.imagePicker} onPress={pickImage}>
            {image ? (
              <Image
                source={{ uri: image.uri }}
                style={s.previewImage}
                resizeMode="cover"
              />
            ) : (
              <View style={s.imagePickerInner}>
                <FontAwesome name="camera" size={28} color="#9CA3AF" />
                <Text style={s.imagePickerText}>Legg til bilde</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={s.submitButton}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.submitText}>Opprett ticket</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  scroll: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
    color: "#1F2937",
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  textArea: {
    minHeight: 120,
  },
  agreementPicker: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
  },
  agreementText: {
    fontSize: 16,
    color: "#1F2937",
    flex: 1,
    marginRight: 8,
  },
  agreementPlaceholder: {
    fontSize: 16,
    color: "#9CA3AF",
    flex: 1,
    marginRight: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 8,
    gap: 8,
  },
  chipText: {
    fontSize: 14,
    color: "#1E40AF",
    flex: 1,
  },
  imagePicker: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#D1D5DB",
    borderRadius: 10,
    padding: 24,
    alignItems: "center",
    marginBottom: 16,
    backgroundColor: "#fff",
  },
  imagePickerInner: {
    alignItems: "center",
  },
  imagePickerText: {
    color: "#6B7280",
    marginTop: 8,
  },
  previewImage: {
    width: "100%",
    height: 192,
    borderRadius: 10,
  },
  submitButton: {
    backgroundColor: "#1F2937",
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 32,
  },
  submitText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
});
