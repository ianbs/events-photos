"use client";

import { useEffect, useState, type FormEvent } from "react";
import { invitationCodeSchema, rsvpAccessResponseSchema, type Rsvp, type RsvpCredentials } from "@/lib/events/rsvp-contract";
import { apiErrorResponseSchema } from "@/lib/photos/upload-contract";

export function RsvpAccess({ eventSlug, onAuthorized }: {
  eventSlug: string; onAuthorized: (credentials: RsvpCredentials, rsvp: Rsvp | null, companionLimit: number) => void;
}) {
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const code = new URLSearchParams(window.location.hash.slice(1)).get("convite");
    if (!code) return;
    const timer = window.setTimeout(() => {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      setCode(code);
      void authorize(code, controller.signal);
    }, 0);
    return () => { window.clearTimeout(timer); controller.abort(); };

    async function authorize(code: string, signal: AbortSignal) {
      setPending(true); setMessage("");
      try {
        const credentials = invitationCredentials(code);
        const access = await accessInvitation(eventSlug, credentials, signal);
        if (!signal.aborted) onAuthorized(credentials, access.rsvp, access.companionLimit);
      } catch (error) {
        if (!signal.aborted) setMessage(error instanceof Error ? error.message : "Não foi possível acessar o convite.");
      } finally { if (!signal.aborted) setPending(false); }
    }
  }, [eventSlug, onAuthorized]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setMessage("");
    try {
      const credentials = invitationCredentials(code);
      const access = await accessInvitation(eventSlug, credentials);
      onAuthorized(credentials, access.rsvp, access.companionLimit);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível continuar."); }
    finally { setPending(false); }
  }

  return <section className="mt-7 w-full rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-7">
    <h2 className="text-xl font-semibold">Acessar seu convite</h2>
    <p className="mt-2 text-sm text-slate-600">Abra o link individual enviado pelo organizador ou informe o código abaixo. O mesmo convite funciona em qualquer dispositivo.</p>
    <form onSubmit={submit} className="mt-5 space-y-4">
      <label className="block text-sm font-medium">Código do convite<input type="text" required autoComplete="off" value={code} disabled={pending}
        onChange={(e) => setCode(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" /></label>
      <button disabled={pending} className="w-full rounded-xl bg-[var(--event-primary)] px-4 py-3 font-medium text-white disabled:opacity-60">
        {pending ? "Acessando convite…" : "Acessar confirmação"}
      </button>
      {message ? <p role="status" className="text-sm text-slate-700">{message}</p> : null}
    </form>
  </section>;
}

function invitationCredentials(code: string): RsvpCredentials {
  const result = invitationCodeSchema.safeParse(code);
  if (!result.success) throw new Error("Cole o código completo do convite.");
  return { method: "invitation", invitationCode: result.data };
}

async function accessInvitation(eventSlug: string, credentials: RsvpCredentials, signal?: AbortSignal) {
  const response = await fetch(`/api/events/${eventSlug}/rsvp`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials), cache: "no-store", signal,
  });
  const body: unknown = await response.json();
  if (!response.ok) {
    const error = apiErrorResponseSchema.safeParse(body);
    throw new Error(error.success ? error.data.error.message : "Não foi possível acessar sua confirmação.");
  }
  return rsvpAccessResponseSchema.parse(body);
}
