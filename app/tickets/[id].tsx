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
  StyleSheet,
} from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

interface TicketDetail {
  id: string;
  subject: string;
  status: string;
  created_at: string;
}

interface Message {
  id: string;
  content: string;
  created_at: string;
  author_id: string;
  profiles: { full_name: string | null; email: string } | null;
}

const statusLabels: Record<string, string> = {
  new: "Ny",
  sent_to_supplier: "Sendt til leverandør",
  reply_received: "Svar mottatt",
  in_progress: "Under arbeid",
  resolved: "Løst",
  rejected: "Avvist",
};

function isImageUrl(text: string): boolean {
  return /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(text) ||
    text.includes("supabase.co/storage");
}

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
      .select("id, subject, status, created_at")
      .eq("id", id)
      .single();

    setTicket(data);
  }

  async function fetchMessages() {
    const { data } = await supabase
      .from("ticket_messages")
      .select("id, content, created_at, author_id, profiles:author_id(full_name, email)")
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
      author_id: user.id,
      is_internal: false,
      content: newMessage.trim(),
    });

    setNewMessage("");
    setSending(false);
    await fetchMessages();
  }

  if (loading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color="#1F2937" />
      </View>
    );
  }

  if (!ticket) {
    return (
      <View style={s.centered}>
        <Text style={s.emptyText}>Ticket ikke funnet.</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: ticket.subject,
          headerStyle: { backgroundColor: "#fff" },
          headerTintColor: "#1F2937",
          headerBackVisible: true,
          headerBackTitle: "Tilbake",
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={s.screen}
        keyboardVerticalOffset={90}
      >
        <FlatList
          ref={listRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 20 }}
          onContentSizeChange={() =>
            listRef.current?.scrollToEnd({ animated: false })
          }
          ListHeaderComponent={
            <View style={{ marginBottom: 16 }}>
              <View style={s.detailCard}>
                <View style={s.detailHeader}>
                  <Text style={s.ticketTitle}>{ticket.subject}</Text>
                  <Text style={s.statusText}>
                    {statusLabels[ticket.status] ?? ticket.status}
                  </Text>
                </View>
                <Text style={s.createdAt}>
                  Opprettet{" "}
                  {new Date(ticket.created_at).toLocaleDateString("nb-NO")}
                </Text>
              </View>

              {messages.length > 0 && (
                <Text style={s.messagesHeader}>Meldinger</Text>
              )}
            </View>
          }
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const isOwn = item.author_id === user?.id;
            return (
              <View
                style={[
                  s.msgRow,
                  isOwn ? s.msgRowOwn : s.msgRowOther,
                ]}
              >
                <View
                  style={[
                    s.msgBubble,
                    isOwn ? s.msgBubbleOwn : s.msgBubbleOther,
                  ]}
                >
                  {!isOwn && item.profiles?.full_name && (
                    <Text style={s.msgSender}>{item.profiles.full_name}</Text>
                  )}
                  {isImageUrl(item.content) ? (
                    <Image
                      source={{ uri: item.content }}
                      style={s.msgImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <Text style={isOwn ? s.msgTextOwn : s.msgTextOther}>
                      {item.content}
                    </Text>
                  )}
                </View>
                <Text
                  style={[s.msgTime, isOwn && { textAlign: "right" }]}
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

        <View style={s.inputBar}>
          <TextInput
            style={s.messageInput}
            placeholder="Skriv en melding..."
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
          />
          <TouchableOpacity
            style={s.sendButton}
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

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F9FAFB",
  },
  emptyText: {
    color: "#6B7280",
  },
  detailCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#3B82F6",
  },
  ticketTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 8,
  },
  createdAt: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 12,
  },
  messagesHeader: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
    marginTop: 24,
    marginBottom: 8,
  },
  msgRow: {
    marginBottom: 12,
    maxWidth: "85%",
  },
  msgRowOwn: {
    alignSelf: "flex-end",
  },
  msgRowOther: {
    alignSelf: "flex-start",
  },
  msgBubble: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  msgBubbleOwn: {
    backgroundColor: "#1F2937",
  },
  msgBubbleOther: {
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  msgSender: {
    fontSize: 12,
    fontWeight: "500",
    color: "#3B82F6",
    marginBottom: 4,
  },
  msgImage: {
    width: 200,
    height: 150,
    borderRadius: 8,
  },
  msgTextOwn: {
    fontSize: 14,
    color: "#fff",
  },
  msgTextOther: {
    fontSize: 14,
    color: "#1F2937",
  },
  msgTime: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 4,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  messageInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    marginRight: 12,
  },
  sendButton: {
    backgroundColor: "#1F2937",
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});
