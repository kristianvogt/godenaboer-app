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
  StyleSheet,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { colors, fontSize, spacing, radius } from "@/lib/theme";

interface ConversationDetail {
  id: string;
  subject: string;
}

interface Message {
  id: string;
  content: string;
  created_at: string;
  sender_type: string;
  sender_id: string | null;
  profiles: { full_name: string | null } | null;
}

export default function ConversationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  async function fetchConversation() {
    const { data } = await supabase
      .from("conversations")
      .select("id, subject")
      .eq("id", id)
      .single();

    setConversation(data);
  }

  async function fetchMessages() {
    const { data } = await supabase
      .from("conversation_messages")
      .select("id, content, created_at, sender_type, sender_id, profiles:sender_id(full_name)")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });

    setMessages(
      (data ?? []).map((msg: any) => ({
        ...msg,
        profiles: Array.isArray(msg.profiles) ? msg.profiles[0] : msg.profiles,
      }))
    );
  }

  async function markAsRead() {
    await supabase
      .from("conversations")
      .update({ unread_count: 0 })
      .eq("id", id);
  }

  useEffect(() => {
    Promise.all([fetchConversation(), fetchMessages(), markAsRead()]).then(() =>
      setLoading(false)
    );

    const channel = supabase
      .channel(`conversation-${id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "conversation_messages",
          filter: `conversation_id=eq.${id}`,
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
    await supabase.from("conversation_messages").insert({
      conversation_id: id,
      sender_id: user.id,
      sender_type: "user",
      content: newMessage.trim(),
    });

    setNewMessage("");
    setSending(false);
    await fetchMessages();
  }

  if (loading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!conversation) {
    return (
      <View style={s.centered}>
        <Text style={s.emptyText}>Samtale ikke funnet.</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: conversation.subject,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ paddingLeft: 8 }}>
              <FontAwesome name="chevron-left" size={20} color={colors.text} />
            </TouchableOpacity>
          ),
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
          contentContainerStyle={{ padding: spacing.xl }}
          onContentSizeChange={() =>
            listRef.current?.scrollToEnd({ animated: false })
          }
          data={messages}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingTop: 80 }}>
              <Text style={s.emptyText}>Ingen meldinger i denne samtalen.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isOutgoing = item.sender_type === "user" && item.sender_id === user?.id;
            return (
              <View style={[s.msgRow, isOutgoing ? s.msgRowOwn : s.msgRowOther]}>
                <View
                  style={[
                    s.msgBubble,
                    isOutgoing ? s.msgBubbleOwn : s.msgBubbleOther,
                  ]}
                >
                  {!isOutgoing && item.profiles?.full_name && (
                    <Text style={s.msgSender}>{item.profiles.full_name}</Text>
                  )}
                  <Text style={isOutgoing ? s.msgTextOwn : s.msgTextOther}>
                    {item.content}
                  </Text>
                </View>
                <Text style={[s.msgTime, isOutgoing && { textAlign: "right" }]}>
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
            style={[s.sendButton, (!newMessage.trim() || sending) && s.sendButtonDisabled]}
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
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  emptyText: {
    color: colors.muted,
  },
  msgRow: {
    marginBottom: spacing.md,
    maxWidth: "85%",
  },
  msgRowOwn: {
    alignSelf: "flex-end",
  },
  msgRowOther: {
    alignSelf: "flex-start",
  },
  msgBubble: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  msgBubbleOwn: {
    backgroundColor: colors.primary,
  },
  msgBubbleOther: {
    backgroundColor: colors.card,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  msgSender: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  msgTextOwn: {
    fontSize: fontSize.md,
    color: "#fff",
  },
  msgTextOther: {
    fontSize: fontSize.md,
    color: colors.text,
  },
  msgTime: {
    fontSize: fontSize.xs,
    color: colors.muted,
    marginTop: spacing.xs,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  messageInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    fontSize: fontSize.lg,
    marginRight: spacing.md,
    backgroundColor: colors.background,
  },
  sendButton: {
    backgroundColor: colors.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
