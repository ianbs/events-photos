import Link from "next/link";
import { z } from "zod";

import { findAdminEventById } from "@/lib/events/admin-event-service";
import { listAdminRsvps } from "@/lib/events/rsvp-service";

export default async function AdminRsvpsPage({ params, searchParams }: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { eventId } = await params;
  const query = await searchParams;
  const pageResult = z.coerce.number().int().min(1).max(100000).safeParse(query.page ?? 1);
  const page = pageResult.success ? pageResult.data : 1;
  const event = await findAdminEventById(eventId);
  const { responses, total, pageSize } = await listAdminRsvps(event.id, page);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Link href="/admin" className="text-sm text-emerald-700 underline">Voltar aos eventos</Link>
      <p className="mt-6 text-sm font-medium uppercase tracking-[0.16em] text-emerald-700">Confirmações de presença</p>
      <h1 className="mt-1 text-3xl font-semibold">{event.name}</h1>
      <p className="mt-3 text-slate-600">{total} resposta(s) recebida(s)</p>
      <Link href={`/e/${event.slug}/save-the-date`} target="_blank" rel="noreferrer"
        className="mt-3 inline-block text-sm text-emerald-700 underline">Abrir save the date para compartilhar</Link>
      <div className="mt-6 overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Respostas de presença para {event.name}</caption>
          <thead className="bg-slate-50 text-slate-600"><tr>
            <th scope="col" className="p-4">Convidado</th><th scope="col" className="p-4">Presença</th>
            <th scope="col" className="p-4">Acompanhantes</th><th scope="col" className="p-4">Atualização</th>
          </tr></thead>
          <tbody>{responses.map((response) => <tr key={response.guest_id} className="border-t border-slate-100">
            <td className="p-4 font-medium">{response.name}</td>
            <td className={`p-4 ${response.attending ? "text-emerald-700" : "text-slate-600"}`}>{response.attending ? "Confirmada" : "Não comparecerá"}</td>
            <td className="p-4">{response.companions}</td>
            <td className="whitespace-nowrap p-4 text-slate-500">{new Intl.DateTimeFormat("pt-BR", {
              dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo",
            }).format(new Date(response.updated_at))}</td>
          </tr>)}</tbody>
        </table>
        {responses.length === 0 ? <p className="p-6 text-slate-500">Nenhuma resposta nesta página.</p> : null}
      </div>
      <nav aria-label="Páginas de respostas" className="mt-5 flex items-center gap-5 text-sm">
        {page > 1 ? <Link href={`?page=${page - 1}`} className="text-emerald-700 underline">Anterior</Link> : null}
        <span>Página {page}</span>
        {page * pageSize < total ? <Link href={`?page=${page + 1}`} className="text-emerald-700 underline">Próxima</Link> : null}
      </nav>
    </main>
  );
}
