"use client";

import { useState } from "react";

import { suggestEventSlug } from "@/lib/events/event-validation";

export type EventFormValues = {
  eventDate: string;
  isActive: boolean;
  name: string;
  slug: string;
};

type EventFormFieldsProps = {
  defaultValues?: EventFormValues;
  pending: boolean;
  pendingLabel: string;
  showSlugChangeWarning?: boolean;
  submitLabel: string;
};

export function EventFormFields({
  defaultValues,
  pending,
  pendingLabel,
  showSlugChangeWarning = false,
  submitLabel,
}: EventFormFieldsProps) {
  const [slug, setSlug] = useState(defaultValues?.slug ?? "");
  const [slugWasEdited, setSlugWasEdited] = useState(Boolean(defaultValues));

  function handleNameChange(name: string) {
    if (!slugWasEdited) {
      setSlug(suggestEventSlug(name));
    }
  }

  return (
    <>
      <label className="block">
        <span className="text-sm font-medium text-slate-700">Nome</span>
        <input
          name="name"
          type="text"
          required
          maxLength={200}
          autoComplete="off"
          defaultValue={defaultValues?.name}
          onChange={(event) => handleNameChange(event.target.value)}
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
          placeholder="Ex.: Casamento Ana e João"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-slate-700">
          Endereço do evento
        </span>
        <div className="mt-2 flex rounded-xl border border-slate-300 bg-white focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-100">
          <span className="flex items-center border-r border-slate-200 px-3 text-sm text-slate-500">
            /e/
          </span>
          <input
            name="slug"
            type="text"
            required
            maxLength={100}
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            value={slug}
            onChange={(event) => {
              setSlugWasEdited(true);
              setSlug(event.target.value.toLowerCase());
            }}
            className="min-w-0 flex-1 rounded-r-xl px-4 py-3 outline-none"
            placeholder="casamento-ana-joao"
          />
        </div>
        {showSlugChangeWarning ? (
          <span className="mt-2 block text-xs text-amber-700">
            Alterar este endereço invalida links e QR Codes distribuídos
            anteriormente.
          </span>
        ) : (
          <span className="mt-2 block text-xs text-slate-500">
            Use letras minúsculas, números e hífens.
          </span>
        )}
      </label>

      <label className="block">
        <span className="text-sm font-medium text-slate-700">
          Data do evento
        </span>
        <input
          name="eventDate"
          type="date"
          required
          defaultValue={defaultValues?.eventDate}
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
        />
      </label>

      <label className="flex items-start gap-3 rounded-xl bg-slate-50 p-4">
        <input
          name="isActive"
          type="checkbox"
          defaultChecked={defaultValues?.isActive ?? true}
          className="mt-0.5 h-5 w-5 accent-emerald-700"
        />
        <span>
          <span className="block text-sm font-medium text-slate-700">
            Evento ativo
          </span>
          <span className="mt-1 block text-xs text-slate-500">
            Convidados poderão abrir a página e enviar fotos enquanto estiver
            ativo.
          </span>
        </span>
      </label>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-emerald-700 px-5 py-3 font-medium text-white hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? pendingLabel : submitLabel}
      </button>
    </>
  );
}
