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
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { ticketStatusLabels } from "@/lib/ticketStatus";

interface TicketDetail {
  id: string;
  subject: string;
  status: string;
  created_at: string;
}

type UnifiedMessage = {
  id: string;
  source_table: "ticket_messages" | "supplier_ticket_messages";
  source_channel: "portal" | "email" | null;
  content: string;
  created_at: string;
  sender_label: string;
  sender_kind: "self" | "org_member" | "supplier" | "admin";
};

function isImageUrl(text: string): boolean {
  return /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(text) ||
    text.includes("supabase.co/storage");
}

export default function TicketDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [supplierName, setSupplierName] = useState<string | null>(null);
  const [messages, setMessages] = useState<UnifiedMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const listRef = useRef<FlatList>(null);

  async function fetchTicket() {
    const { data } = await supabase
      .from("tickets")
      .select(`
        id, subject, status, created_at, agreement_id,
        agreements:agreement_id (
          suppliers:supplier_id ( name )
        )
      `)
      .eq("id", id)
      .single();

    if (data) {
      setTicket({
        id: data.id,
        subject: data.subject,
        status: data.status,
        created_at: data.created_at,
      });
      const agreements = Array.isArray(data.agreements)
        ? data.agreements[0]
        : data.agreements;
      const suppliers = agreements
        ? Array.isArray((agreements as any).suppliers)
          ? (agreements as any).suppliers[0]
          : (agreements as any).suppliers
        : null;
      setSupplierName(suppliers?.name ?? null);
    }
  }

  async function fetchMessages() {
    if (!user?.id) return;  // wait for auth

    const [tmRes, stmRes] = await Promise.all([
      supabase
        .from("ticket_messages")
        .select("id, content, created_at, author_id, is_internal, profiles:author_id(full_name, email)")
        .eq("ticket_id", id)
        .eq("is_internal", false)
        .order("created_at", { ascending: true }),
      supabase
        .from("supplier_ticket_messages")
        .select("id, content, created_at, sender_type, sender_email, source")
        .eq("ticket_id", id)
        .order("created_at", { ascending: true }),
    ]);

    const tmMapped: UnifiedMessage[] = (tmRes.data ?? []).map((m: any) => {
      const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
      const isSelf = m.author_id === user?.id;
      return {
        id: `tm-${m.id}`,
        source_table: "ticket_messages",
        source_channel: "portal",
        content: m.content,
        created_at: m.created_at,
        sender_kind: isSelf ? "self" : "org_member",
        sender_label: isSelf
          ? "Du"
          : profile?.full_name || profile?.email || "Sameiebruker",
      };
    });

    const stmMapped: UnifiedMessage[] = (stmRes.data ?? []).map((m: any) => {
      let kind: UnifiedMessage["sender_kind"];
      let label: string;
      if (m.sender_type === "leverandor") {
        kind = "supplier";
        label = supplierName || "Leverandør";
      } else if (m.sender_type === "admin") {
        kind = "admin";
        label = "Gode Naboer";
      } else {
        kind = "org_member";
        label = m.sender_email || "Sameiebruker";
      }
      return {
        id: `stm-${m.id}`,
        source_table: "supplier_ticket_messages",
        source_channel: m.source,
        content: m.content,
        created_at: m.created_at,
        sender_kind: kind,
        sender_label: label,
      };
    });

    const merged = [...tmMapped, ...stmMapped].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    setMessages(merged);
  }

  useEffect(() => {
    Promise.all([fetchTicket(), fetchMessages()]).then(() => setLoading(false));

    const channel = supabase
      .channel(`ticket-${id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "ticket_messages",
        filter: `ticket_id=eq.${id}`,
      }, () => fetchMessages())
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "supplier_ticket_messages",
        filter: `ticket_id=eq.${id}`,
      }, () => fetchMessages())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, user?.id]);

  async function confirmResolved() {
    if (!ticket || updatingStatus) return;
    setUpdatingStatus(true);
    await supabase.from("tickets").update({ status: "resolved" }).eq("id", ticket.id);
    setTicket({ ...ticket, status: "resolved" });
    setUpdatingStatus(false);
  }

  async function reopenTicket() {
    if (!ticket || updatingStatus) return;
    setUpdatingStatus(true);
    await supabase.from("tickets").update({ status: "reopened" }).eq("id", ticket.id);
    setTicket({ ...ticket, status: "reopened" });
    setUpdatingStatus(false);
  }

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

  function getBubbleStyle(kind: UnifiedMessage["sender_kind"]) {
    switch (kind) {
      case "self": return s.msgBubbleOwn;
      case "supplier": return s.msgBubbleSupplier;
      case "admin": return s.msgBubbleAdmin;
      default: return s.msgBubbleOther;
    }
  }

  function getTextStyle(kind: UnifiedMessage["sender_kind"]) {
    switch (kind) {
      case "self": return s.msgTextOwn;
      case "supplier": return s.msgTextSupplier;
      case "admin": return s.msgTextAdmin;
      default: return s.msgTextOther;
    }
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
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ paddingLeft: 8 }}>
              <FontAwesome name="chevron-left" size={20} color="#1F2937" />
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
                    {ticketStatusLabels[ticket.status] ?? ticket.status}
                  </Text>
                </View>
                <Text style={s.createdAt}>
                  Opprettet{" "}
                  {new Date(ticket.created_at).toLocaleDateString("nb-NO")}
                </Text>
              </View>

              {ticket.status === "pending_confirmation" && (
                <View style={s.confirmCard}>
                  <Text style={s.confirmText}>
                    Leverandøren har markert denne saken som løst. Er du enig?
                  </Text>
                  <View style={s.confirmButtons}>
                    <TouchableOpacity
                      style={[s.confirmBtn, s.confirmBtnGreen]}
                      onPress={confirmResolved}
                      disabled={updatingStatus}
                    >
                      <Text style={s.confirmBtnText}>✓ Bekreft løst</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.confirmBtn, s.confirmBtnGray]}
                      onPress={reopenTicket}
                      disabled={updatingStatus}
                    >
                      <Text style={s.confirmBtnTextDark}>↺ Gjenåpne</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {messages.length > 0 && (
                <Text style={s.messagesHeader}>Meldinger</Text>
              )}
            </View>
          }
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const isSelf = item.sender_kind === "self";
            return (
              <View
                style={[
                  s.msgRow,
                  isSelf ? s.msgRowOwn : s.msgRowOther,
                ]}
              >
                <View
                  style={[
                    s.msgBubble,
                    getBubbleStyle(item.sender_kind),
                  ]}
                >
                  {!isSelf && (
                    <Text style={s.msgSender}>{item.sender_label}</Text>
                  )}
                  {isImageUrl(item.content) ? (
                    <Image
                      source={{ uri: item.content }}
                      style={s.msgImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <Text style={getTextStyle(item.sender_kind)}>
                      {item.content}
                    </Text>
                  )}
                </View>
                <Text
                  style={[s.msgTime, isSelf && { textAlign: "right" }]}
                >
                  {new Date(item.created_at).toLocaleTimeString("nb-NO", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
                {item.source_channel === "email" && (
                  <Text style={[s.emailIndicator, isSelf && { textAlign: "right" }]}>
                    via e-post
                  </Text>
                )}
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
  msgBubbleSupplier: {
    backgroundColor: "#EFF6FF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  msgBubbleAdmin: {
    backgroundColor: "#F3F4F6",
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
  msgTextSupplier: {
    fontSize: 14,
    color: "#1E3A8A",
  },
  msgTextAdmin: {
    fontSize: 14,
    color: "#1F2937",
  },
  msgTime: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 4,
  },
  emailIndicator: {
    fontSize: 11,
    color: "#9CA3AF",
    fontStyle: "italic",
    marginTop: 2,
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
  confirmCard: {
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
  },
  confirmText: {
    fontSize: 14,
    color: "#1E40AF",
    marginBottom: 12,
  },
  confirmButtons: {
    flexDirection: "row",
    gap: 8,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  confirmBtnGreen: {
    backgroundColor: "#166534",
  },
  confirmBtnGray: {
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  confirmBtnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  confirmBtnTextDark: {
    color: "#374151",
    fontWeight: "600",
    fontSize: 14,
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
