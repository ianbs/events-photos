"use client";

import { type FormEvent, useCallback, useId, useState } from "react";

import { rsvpInputSchema, rsvpResponseSchema, type Rsvp, type RsvpCredentials } from "@/lib/events/rsvp-contract";
import { RsvpAccess } from "@/components/rsvp-access";
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

export function EventRsvpForm({ eventSlug }: { eventSlug: string }) {
  const [access, setAccess] = useState<{ credentials: RsvpCredentials; rsvp: Rsvp | null; companionLimit: number } | null>(null);
  const authorize = useCallback((credentials: RsvpCredentials, rsvp: Rsvp | null, companionLimit: number) => setAccess({ credentials, rsvp, companionLimit }), []);
  return access ? <AuthenticatedRsvpForm eventSlug={eventSlug} companionLimit={access.companionLimit} credentials={access.credentials} initialRsvp={access.rsvp} onReset={() => setAccess(null)} />
    : <RsvpAccess eventSlug={eventSlug} onAuthorized={authorize} />;
}

function AuthenticatedRsvpForm({ eventSlug, companionLimit, credentials, initialRsvp, onReset }: {
  eventSlug: string; companionLimit: number; credentials: RsvpCredentials; initialRsvp: Rsvp | null; onReset: () => void;
}) {
  const companionsAllowed = companionLimit > 0;
  const nameId = useId();
  const companionsId = useId();
  const companionNamesId = useId();
  const [name, setName] = useState(initialRsvp?.name ?? "");
  const [attending, setAttending] = useState<boolean | null>(initialRsvp?.attending ?? null);
  const [companions, setCompanions] = useState(Math.min(initialRsvp?.companions ?? 0, companionLimit));
  const [companionNames, setCompanionNames] = useState((initialRsvp?.companion_names ?? []).slice(0, companionLimit).join("\n"));
  const [saved, setSaved] = useState<Rsvp | null>(initialRsvp);
  const [status, setStatus] = useState<"ready" | "saving">("ready");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status !== "ready") return;
    const input = rsvpInputSchema.safeParse({ credentials, name, attending, companions: companionsAllowed ? companions : 0,
      companionNames: attending && companionsAllowed ? companionNames.split(/\r?\n/).map((name) => name.trim()).filter(Boolean) : [],
    });
    if (!input.success) {
      setMessage(input.error.issues.find((issue) => issue.path[0] === "companionNames")?.message
        ?? "Informe seu nome, escolha uma resposta e revise a quantidade e os nomes dos acompanhantes.");
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
        {saved.companion_names.length ? ` Acompanhantes: ${saved.companion_names.join(", ")}.` : ""}
        {" "}Você pode atualizar sua resposta abaixo.
      </p> : null}
      <button type="button" disabled={status === "saving"} onClick={onReset} className="mt-3 text-sm text-[var(--event-primary)] underline">Usar outro convite</button>
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
                onChange={() => { setAttending(false); setCompanions(0); setCompanionNames(""); }} className="accent-[var(--event-primary)]" /> Não poderei comparecer</label>
            </div>
          </fieldset>
          {attending === true && !companionsAllowed ? <p className="text-sm text-slate-600">Seu convite não permite acompanhantes. Sua confirmação será apenas para você.</p> : null}
          {attending === true && companionsAllowed ? <div>
            <label htmlFor={companionsId} className="block text-sm font-medium text-slate-700">Quantidade de acompanhantes</label>
            <input id={companionsId} name="companions" type="number" min={0} max={companionLimit} step={1} required value={companions}
              onChange={(event) => { setCompanions(event.target.valueAsNumber); if (event.target.valueAsNumber === 0) setCompanionNames(""); }}
              aria-describedby={`${companionsId}-help`}
              className="mt-2 w-28 rounded-xl border border-slate-300 px-4 py-3" />
            <p id={`${companionsId}-help`} className="mt-2 text-sm text-slate-500">Sem contar você. Máximo de {companionLimit} acompanhante(s). Informe 0 se vier sozinho(a).</p>
          </div> : null}
          {attending === true && companionsAllowed && companions > 0 ? <div>
            <label htmlFor={companionNamesId} className="block text-sm font-medium text-slate-700">Nomes dos acompanhantes (opcional)</label>
            <textarea id={companionNamesId} name="companionNames" rows={3} maxLength={20000} value={companionNames}
              onChange={(event) => setCompanionNames(event.target.value)} aria-describedby={`${companionNamesId}-help`}
              placeholder={"Ex.: João Silva\nMaria Silva"}
              className="mt-2 w-full resize-y rounded-xl border border-slate-300 px-4 py-3 focus:outline-2 focus:outline-[var(--event-primary)]" />
            <p id={`${companionNamesId}-help`} className="mt-2 text-sm text-slate-500">Informe um nome por linha, até {companions} nome(s). Cada nome pode ter até 200 caracteres.</p>
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
