import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";

import { EventPublicHeader } from "@/components/event-public-header";
import { EventRsvpForm } from "@/components/event-rsvp-form";
import { findActiveEventBySlug } from "@/lib/events/find-event-by-slug";

export const dynamic = "force-dynamic";

export default async function SaveTheDatePage({ params }: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await findActiveEventBySlug(slug);
  if (!event) notFound();
  const style = {
    "--event-primary": event.primaryColor,
    "--event-accent": event.accentColor,
  } as CSSProperties;

  return (
    <main className="min-h-dvh bg-slate-50 px-4 pb-8 sm:px-6" style={style}>
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center">
        <EventPublicHeader event={event} label="Save the date"
          description="Reserve esta data! Queremos compartilhar este momento com você. Informe abaixo se poderá estar presente." />
        <EventRsvpForm eventId={event.id} eventSlug={event.slug} />
        <Link href={`/e/${event.slug}`} className="mt-6 text-sm text-[var(--event-primary)] underline">
          Abrir galeria do evento
        </Link>
      </div>
    </main>
  );
}
