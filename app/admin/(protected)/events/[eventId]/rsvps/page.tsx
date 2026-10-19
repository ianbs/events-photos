import Link from "next/link";
import { AdminRsvpResponses } from "@/components/admin-rsvp-responses";
import { RsvpInvitations } from "@/components/rsvp-invitations";
import { readRsvpListQuery, type RsvpListSearchParams } from "@/lib/events/admin-rsvp-list";
import { findAdminEventById } from "@/lib/events/admin-event-service";
import { listAdminRsvps, readAdminRsvpSummary } from "@/lib/events/rsvp-service";
import { listRsvpInvitations } from "@/lib/events/rsvp-invitation-service";
import { getRsvpCompanionLimit } from "@/lib/events/rsvp-companions";

export default async function AdminRsvpsPage({ params, searchParams }: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<RsvpListSearchParams>;
}) {
  const { eventId } = await params;
  const query = readRsvpListQuery(await searchParams);
  const event = await findAdminEventById(eventId);
  const [{ responses, total, pageSize }, invitationList, summary] = await Promise.all([
    listAdminRsvps(event.id, query.page, query),
    listRsvpInvitations(event.id, query.invitationPage),
    readAdminRsvpSummary(event.id),
  ]);
  const answered = summary.confirmedGuests + summary.declined;
  const guests = answered + summary.pending;
  const percentage = guests ? Math.round(answered / guests * 100) : 0;
  const eventDate = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Sao_Paulo" }).format(new Date(event.eventDate));

  return (
    <main className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-9">
      <Link href="/admin" className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-medium text-slate-500 hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">
        <span aria-hidden="true">←</span> Todos os eventos
      </Link>
      <header className="mt-4 flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Confirmações de presença</p>
          <h1 className="mt-2 break-words text-3xl font-semibold tracking-tight sm:text-4xl">{event.name}</h1>
          <p className="mt-2 text-sm text-slate-500">{eventDate}{event.location ? ` · ${event.location}` : ""}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="#guests" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">Gerenciar convidados</a>
          <Link href={`/e/${event.slug}/save-the-date`} target="_blank" rel="noreferrer"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">Ver convite <span aria-hidden="true">↗</span><span className="sr-only"> (abre em nova aba)</span></Link>
        </div>
      </header>
      <section aria-label="Resumo de presença do evento" className="mt-7">
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <dt className="text-xs font-medium text-slate-500 sm:text-sm">Convidados na lista</dt>
            <dd className="mt-3 text-3xl font-semibold tabular-nums tracking-tight text-slate-900">{guests}</dd>
            <dd className="mt-1 text-xs text-slate-500">Sem contar acompanhantes</dd>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5">
            <dt className="text-xs font-medium text-emerald-800 sm:text-sm">Pessoas confirmadas</dt>
            <dd className="mt-3 text-3xl font-semibold tabular-nums tracking-tight text-emerald-900">{summary.confirmed}</dd>
            <dd className="mt-1 text-xs leading-relaxed text-emerald-800">{summary.confirmedGuests} convidado(s) + {summary.companions} acompanhante(s)</dd>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 sm:p-5">
            <dt className="text-xs font-medium text-amber-800 sm:text-sm">Aguardando resposta</dt>
            <dd className="mt-3 text-3xl font-semibold tabular-nums tracking-tight text-amber-900">{summary.pending}</dd>
            <dd className="mt-1 text-xs text-amber-800">Convidados que ainda não responderam</dd>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <dt className="text-xs font-medium text-slate-500 sm:text-sm">Não comparecerão</dt>
            <dd className="mt-3 text-3xl font-semibold tabular-nums tracking-tight text-slate-700">{summary.declined}</dd>
            <dd className="mt-1 text-xs text-slate-500">Convidados que recusaram</dd>
          </div>
        </dl>
        <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <p className="text-slate-600"><strong className="font-semibold text-slate-900">{answered} de {guests}</strong> convidados responderam</p>
            <span className="font-semibold tabular-nums text-emerald-800">{percentage}% de respostas</span>
          </div>
          <progress value={answered} max={guests || 1} aria-label="Convidados que responderam" className="mt-2 block h-1.5 w-full overflow-hidden rounded-full bg-slate-100 [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-slate-100 [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-emerald-600 [&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-emerald-600" />
        </div>
      </section>
      <AdminRsvpResponses responses={responses} total={total} pageSize={pageSize} query={query}
        counts={{ confirmed: summary.confirmedGuests, declined: summary.declined }} />
      <div id="guests" className="scroll-mt-6">
        <RsvpInvitations key={`${event.id}-${query.invitationPage}`} listQuery={query} eventId={event.id} eventMaxCompanions={event.maxCompanions} invitations={invitationList.invitations} total={invitationList.total} page={query.invitationPage} />
        <p className="mt-3 text-xs text-slate-500">Padrão do evento: até {getRsvpCompanionLimit(event.maxCompanions)} acompanhante(s) por convidado. Os limites individuais podem ser ajustados no cadastro.</p>
      </div>
    </main>
  );
}
