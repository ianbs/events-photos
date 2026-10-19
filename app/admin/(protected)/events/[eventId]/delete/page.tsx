import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteEventForm } from "@/components/delete-event-form";
import { ApplicationError } from "@/lib/errors/application-error";
import { findEventDeletionSummary } from "@/lib/events/admin-event-deletion-service";

export default async function DeleteEventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  let event;
  try {
    event = await findEventDeletionSummary(eventId);
  } catch (error) {
    if (error instanceof ApplicationError && error.status === 404) notFound();
    throw error;
  }
  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <Link href="/admin" className="text-sm text-emerald-700 underline underline-offset-4">Voltar para os eventos</Link>
      <section className="mt-5 rounded-3xl border border-red-200 bg-white p-5 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-red-700">Exclusão permanente</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Excluir evento</h1>
        <h2 className="mt-3 text-lg font-medium break-words text-slate-700">{event.name}</h2>
        <div id="delete-event-warning" className="mt-5 rounded-xl bg-red-50 p-4 text-sm leading-relaxed text-red-900">
          <p className="font-semibold">Esta ação não pode ser desfeita.</p>
          <p className="mt-2">O evento, as fotos cadastradas, os convidados, as confirmações de presença, a capa, o logotipo e a música serão excluídos. Os links e convites deixarão de funcionar.</p>
          <p className="mt-2">Ao iniciar, o evento será desativado. Se a limpeza for interrompida, volte a esta tela para retomá-la.</p>
          <p className="mt-2">Se quiser apenas encerrar o acesso dos convidados, desative o evento na edição.</p>
        </div>
        <dl className="mt-5 grid grid-cols-3 gap-3 rounded-xl bg-slate-50 p-4 text-center">
          {([
            ["Fotos", event.photoCount],
            ["Convidados", event.guestCount],
            ["Confirmações", event.rsvpCount],
          ] as const).map(([label, count]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{count.toLocaleString("pt-BR")}</dd></div>)}
        </dl>
        <DeleteEventForm eventId={event.id} eventName={event.name} photoCount={event.photoCount} />
      </section>
    </main>
  );
}
