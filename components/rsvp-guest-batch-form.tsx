"use client";

import { type FormEvent, useId, useRef, useState } from "react";

import { MAX_RSVP_GUEST_BATCH, rsvpGuestBatchSchema, rsvpGuestBatchResponseSchema } from "@/lib/events/rsvp-guest-contract";
import { apiErrorResponseSchema } from "@/lib/photos/upload-contract";

type Row = { id: string; name: string; phone: string; email: string };
const initialRow = (): Row => ({ id: "initial", name: "", phone: "", email: "" });

export function RsvpGuestBatchForm({ eventId, disabled = false, onSaved }: {
  eventId: string; disabled?: boolean; onSaved: () => void;
}) {
  const formId = useId();
  const [rows, setRows] = useState<Row[]>([initialRow()]);
  const [pending, setPending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const batchId = useRef<string | null>(null);
  const locked = pending || disabled || uncertain;

  function updateRow(id: string, field: "name" | "phone" | "email", value: string) {
    batchId.current = null;
    setErrors({}); setMessage("");
    setRows((current) => current.map((row) => row.id === id ? { ...row, [field]: value } : row));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || disabled) return;
    batchId.current ??= crypto.randomUUID();
    const input = rsvpGuestBatchSchema.safeParse({ batchId: batchId.current, guests: rows });
    if (!input.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of input.error.issues) {
        const index = issue.path[1];
        const field = issue.path[2];
        if (typeof index === "number" && typeof field === "string") {
          fieldErrors[`${rows[index].id}:${field}`] = field === "name"
            ? "Informe um nome com até 200 caracteres."
            : field === "phone" ? "Informe um telefone válido com país e DDD."
            : issue.code === "custom" ? "E-mail repetido nesta lista." : "Informe um e-mail válido.";
        }
      }
      setErrors(fieldErrors); setMessage("Revise os campos destacados antes de salvar.");
      return;
    }
    setPending(true); setErrors({}); setMessage("");
    try {
      const response = await fetch(`/api/admin/events/${eventId}/invitations/batch`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input.data),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const knownFailure = [400, 401, 403, 404, 409].includes(response.status);
        setUncertain(!knownFailure);
        if (knownFailure) batchId.current = null;
        const error = apiErrorResponseSchema.safeParse(body);
        setMessage(error.success ? error.data.error.message : "Não foi possível salvar os convidados. Tente novamente.");
        return;
      }
      const result = rsvpGuestBatchResponseSchema.safeParse(body);
      if (!result.success) throw new Error("invalid_response");
      setRows([initialRow()]); setUncertain(false); batchId.current = null;
      setMessage(`${result.data.savedCount} convidado(s) cadastrado(s). Os links individuais estão disponíveis na lista abaixo.`);
      onSaved();
    } catch {
      setUncertain(true);
      setMessage("Não foi possível confirmar o salvamento. Tente novamente para verificar e concluir esta lista.");
    } finally { setPending(false); }
  }

  return <form onSubmit={save} className="mt-5 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm font-medium text-slate-700">{rows.length} convidado(s) para cadastrar</p>
    </div>
    <fieldset disabled={locked} className="space-y-3 disabled:opacity-60">
      <legend className="sr-only">Novos convidados</legend>
      {rows.map((row, index) => <div key={row.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-slate-700">Convidado {index + 1}</p>
          <button type="button" disabled={rows.length === 1} aria-label={`Remover convidado ${index + 1}`}
            onClick={() => { batchId.current = null; setErrors({}); setMessage(""); setRows((current) => current.filter((item) => item.id !== row.id)); }}
            className="text-sm text-red-700 underline disabled:opacity-40">Remover</button>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {(["name", "phone", "email"] as const).map((field) => {
            const error = errors[`${row.id}:${field}`];
            const id = `${formId}-${index}-${field}`;
            return <div key={field}>
              <label htmlFor={id} className="text-sm text-slate-700">{field === "name" ? "Nome" : field === "phone" ? "WhatsApp (opcional)" : "E-mail de contato (opcional)"}</label>
              <input id={id} name={`${field}-${index}`} value={row[field]}
                type={field === "phone" ? "tel" : field === "email" ? "email" : "text"}
                required={field === "name"} maxLength={field === "name" ? 200 : field === "phone" ? 30 : 254}
                autoComplete="off" placeholder={field === "phone" ? "55 11 99999-9999" : undefined}
                onChange={(event) => updateRow(row.id, field, event.target.value)}
                aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : field === "phone" ? `${id}-help` : undefined}
                className={`mt-1 w-full rounded-xl border bg-white px-3 py-2 ${error ? "border-red-500" : "border-slate-300"}`} />
              {field === "phone" ? <p id={`${id}-help`} className="mt-1 text-xs text-slate-500">Inclua país e DDD.</p> : null}
              {error ? <p id={`${id}-error`} className="mt-1 text-xs text-red-700">{error}</p> : null}
            </div>;
          })}
        </div>
      </div>)}
    </fieldset>
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" disabled={locked || rows.length >= MAX_RSVP_GUEST_BATCH}
        onClick={() => { batchId.current = null; setMessage(""); setRows((current) => [...current, { ...initialRow(), id: crypto.randomUUID() }]); }}
        className="rounded-xl border border-emerald-700 px-4 py-2.5 text-sm font-medium text-emerald-700 disabled:opacity-40">
        <span aria-hidden="true">+ </span>Adicionar convidado
      </button>
      <button type="submit" disabled={pending || disabled}
        className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60">
        {pending ? "Salvando…" : uncertain ? "Verificar e salvar lista" : `Salvar todos (${rows.length})`}
      </button>
      <p className="text-xs text-slate-500">Até {MAX_RSVP_GUEST_BATCH} convidados por vez.</p>
    </div>
    {message ? <p role="status" className="text-sm text-slate-700">{message}</p> : null}
  </form>;
}
