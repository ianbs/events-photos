import Image from "next/image";
import { EventMusicPlayer } from "@/components/event-music-player";

import type { EventSummary } from "@/lib/events/event";
import { getEventMapsUrl } from "@/lib/events/event-location";

export function EventPublicHeader({ event, label, description }: {
  event: EventSummary;
  label: string;
  description?: string;
}) {
  const mapsUrl = getEventMapsUrl(event);
  const formattedDate = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long", timeZone: "UTC",
  }).format(new Date(`${event.eventDate}T00:00:00Z`));

  return <>
    {event.coverImageUrl ? (
      <div className="relative -mx-4 h-52 w-[calc(100%+2rem)] overflow-hidden sm:mx-0 sm:mt-6 sm:h-64 sm:w-full sm:rounded-3xl">
        <Image src={event.coverImageUrl} alt={`Capa de ${event.name}`} fill priority
          sizes="(max-width: 672px) 100vw, 672px" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
      </div>
    ) : <div className="h-8" />}
    {event.logoImageUrl ? (
      <div className={`relative h-28 w-28 overflow-hidden rounded-3xl bg-white shadow-lg ring-4 ring-white ${event.coverImageUrl ? "-mt-14" : "mt-2"}`}>
        <Image src={event.logoImageUrl} alt={`Logotipo de ${event.name}`} fill
          sizes="112px" className="object-contain p-2" />
      </div>
    ) : null}
    <p className="mt-6 text-sm font-medium uppercase tracking-[0.18em] text-[var(--event-primary)]">{label}</p>
    <h1 className="mt-2 text-center text-3xl font-semibold tracking-tight sm:text-4xl">{event.name}</h1>
    <div aria-hidden="true" className="mt-3 h-1 w-14 rounded-full bg-[var(--event-accent)]" />
    <p className="mt-3 text-slate-600"><time dateTime={event.eventDate}>{formattedDate}</time></p>
    {event.location ? <p className="mt-3 max-w-lg whitespace-pre-line text-center text-slate-600">{event.location}</p> : null}
    {mapsUrl ? <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
      className="mt-3 rounded-xl border border-[var(--event-primary)] px-4 py-2 text-sm font-medium text-[var(--event-primary)] hover:bg-slate-50">Abrir no mapa</a> : null}
    {description ? <p className="mt-5 max-w-lg text-center text-slate-600">{description}</p> : null}
    {event.musicUrl ? <EventMusicPlayer src={event.musicUrl} eventName={event.name} /> : null}
  </>;
}
