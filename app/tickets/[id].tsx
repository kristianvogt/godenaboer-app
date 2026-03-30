import { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

interface TicketDetail {
  id: string;
  ticket_id: string;
  title: string;
  description: string;
  status: string;
  image_url: string | null;
  created_at: string;
}

interface Message {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles: { full_name: string } | null;
}

const statusLabels: Record<string, string> = {
  open: "Åpen",
  in_progress: "Under arbeid",
  resolved: "Løst",
  closed: "Lukket",
};

export default function TicketDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  async function fetchTicket() {
    const { data } = await supabase
      .from("tickets")
      .select("id, ticket_id, title, description, status, image_url, created_at")
      .eq("id", id)
      .single();

    setTicket(data);
  }

  async function fetchMessages() {
    const { data } = await supabase
      .from("ticket_messages")
      .select("id, content, created_at, user_id, profiles(full_name)")
      .eq("ticket_id", id)
      .order("created_at", { ascending: true });

    setMessages(
      (data ?? []).map((msg: any) => ({
        ...msg,
        profiles: Array.isArray(msg.profiles) ? msg.profiles[0] : msg.profiles,
      }))
    );
  }

  useEffect(() => {
    Promise.all([fetchTicket(), fetchMessages()]).then(() => setLoading(false));

    const channel = supabase
      .channel(`ticket-${id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ticket_messages",
          filter: `ticket_id=eq.${id}`,
        },
        () => {
          fetchMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  async function sendMessage() {
    if (!newMessage.trim() || !user) return;

    setSending(true);
    await supabase.from("ticket_messages").insert({
      ticket_id: id,
      user_id: user.id,
      content: newMessage.trim(),
    });

    setNewMessage("");
    setSending(false);
    await fetchMessages();
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#1F2937" />
      </View>
    );
  }

  if (!ticket) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <Text className="text-secondary">Ticket ikke funnet.</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: ticket.ticket_id,
          headerStyle: { backgroundColor: "#fff" },
          headerTintColor: "#1F2937",
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1 bg-gray-50"
        keyboardVerticalOffset={90}
      >
        <FlatList
          ref={listRef}
          className="flex-1"
          contentContainerStyle={{ padding: 20 }}
          onContentSizeChange={() =>
            listRef.current?.scrollToEnd({ animated: false })
          }
          ListHeaderComponent={
            <View className="mb-4">
              <View className="bg-white rounded-xl p-5 shadow-sm">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-xs text-secondary">
                    {ticket.ticket_id}
                  </Text>
                  <Text className="text-xs font-medium text-accent">
                    {statusLabels[ticket.status] ?? ticket.status}
                  </Text>
                </View>
                <Text className="text-lg font-bold text-primary mb-2">
                  {ticket.title}
                </Text>
                {ticket.description ? (
                  <Text className="text-sm text-secondary mb-3">
                    {ticket.description}
                  </Text>
                ) : null}
                {ticket.image_url ? (
                  <Image
                    source={{ uri: ticket.image_url }}
                    className="w-full h-48 rounded-lg"
                    resizeMode="cover"
                  />
                ) : null}
                <Text className="text-xs text-gray-400 mt-3">
                  Opprettet{" "}
                  {new Date(ticket.created_at).toLocaleDateString("nb-NO")}
                </Text>
              </View>

              {messages.length > 0 && (
                <Text className="text-sm font-medium text-secondary mt-6 mb-2">
                  Meldinger
                </Text>
              )}
            </View>
          }
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const isOwn = item.user_id === user?.id;
            return (
              <View
                className={`mb-3 max-w-[85%] ${isOwn ? "self-end" : "self-start"}`}
              >
                <View
                  className={`rounded-xl px-4 py-3 ${isOwn ? "bg-primary" : "bg-white shadow-sm"}`}
                >
                  {!isOwn && item.profiles?.full_name && (
                    <Text className="text-xs font-medium text-accent mb-1">
                      {item.profiles.full_name}
                    </Text>
                  )}
                  <Text
                    className={`text-sm ${isOwn ? "text-white" : "text-primary"}`}
                  >
                    {item.content}
                  </Text>
                </View>
                <Text
                  className={`text-xs text-gray-400 mt-1 ${isOwn ? "text-right" : ""}`}
                >
                  {new Date(item.created_at).toLocaleTimeString("nb-NO", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
            );
          }}
        />

        <View className="flex-row items-center px-4 py-3 bg-white border-t border-gray-100">
          <TextInput
            className="flex-1 border border-gray-300 rounded-full px-4 py-2.5 text-base mr-3"
            placeholder="Skriv en melding..."
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
          />
          <TouchableOpacity
            className="bg-primary w-10 h-10 rounded-full items-center justify-center"
            onPress={sendMessage}
            disabled={sending || !newMessage.trim()}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <FontAwesome name="send" size={14} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}
