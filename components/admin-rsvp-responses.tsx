import Link from "next/link";
import { RsvpStatusBadge } from "@/components/rsvp-status-badge";
import { rsvpListHref, type RsvpListQuery } from "@/lib/events/admin-rsvp-list";

type Response = {
  guest_id: string; name: string; attending: boolean; companions: number;
  companion_names: string[]; updated_at: string;
};
const fieldClass = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";
const linkClass = "inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600";
const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" });
const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

function Companions({ response }: { response: Response }) {
  if (!response.attending) return <span className="text-slate-400" aria-label="Sem acompanhantes">—</span>;
  return <div>
    <p className="text-sm text-slate-700">{response.companions === 0 ? "Sem acompanhantes" : `${response.companions} acompanhante${response.companions === 1 ? "" : "s"}`}</p>
    {response.companion_names.length > 0 ? <details className="mt-1">
      <summary className="w-fit cursor-pointer py-1 text-xs font-medium text-emerald-800 underline decoration-emerald-300 underline-offset-2 focus-visible:outline-2 focus-visible:outline-emerald-600">Ver nomes</summary>
      <ul aria-label={`Acompanhantes de ${response.name}`} className="mt-1 space-y-1 border-l-2 border-emerald-100 pl-3 text-sm text-slate-600">
        {response.companion_names.map((name, index) => <li key={index} className="break-words">{name}</li>)}
      </ul>
    </details> : null}
  </div>;
}

function UpdatedAt({ value }: { value: string }) {
  const updated = new Date(value);
  return <time dateTime={value} className="text-xs text-slate-500">
    <span className="block text-sm text-slate-700">{date.format(updated)}</span>
    às {time.format(updated)}
  </time>;
}

