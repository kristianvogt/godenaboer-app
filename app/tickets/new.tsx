import { useState } from "react";
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
} from "react-native";
import { useRouter, Stack } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { decode } from "base64-arraybuffer";

export default function NewTicketScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [loading, setLoading] = useState(false);

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      setImage(result.assets[0]);
    }
  }

  async function handleSubmit() {
    if (!title.trim()) {
      Alert.alert("Feil", "Vennligst fyll inn en tittel.");
      return;
    }

    if (!user) return;

    setLoading(true);

    const { data: profile } = await supabase
      .from("profiles")
      .select("sameie_id")
      .eq("id", user.id)
      .single();

    if (!profile?.sameie_id) {
      Alert.alert("Feil", "Ingen sameie tilknyttet din bruker.");
      setLoading(false);
      return;
    }

    let imageUrl: string | null = null;

    if (image?.base64) {
      const fileName = `${user.id}/${Date.now()}.jpg`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("ticket-images")
        .upload(fileName, decode(image.base64), {
          contentType: "image/jpeg",
        });

      if (uploadData && !uploadError) {
        const {
          data: { publicUrl },
        } = supabase.storage
          .from("ticket-images")
          .getPublicUrl(uploadData.path);
        imageUrl = publicUrl;
      }
    }

    const { error } = await supabase.from("tickets").insert({
      sameie_id: profile.sameie_id,
      created_by: user.id,
      title: title.trim(),
      description: description.trim(),
      image_url: imageUrl,
      status: "open",
    });

    setLoading(false);

    if (error) {
      Alert.alert("Feil", "Kunne ikke opprette ticket. Prøv igjen.");
    } else {
      router.back();
    }
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
            value={title}
            onChangeText={setTitle}
          />

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
