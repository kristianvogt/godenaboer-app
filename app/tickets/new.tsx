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
        className="flex-1 bg-gray-50"
      >
        <ScrollView className="flex-1 px-5 pt-6">
          <Text className="text-sm font-medium text-primary mb-1">Tittel</Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-3 mb-4 text-base bg-white"
            placeholder="Kort beskrivelse av problemet"
            value={title}
            onChangeText={setTitle}
          />

          <Text className="text-sm font-medium text-primary mb-1">
            Beskrivelse
          </Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-3 mb-4 text-base bg-white min-h-[120px]"
            placeholder="Utfyllende beskrivelse..."
            value={description}
            onChangeText={setDescription}
            multiline
            textAlignVertical="top"
          />

          <TouchableOpacity
            className="border border-dashed border-gray-300 rounded-lg p-6 items-center mb-4 bg-white"
            onPress={pickImage}
          >
            {image ? (
              <Image
                source={{ uri: image.uri }}
                className="w-full h-48 rounded-lg"
                resizeMode="cover"
              />
            ) : (
              <View className="items-center">
                <FontAwesome name="camera" size={28} color="#9CA3AF" />
                <Text className="text-secondary mt-2">Legg til bilde</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            className="bg-primary rounded-lg py-4 items-center mb-8"
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-semibold text-base">
                Opprett ticket
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
