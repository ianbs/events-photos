"use client";

import { type FormEvent, useEffect, useId, useState } from "react";

import { rsvpInputSchema, rsvpResponseSchema, type Rsvp } from "@/lib/events/rsvp-contract";
import { createGuestToken, getGuestTokenStorageKey, guestTokenSchema } from "@/lib/guests/guest-token";
import { apiErrorResponseSchema } from "@/lib/photos/upload-contract";

async function requestRsvp(slug: string, method: "POST" | "PUT", input: unknown, signal?: AbortSignal) {
  const response = await fetch(`/api/events/${slug}/rsvp`, {
    method, headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input), cache: "no-store", signal,
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = apiErrorResponseSchema.safeParse(body);
    throw new Error(error.success ? error.data.error.message : "Não foi possível registrar sua resposta.");
  }
  const result = rsvpResponseSchema.safeParse(body);
  if (!result.success) throw new Error("Não foi possível carregar sua resposta. Tente novamente.");
  return result.data.rsvp;
}

export function EventRsvpForm({ eventId, eventSlug }: { eventId: string; eventSlug: string }) {
  const nameId = useId();
  const companionsId = useId();
  const [token, setToken] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [attending, setAttending] = useState<boolean | null>(null);
  const [companions, setCompanions] = useState(0);
  const [saved, setSaved] = useState<Rsvp | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "saving" | "error">("loading");
  const [message, setMessage] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function initialize() {
      try {
        const key = getGuestTokenStorageKey(eventId);
        const stored = guestTokenSchema.safeParse(localStorage.getItem(key));
        const guestToken = stored.success ? stored.data : createGuestToken();
        // Save before sending so retries recover the same guest after a network failure.
        localStorage.setItem(key, guestToken);
        const rsvp = await requestRsvp(eventSlug, "POST", { guestToken }, controller.signal);
        if (controller.signal.aborted) return;
        setToken(guestToken);
        setSaved(rsvp);
        if (rsvp) {
          setName(rsvp.name);
          setAttending(rsvp.attending);
          setCompanions(rsvp.companions);
        }
        setStatus("ready");
        setMessage("");
      } catch {
        if (controller.signal.aborted) return;
        setStatus("error");
        setMessage("Não foi possível carregar sua resposta. Verifique sua conexão e permita o armazenamento no navegador.");
      }
    }
    void initialize();
    return () => controller.abort();
  }, [eventId, eventSlug, attempt]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status !== "ready" || !token) return;
    const input = rsvpInputSchema.safeParse({ guestToken: token, name, attending, companions });
    if (!input.success) {
      setMessage("Informe seu nome, escolha uma resposta e revise os acompanhantes.");
      return;
    }
    setStatus("saving");
    setMessage("");
    try {
      const rsvp = await requestRsvp(eventSlug, "PUT", input.data);
      if (!rsvp) throw new Error("Não foi possível registrar sua resposta.");
      setSaved(rsvp);
      setMessage("Sua resposta foi salva com sucesso.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível registrar sua resposta. Tente novamente.");
    } finally {
      setStatus("ready");
    }
  }

  const disabled = status !== "ready";
  return (
    <section className="mt-7 w-full rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-7" aria-labelledby="rsvp-heading">
      <h2 id="rsvp-heading" className="text-xl font-semibold">Confirmação de presença</h2>
      {saved ? <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
        {saved.attending ? `Presença confirmada para ${saved.name}${saved.companions ? ` e ${saved.companions} acompanhante(s)` : ""}.` : `Resposta registrada: ${saved.name} não poderá comparecer.`}
        {" "}Você pode atualizar sua resposta abaixo.
      </p> : null}
      {status === "loading" ? <p role="status" className="mt-4 text-sm text-slate-600">Carregando…</p> : null}
      {status === "error" ? <button type="button" onClick={() => { setStatus("loading"); setAttempt((value) => value + 1); }}
        className="mt-4 text-sm text-[var(--event-primary)] underline">Tentar novamente</button> : null}
      <form onSubmit={submit} className="mt-5 space-y-5">
        <fieldset disabled={disabled} className="space-y-5 disabled:opacity-60">
          <div>
            <label htmlFor={nameId} className="block text-sm font-medium text-slate-700">Seu nome completo</label>
            <input id={nameId} name="name" autoComplete="name" required maxLength={200} value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 focus:outline-2 focus:outline-[var(--event-primary)]" />
          </div>
          <fieldset>
            <legend className="text-sm font-medium text-slate-700">Você poderá comparecer?</legend>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:gap-6">
              <label className="flex items-center gap-2"><input type="radio" name="attending" required checked={attending === true}
                onChange={() => setAttending(true)} className="accent-[var(--event-primary)]" /> Sim, estarei presente</label>
              <label className="flex items-center gap-2"><input type="radio" name="attending" required checked={attending === false}
                onChange={() => { setAttending(false); setCompanions(0); }} className="accent-[var(--event-primary)]" /> Não poderei comparecer</label>
            </div>
          </fieldset>
          {attending === true ? <div>
            <label htmlFor={companionsId} className="block text-sm font-medium text-slate-700">Quantidade de acompanhantes</label>
            <input id={companionsId} name="companions" type="number" min={0} max={10} required value={companions}
              onChange={(event) => setCompanions(event.target.valueAsNumber)}
              aria-describedby={`${companionsId}-help`}
              className="mt-2 w-28 rounded-xl border border-slate-300 px-4 py-3" />
            <p id={`${companionsId}-help`} className="mt-2 text-sm text-slate-500">Sem contar você. Informe 0 se vier sozinho(a).</p>
          </div> : null}
          <button type="submit" className="w-full rounded-xl bg-[var(--event-primary)] px-4 py-3 font-medium text-white hover:opacity-90 disabled:cursor-wait">
            {status === "saving" ? "Salvando…" : saved ? "Atualizar resposta" : "Enviar resposta"}
          </button>
        </fieldset>
        {message ? <p role="status" className="text-sm text-slate-700">{message}</p> : null}
      </form>
    </section>
  );
}
