import { colors } from "@/lib/theme";

export const ticketStatusLabels: Record<string, string> = {
  new: "Ny",
  sent_to_supplier: "Sendt til leverandør",
  reply_received: "Svar mottatt",
  in_progress: "Under arbeid",
  pending_confirmation: "Venter på bekreftelse",
  resolved: "Løst",
  reopened: "Gjenåpnet",
  rejected: "Avvist",
};

export const ticketStatusBadgeStyles: Record<string, { bg: string; text: string }> = {
  new: { bg: colors.warningBg, text: colors.warning },
  sent_to_supplier: { bg: colors.primaryBg, text: colors.primary },
  reply_received: { bg: "#E0E7FF", text: "#3730A3" },
  in_progress: { bg: colors.primaryBg, text: colors.primary },
  pending_confirmation: { bg: "#FEF3C7", text: "#92400E" },
  resolved: { bg: colors.successBg, text: colors.success },
  reopened: { bg: "#FEE2E2", text: "#991B1B" },
  rejected: { bg: colors.dangerBg, text: colors.danger },
};

export const defaultTicketBadge = { bg: "#F3F4F6", text: "#4B5563" };

export const OPEN_TICKET_STATUSES = [
  "new",
  "sent_to_supplier",
  "reply_received",
  "in_progress",
  "pending_confirmation",
  "reopened",
];
