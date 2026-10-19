"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import {
  filterAndSortAdminEvents,
  formatEventListDate,
  formatEventStorage,
  type EventListSort,
  type EventListStatus,
} from "@/lib/events/admin-event-list";

export type ListedAdminEvent = {
  id: string;
  name: string;
  slug: string;
  eventDate: string;
  location: string | null;
  isActive: boolean;
  photoCount: number;
  guestCount: number;
  storageBytes: number;
  lastPhotoAt: string | null;
  eventUrl: string;
  qrCodeDataUrl: string;
};

const PAGE_SIZE = 8;
const focusClass = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2";
const secondaryAction = `inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 ${focusClass}`;

function Icon({ name, className = "size-4" }: {
  name: "search" | "calendar" | "location" | "photos" | "arrow" | "chevron" | "link";
  className?: string;
}) {
  const paths = {
    search: "m21 21-4.35-4.35M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
    calendar: "M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z",
    location: "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
    photos: "M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm-1 14 6-6 4 4 3-3 5 5M16 7h.01",
    arrow: "M7 17 17 7M7 7h10v10",
    chevron: "m6 9 6 6 6-6",
    link: "M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2m3 6a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2",
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className}><path d={paths[name]} /></svg>;
}

function EventSharePanel({ event }: { event: ListedAdminEvent }) {
  const [copyFeedback, setCopyFeedback] = useState("");
  const invitationUrl = event.eventUrl + "/save-the-date";

  async function copyInvitation() {
    try {
      await navigator.clipboard.writeText(invitationUrl);
      setCopyFeedback("Link do convite copiado.");
    } catch {
      setCopyFeedback("Selecione e copie o link do convite abaixo.");
    }
  }

  return (
    <details className="group border-t border-slate-100">
      <summary className={`flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 [&::-webkit-details-marker]:hidden ${focusClass}`}>
        <span className="flex items-center gap-2"><Icon name="link" /> Links e QR Code</span>
        <Icon name="chevron" className="size-4 transition-transform group-open:rotate-180" />
      </summary>
      <div className="grid gap-5 border-t border-slate-100 bg-slate-50/70 p-5 sm:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800">Compartilhe com os convidados</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">O convite abre a página de apresentação e confirmação de presença.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={copyInvitation} className={secondaryAction}>Copiar link do convite</button>
            <a href={invitationUrl} target="_blank" rel="noreferrer" className={secondaryAction}>Abrir convite <Icon name="arrow" /></a>
            <a href={event.eventUrl} target="_blank" rel="noreferrer" className={secondaryAction}>Abrir galeria <Icon name="arrow" /></a>
          </div>
          <label className="mt-4 block text-xs font-medium text-slate-500">
            Link do convite
            <input readOnly value={invitationUrl} onFocus={(e) => e.currentTarget.select()} className={`mt-1.5 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 ${focusClass}`} />
          </label>
          <p role="status" className="mt-2 min-h-4 text-xs text-emerald-800">{copyFeedback}</p>
        </div>
        <div className="flex items-center gap-4 sm:flex-col sm:gap-2">
          <Image src={event.qrCodeDataUrl} alt={`QR Code da galeria de ${event.name}`} width={112} height={112} unoptimized className="size-28 rounded-xl border border-slate-200 bg-white" />
          <div className="text-xs sm:text-center">
            <p className="mb-2 text-slate-500">QR Code da galeria</p>
            <a href={event.qrCodeDataUrl} download={`qr-${event.slug}.png`} className={`inline-flex min-h-10 items-center font-semibold text-emerald-800 underline underline-offset-4 ${focusClass}`}>Baixar QR Code</a>
          </div>
        </div>
      </div>
    </details>
  );
}

