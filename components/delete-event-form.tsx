"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

export function DeleteEventForm({ eventId, eventName, photoCount }: {
  eventId: string; eventName: string; photoCount: number;
}) {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [removed, setRemoved] = useState(0);
  const controllerRef = useRef<AbortController | null>(null);
  const running = useRef(false);

  useEffect(() => () => controllerRef.current?.abort(), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (running.current || confirmation.trim() !== eventName) return;
    running.current = true;
    setPending(true);
    setError("");
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      for (;;) {
        const response = await fetch(`/api/admin/events/${eventId}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirmation }),
          signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error?.message || "Não foi possível excluir o evento.");
        setRemoved((count) => count + (result.removedPhotos ?? 0));
        if (result.deleted) {
          router.push("/admin?status=deleted");
          router.refresh();
          return;
        }
      }
    } catch (failure) {
      if (controller.signal.aborted) return;
      setError((failure instanceof Error && !(failure instanceof TypeError)) ? failure.message : "A conexão foi interrompida. Tente novamente para retomar a exclusão.");
    } finally {
      running.current = false;
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6">
      <label htmlFor="confirm-event-name" className="block text-sm font-medium text-slate-700">
        Para confirmar, digite o nome do evento
      </label>
      <p id="expected-event-name" className="mt-2 break-words rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900">{eventName}</p>
      <input id="confirm-event-name" value={confirmation} onChange={(event) => setConfirmation(event.target.value)}
        disabled={pending} autoComplete="off" spellCheck={false} required aria-describedby="expected-event-name delete-event-warning"
        className="mt-3 min-h-12 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100 disabled:bg-slate-100" />
      {pending ? (
        <p role="status" className="mt-4 text-sm text-slate-600">
          Excluindo evento… {removed > 0 ? `${removed} foto(s) removida(s)${photoCount > 0 ? ` de aproximadamente ${photoCount}` : ""}.` : "Preparando a limpeza dos arquivos."}
          {" "}Aguarde nesta página.
        </p>
      ) : null}
      {error ? <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p> : null}
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        {!pending ? <Link href="/admin" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500">Cancelar</Link> : null}
        <button type="submit" disabled={pending || confirmation.trim() !== eventName}
          className="min-h-12 rounded-xl bg-red-700 px-5 py-3 text-sm font-semibold text-white hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
          {pending ? "Excluindo…" : error ? "Tentar exclusão novamente" : "Excluir evento definitivamente"}
        </button>
      </div>
    </form>
  );
}
