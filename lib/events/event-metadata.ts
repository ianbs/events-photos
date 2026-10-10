import "server-only";

import type { Metadata } from "next";

import { getServerEnvironment } from "@/lib/config/server-environment";
import type { EventSummary } from "@/lib/events/event";

export function createEventMetadata(event: EventSummary, page: "invitation" | "gallery"): Metadata {
  const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "UTC" })
    .format(new Date(`${event.eventDate}T00:00:00Z`));
  const details = [date, event.location].filter(Boolean).join(" · ");
  const message = !event.isActive ? event.closingMessage : event.instructions
    || (page === "invitation" ? "Reserve esta data e confirme sua presença. Esperamos você!"
      : "Compartilhe os registros e celebre este momento conosco.");
  const fullDescription = `${details}. ${message}`.replace(/\s+/g, " ").trim();
  const description = fullDescription.length > 300
    ? `${fullDescription.slice(0, 297).trimEnd()}…` : fullDescription;
  const path = `/e/${event.slug}${page === "invitation" ? "/save-the-date" : ""}`;
  const url = new URL(path, getServerEnvironment().NEXT_PUBLIC_APP_URL).toString();

  return {
    title: event.name,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: event.name,
      description,
      siteName: event.name,
      url,
      type: "website",
      locale: "pt_BR",
    },
    twitter: { card: "summary", title: event.name, description },
  };
}