export function AdminRsvpResponses({ responses, total, pageSize, query, counts }: {
  responses: Response[]; total: number; pageSize: number; query: RsvpListQuery;
  counts: { confirmed: number; declined: number };
}) {
  const filtered = Boolean(query.q || query.status !== "all");
  const hasResponses = counts.confirmed + counts.declined > 0;
  const tabs = [
    { value: "all", label: "Todas as respostas", count: counts.confirmed + counts.declined },
    { value: "confirmed", label: "Confirmadas", count: counts.confirmed },
    { value: "declined", label: "Não comparecerão", count: counts.declined },
  ] as const;
  const first = responses.length ? (query.page - 1) * pageSize + 1 : 0;
  const last = responses.length ? first + responses.length - 1 : 0;

  return <section id="responses" aria-labelledby="responses-title" className="mt-7 scroll-mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="border-b border-slate-100 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 id="responses-title" className="text-xl font-semibold tracking-tight">Respostas recebidas</h2>
          <p className="mt-1 text-sm text-slate-500">Consulte a presença e os acompanhantes de cada convidado.</p></div>
        <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">{counts.confirmed + counts.declined} respostas</span>
      </div>
      <nav aria-label="Filtrar respostas por presença" className="mt-5 flex flex-wrap gap-2">
        {tabs.map((tab) => <Link key={tab.value} href={rsvpListHref(query, { status: tab.value, page: 1 })}
          aria-current={query.status === tab.value ? "page" : undefined}
          className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 ${query.status === tab.value ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100"}`}>
          {tab.label}<span className={`rounded-md px-1.5 py-0.5 text-xs tabular-nums ${query.status === tab.value ? "bg-white/15 text-white" : "bg-white text-slate-500"}`}>{tab.count}</span>
        </Link>)}
      </nav>
      <form key={`${query.q}-${query.sort}-${query.status}`} action="#responses" className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
        {query.status !== "all" ? <input type="hidden" name="status" value={query.status} /> : null}
        {query.invitationPage > 1 ? <input type="hidden" name="invitationPage" value={query.invitationPage} /> : null}
        <label htmlFor="rsvp-search" className="flex-1 text-xs font-medium text-slate-600">Buscar convidado
          <span className="relative mt-1.5 block">
            <svg aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 size-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="10.5" cy="10.5" r="7" /><path d="m16 16 5 5" /></svg>
            <input id="rsvp-search" name="q" type="search" maxLength={100} defaultValue={query.q} placeholder="Nome do convidado" className={`${fieldClass} pl-9`} />
          </span>
        </label>
        <label htmlFor="rsvp-sort" className="text-xs font-medium text-slate-600 sm:w-48">Ordenar por
          <select id="rsvp-sort" name="sort" defaultValue={query.sort} className={`mt-1.5 ${fieldClass}`}>
            <option value="recent">Atualização mais recente</option><option value="oldest">Atualização mais antiga</option><option value="name">Nome de A a Z</option>
          </select>
        </label>
        <button type="submit" className="min-h-11 rounded-xl bg-emerald-700 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">Aplicar</button>
        {filtered || query.sort !== "recent" ? <Link href={rsvpListHref(query, { q: "", status: "all", sort: "recent", page: 1 })} className="inline-flex min-h-11 items-center justify-center px-1 text-sm text-slate-600 underline underline-offset-4">Limpar filtros</Link> : null}
      </form>
      {query.q ? <p role="status" className="mt-3 text-xs text-slate-500">{total} resultado(s) para <strong className="break-all text-slate-700">“{query.q}”</strong></p> : null}
    </div>
    {responses.length > 0 ? <>
      <div className="hidden md:block">
        <table className="w-full table-fixed text-left text-sm">
          <caption className="sr-only">Respostas de presença dos convidados</caption>
          <thead className="border-b border-slate-100 bg-slate-50/80 text-xs text-slate-500"><tr>
            <th scope="col" className="w-[30%] px-6 py-3 font-medium">Convidado</th><th scope="col" className="w-[23%] px-4 py-3 font-medium">Presença</th>
            <th scope="col" className="w-[27%] px-4 py-3 font-medium">Acompanhantes</th><th scope="col" className="px-4 py-3 font-medium">Última atualização</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-100">{responses.map((response) => <tr key={response.guest_id} className="align-top transition-colors hover:bg-slate-50/70">
            <th scope="row" className="break-words px-6 py-5 text-left font-medium text-slate-900">{response.name}</th>
            <td className="px-4 py-5"><RsvpStatusBadge attending={response.attending} /></td>
            <td className="px-4 py-5"><Companions response={response} /></td>
            <td className="px-4 py-5"><UpdatedAt value={response.updated_at} /></td>
          </tr>)}</tbody>
        </table>
      </div>
      <ul className="divide-y divide-slate-100 md:hidden" aria-label="Respostas de presença">
        {responses.map((response) => <li key={response.guest_id} className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-2"><h3 className="min-w-0 break-words font-semibold">{response.name}</h3><RsvpStatusBadge attending={response.attending} /></div>
          <div className="mt-4 flex justify-between gap-4"><Companions response={response} /><div className="shrink-0 text-right"><p className="mb-1 text-[11px] text-slate-400">Atualizado em</p><UpdatedAt value={response.updated_at} /></div></div>
        </li>)}
      </ul>
    </> : <div className="px-6 py-12 text-center">
      <span aria-hidden="true" className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="4" y="5" width="16" height="16" rx="3" /><path d="M8 3v4m8-4v4M4 11h16m-12 5h3" /></svg>
      </span>
      <h3 className="mt-4 font-semibold">{!hasResponses ? "As confirmações aparecerão aqui" : filtered ? "Nenhuma resposta encontrada" : "Nenhuma resposta nesta página"}</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-500">{!hasResponses ? "Cadastre os convidados e compartilhe os convites individuais para começar a receber respostas." : filtered ? "Tente outro nome ou remova os filtros para ver as demais respostas." : "Volte para a primeira página para consultar as respostas disponíveis."}</p>
      <Link href={!hasResponses ? "#guests" : rsvpListHref(query, { q: "", status: "all", page: 1 })} className={`mt-5 ${linkClass}`}>{!hasResponses ? "Gerenciar convidados" : "Ver todas as respostas"}</Link>
    </div>}
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 px-5 py-4 sm:px-6">
      <p className="text-xs text-slate-500">{responses.length ? `Exibindo ${first}–${last} de ${total} resposta${total === 1 ? "" : "s"}` : "Nenhuma resposta para exibir"}</p>
      <nav aria-label="Páginas de respostas" className="flex items-center gap-3">
        {query.page > 1 ? <Link href={rsvpListHref(query, { page: query.page - 1 })} className={linkClass}>Anterior</Link> : null}
        <span className="text-xs tabular-nums text-slate-500">Página {query.page} de {Math.max(1, Math.ceil(total / pageSize))}</span>
        {query.page * pageSize < total ? <Link href={rsvpListHref(query, { page: query.page + 1 })} className={linkClass}>Próxima</Link> : null}
      </nav>
    </div>
  </section>;
}
