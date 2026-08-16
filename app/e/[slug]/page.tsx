import Image from "next/image";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";

import { EventPhotoUploader } from "@/components/event-photo-uploader";
import { findActiveEventBySlug } from "@/lib/events/find-event-by-slug";

export const dynamic = "force-dynamic";

type EventPageProps = {
  params: Promise<{ slug: string }>;
};

type EventThemeStyle = CSSProperties & {
  "--event-accent": string;
  "--event-primary": string;
};

export default async function EventPage({ params }: EventPageProps) {
  const { slug } = await params;
  const event = await findActiveEventBySlug(slug);

  if (!event) {
    notFound();
  }

  const formattedDate = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(`${event.eventDate}T00:00:00Z`));
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
        {event.coverImageUrl ? (
          <div className="relative -mx-4 h-52 w-[calc(100%+2rem)] overflow-hidden sm:mx-0 sm:mt-6 sm:h-64 sm:w-full sm:rounded-3xl">
            <Image
              src={event.coverImageUrl}
              alt={`Capa de ${event.name}`}
              fill
              priority
              sizes="(max-width: 672px) 100vw, 672px"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
          </div>
        ) : (
          <div className="h-8" />
        )}

        {event.logoImageUrl ? (
          <div className={`relative h-28 w-28 overflow-hidden rounded-3xl bg-white shadow-lg ring-4 ring-white ${event.coverImageUrl ? "-mt-14" : "mt-2"}`}>
            <Image
              src={event.logoImageUrl}
              alt={`Logotipo de ${event.name}`}
              fill
              sizes="112px"
              className="object-contain p-2"
            />
          </div>
        ) : null}

        <p className="mt-6 text-sm font-medium uppercase tracking-[0.18em] text-[var(--event-primary)]">
          Galeria do evento
        </p>
        <h1 className="mt-2 text-center text-3xl font-semibold tracking-tight sm:text-4xl">
          {event.name}
        </h1>
        <div
          aria-hidden="true"
          className="mt-3 h-1 w-14 rounded-full bg-[var(--event-accent)]"
        />
        <p className="mt-3 text-slate-600">{formattedDate}</p>
        <p className="mt-5 max-w-lg text-center text-slate-600">
          Registre este momento e compartilhe sua foto com a família.
        </p>

        <EventPhotoUploader eventId={event.id} eventSlug={event.slug} />
      </div>
    </main>
  );
}