export function AdminEventList({ events }: { events: ListedAdminEvent[] }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<EventListStatus>("all");
  const [sort, setSort] = useState<EventListSort>("recent");
  const [page, setPage] = useState(1);
  const filtered = filterAndSortAdminEvents(events, query, status, sort);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const visibleEvents = filtered.slice(start, start + PAGE_SIZE);
  const activeCount = events.filter((event) => event.isActive).length;
  const tabs = [
    { value: "all", label: "Todos", count: events.length },
    { value: "active", label: "Ativos", count: activeCount },
    { value: "closed", label: "Encerrados", count: events.length - activeCount },
  ] as const;
  const hasFilters = query.trim() !== "" || status !== "all";

  function goToPage(nextPage: number) {
    setPage(nextPage);
    headingRef.current?.focus({ preventScroll: true });
    headingRef.current?.scrollIntoView({ block: "start" });
  }

  function clearFilters() {
    setQuery("");
    setStatus("all");
    setPage(1);
  }

  return (
    <section aria-labelledby="event-list-title" className="mt-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 ref={headingRef} id="event-list-title" tabIndex={-1} className="scroll-mt-6 text-xl font-semibold tracking-tight outline-none">Seus eventos</h2>
        <p aria-live="polite" aria-atomic="true" className="text-sm text-slate-500">
          {filtered.length} {filtered.length === 1 ? "evento" : "eventos"}{hasFilters ? (filtered.length === 1 ? " encontrado" : " encontrados") : (filtered.length === 1 ? " cadastrado" : " cadastrados")}
        </p>
      </div>

      <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="relative flex-1">
            <span className="sr-only">Buscar eventos por nome ou local</span>
            <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-slate-400"><Icon name="search" className="size-5" /></span>
            <input type="search" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Buscar por nome ou local…" className={`min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pr-4 pl-11 text-sm text-slate-900 placeholder:text-slate-500 ${focusClass}`} />
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm text-slate-500">
            <span>Ordenar</span>
            <select value={sort} onChange={(e) => { setSort(e.target.value as EventListSort); setPage(1); }} className={`min-h-12 min-w-0 flex-1 rounded-lg bg-white py-2 pr-2 font-medium text-slate-700 ${focusClass}`}>
              <option value="recent">Data: mais recentes</option>
              <option value="oldest">Data: mais antigas</option>
              <option value="name">Nome: A–Z</option>
              <option value="photos">Mais fotos</option>
            </select>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <div role="group" aria-label="Filtrar eventos por status" className="flex flex-wrap gap-1">
            {tabs.map((tab) => (
              <button key={tab.value} type="button" aria-pressed={status === tab.value} onClick={() => { setStatus(tab.value); setPage(1); }} className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors sm:gap-2 sm:px-3 sm:text-sm ${status === tab.value ? "bg-emerald-50 text-emerald-900" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"} ${focusClass}`}>
                {tab.label}<span className={`rounded-md px-1.5 py-0.5 text-xs tabular-nums ${status === tab.value ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>{tab.count}</span>
              </button>
            ))}
          </div>
          {hasFilters ? <button type="button" onClick={clearFilters} className={`min-h-10 rounded-lg px-2 text-sm font-medium text-slate-600 underline underline-offset-4 ${focusClass}`}>Limpar filtros</button> : null}
        </div>
      </div>

      <div className="space-y-4">
        {visibleEvents.map((event) => {
          const date = formatEventListDate(event.eventDate);
          return (
            <article key={event.id} aria-labelledby={`event-name-${event.id}`} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
              <div className="p-5">
                <div className="flex items-start gap-4">
                  <div aria-hidden="true" className={`flex h-18 w-16 shrink-0 flex-col items-center justify-center rounded-xl border ${event.isActive ? "border-emerald-100 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
                    <span className="text-2xl leading-tight font-semibold tabular-nums">{date.day}</span>
                    <span className="mt-0.5 text-xs font-semibold uppercase tracking-wide">{date.month}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <h3 id={`event-name-${event.id}`} className="min-w-0 text-lg leading-snug font-semibold tracking-tight break-words text-slate-900">
                        <Link href={`/admin/events/${event.id}/edit`} className={`rounded hover:text-emerald-800 ${focusClass}`}>{event.name}</Link>
                      </h3>
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${event.isActive ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                        <span aria-hidden="true" className={`size-1.5 rounded-full ${event.isActive ? "bg-emerald-600" : "bg-slate-400"}`} />{event.isActive ? "Ativo" : "Encerrado"}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-slate-500">
                      <p className="flex items-center gap-1.5"><Icon name="calendar" /><time dateTime={event.eventDate}>{date.full}</time></p>
                      {event.location ? <p className="flex min-w-0 items-start gap-1.5"><Icon name="location" className="mt-0.5 size-4 shrink-0" /><span className="break-words">{event.location}</span></p> : null}
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex flex-col justify-between gap-4 border-t border-slate-100 pt-4 lg:flex-row lg:items-center">
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                    <p className="flex items-center gap-1.5 text-slate-500"><Icon name="photos" /><span className="font-semibold text-slate-800">{event.photoCount.toLocaleString("pt-BR")}</span> {event.photoCount === 1 ? "foto" : "fotos"}</p>
                    <p className="text-slate-500"><span className="font-semibold text-slate-800">{event.guestCount.toLocaleString("pt-BR")}</span> {event.guestCount === 1 ? "dispositivo" : "dispositivos"}</p>
                    <p className="text-slate-500">{formatEventStorage(event.storageBytes)}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                    <Link href={`/admin?event=${event.id}#photos`} className={secondaryAction}>Ver fotos</Link>
                    <Link href={`/admin/events/${event.id}/edit`} className={secondaryAction}>Editar evento</Link>
                    <Link href={`/admin/events/${event.id}/rsvps`} className={`col-span-2 inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 ${focusClass}`}>Convidados e presença</Link>
                  </div>
                </div>
                {event.photoCount > 0 ? (
                  <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs text-slate-500">
                    <p>{event.lastPhotoAt ? `Último envio: ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(event.lastPhotoAt))}` : "Fotos disponíveis no acervo"}</p>
                    <a href={`/api/admin/events/${event.id}/photos.zip`} className={`inline-flex min-h-8 items-center rounded font-medium text-emerald-800 underline underline-offset-4 ${focusClass}`}>Baixar fotos em ZIP</a>
                  </div>
                ) : null}
              </div>
              <div className="flex justify-end border-t border-slate-100 px-5">
                <Link href={`/admin/events/${event.id}/delete`} className={`inline-flex min-h-10 items-center rounded text-xs font-medium text-red-700 hover:underline ${focusClass}`}>Excluir evento…</Link>
              </div>
              <EventSharePanel event={event} />
            </article>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-400"><Icon name={events.length === 0 ? "calendar" : "search"} className="size-6" /></div>
          <h3 className="mt-4 text-lg font-semibold">{events.length === 0 ? "Seu primeiro evento começa aqui" : "Nenhum evento encontrado"}</h3>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-500">{events.length === 0 ? "Crie um evento para organizar os convites, acompanhar as presenças e reunir as fotos." : "Tente outro nome, local ou status para encontrar o evento."}</p>
          {events.length === 0 ? <Link href="/admin/events/new" className={`mt-5 inline-flex min-h-11 items-center rounded-xl bg-emerald-700 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-800 ${focusClass}`}>Criar primeiro evento</Link> : <button type="button" onClick={clearFilters} className={`mt-5 ${secondaryAction}`}>Limpar filtros</button>}
        </div>
      ) : null}

      {totalPages > 1 ? (
        <nav aria-label="Paginação dos eventos" className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p aria-live="polite" className="text-sm text-slate-500">{start + 1}–{Math.min(start + PAGE_SIZE, filtered.length)} de {filtered.length} eventos</p>
          <div className="flex items-center gap-3">
            <button type="button" disabled={currentPage === 1} onClick={() => goToPage(currentPage - 1)} className={`${secondaryAction} disabled:cursor-not-allowed disabled:opacity-40`}>Anterior</button>
            <span className="text-sm tabular-nums text-slate-500">{currentPage} / {totalPages}</span>
            <button type="button" disabled={currentPage === totalPages} onClick={() => goToPage(currentPage + 1)} className={`${secondaryAction} disabled:cursor-not-allowed disabled:opacity-40`}>Próxima</button>
          </div>
        </nav>
      ) : null}
    </section>
  );
}
