import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";

import { EventPublicHeader } from "@/components/event-public-header";
import { EventPhotoUploader } from "@/components/event-photo-uploader";
import { findEventBySlug } from "@/lib/events/find-event-by-slug";
import { createEventMetadata } from "@/lib/events/event-metadata";

export const dynamic = "force-dynamic";

type EventPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: EventPageProps): Promise<Metadata> {
  const { slug } = await params;
  const event = await findEventBySlug(slug);
  if (!event) notFound();
  return createEventMetadata(event, "gallery");
}

type EventThemeStyle = CSSProperties & {
  "--event-accent": string;
  "--event-primary": string;
};

export default async function EventPage({ params }: EventPageProps) {
  const { slug } = await params;
  const event = await findEventBySlug(slug);

  if (!event) {
    notFound();
  }

  const formattedAvailabilityDate = event.availabilityUntil
    ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "long",
        timeZone: "UTC",
      }).format(new Date(`${event.availabilityUntil}T00:00:00Z`))
    : null;
  const themeStyle: EventThemeStyle = {
    "--event-accent": event.accentColor,
    "--event-primary": event.primaryColor,
  };

  return (
    <main
      className="min-h-dvh bg-slate-50 px-4 pb-8 sm:px-6"
      style={themeStyle}
    >
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center">
        <EventPublicHeader event={event} label="Galeria do evento" />
        {event.isActive ? (
          <>
            <p className="mt-5 max-w-lg text-center text-slate-600">
              Registre este momento e compartilhe sua foto com a família.
            </p>
            <Link href={`/e/${event.slug}/save-the-date`} className="mt-4 text-sm text-[var(--event-primary)] underline">
              Save the date e confirmação de presença
            </Link>
            <EventPhotoUploader eventId={event.id} eventSlug={event.slug} />
          </>
        ) : (
          <section className="mt-8 w-full rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200 sm:p-8">
            <p className="text-sm font-medium uppercase tracking-[0.14em] text-[var(--event-primary)]">
              Evento encerrado
            </p>
            <h2 className="mt-2 text-2xl font-semibold">
              Os envios de fotos foram encerrados
            </h2>
            <p className="mx-auto mt-4 max-w-lg whitespace-pre-line text-slate-600">
              {event.closingMessage}
            </p>
            {formattedAvailabilityDate ? (
              <p className="mt-5 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                As fotos ficarão disponíveis até {formattedAvailabilityDate}.
              </p>
            ) : null}
            {event.organizerContact ? (
              <div className="mt-5 border-t border-slate-200 pt-5">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                  Contato do organizador
                </p>
                <p className="mt-2 whitespace-pre-line text-sm text-slate-700">
                  {event.organizerContact}
                </p>
              </div>
            ) : null}
          </section>
        )}
      </div>
    </main>
  );
}
