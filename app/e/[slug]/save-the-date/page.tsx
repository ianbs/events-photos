import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";

import { EventPublicHeader } from "@/components/event-public-header";
import { EventCountdown } from "@/components/event-countdown";
import { EventRsvpForm } from "@/components/event-rsvp-form";
import { findActiveEventBySlug } from "@/lib/events/find-event-by-slug";
import { createEventMetadata } from "@/lib/events/event-metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const event = await findActiveEventBySlug(slug);
  if (!event) notFound();
  return createEventMetadata(event, "invitation");
}

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
        <EventCountdown eventDate={event.eventDate} />
        {event.instructions ? (
          <section className="mt-6 w-full rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
            <h2 className="text-lg font-semibold text-[var(--event-primary)]">Orientações sobre o evento</h2>
            <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">{event.instructions}</p>
          </section>
        ) : null}
        <EventRsvpForm eventSlug={event.slug} />
        <Link href={`/e/${event.slug}`} className="mt-6 text-sm text-[var(--event-primary)] underline">
          Abrir galeria do evento
        </Link>
      </div>
    </main>
  );
}
