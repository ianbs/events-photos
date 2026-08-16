import Link from "next/link";

import { CreateEventForm } from "@/components/create-event-form";

export default function NewAdminEventPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <Link href="/admin" className="text-sm text-emerald-700 underline">
        Voltar para a administração
      </Link>
      <section className="mt-5 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-8">
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-emerald-700">
          Eventos
        </p>
        <h1 className="mt-1 text-3xl font-semibold">Criar novo evento</h1>
        <p className="mt-2 text-sm text-slate-600">
          A página do evento e o QR Code ficarão disponíveis no painel após a
          criação.
        </p>
        <CreateEventForm />
      </section>
    </main>
  );
}
