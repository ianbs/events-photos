"use client";

import { useEffect, useId, useRef, useState } from "react";
import { type z } from "zod";

import { createWhatsAppUrl, includeInvitationLink } from "@/lib/events/invitation-distribution";
import { type whatsappInvitationsResponseSchema } from "@/lib/events/rsvp-guest-contract";

export type WhatsAppInvitation = z.infer<typeof whatsappInvitationsResponseSchema>["invitations"][number];

export function RsvpWhatsAppSender({ invitations, onDismiss }: {
  invitations: WhatsAppInvitation[]; onDismiss: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [index, setIndex] = useState(0);
  const [messages, setMessages] = useState(() => invitations.map((invitation) => invitation.message));
  const [feedback, setFeedback] = useState("");
  const invitation = invitations[index];
  const message = includeInvitationLink(messages[index], invitation.url);

  useEffect(() => { dialogRef.current?.showModal(); }, []);

  function move(nextIndex: number) {
    setIndex(nextIndex); setFeedback("");
  }

  return <dialog ref={dialogRef} onClose={onDismiss} aria-labelledby={titleId}
    className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl backdrop:bg-slate-900/50 sm:p-6">
    <div className="flex items-center justify-between gap-4">
      <h2 id={titleId} className="text-xl font-semibold">Convites pelo WhatsApp</h2>
      <button type="button" onClick={() => dialogRef.current?.close()} className="text-sm text-slate-600 underline">Fechar</button>
    </div>
    <p role="status" className="mt-4 text-sm text-slate-500">Convidado {index + 1} de {invitations.length}</p>
    <p className="mt-1 text-lg font-semibold">{invitation.name}</p>
    <p className="text-sm text-slate-600">+{invitation.phone}</p>
    <label className="mt-5 block text-sm font-medium">Mensagem para este convidado
      <textarea rows={7} maxLength={6000} value={messages[index]}
        onChange={(event) => {
          const value = event.target.value;
          setMessages((current) => current.map((text, position) => position === index ? value : text));
          setFeedback("");
        }} className="mt-2 w-full resize-y rounded-xl border border-slate-300 p-3 font-normal" />
    </label>
    <p className="mt-2 text-xs text-slate-500">Você pode ajustar o texto para este envio. O link individual é incluído automaticamente.</p>
    <div className="mt-5 flex flex-wrap items-center gap-4">
      <a href={createWhatsAppUrl(invitation.phone, message)!} target="_blank" rel="noopener noreferrer"
        className="rounded-xl bg-emerald-700 px-4 py-3 text-sm font-medium text-white">Abrir WhatsApp</a>
      <a href={createWhatsAppUrl(invitation.phone, message, "web")!} target="_blank" rel="noopener noreferrer"
        className="rounded-xl border border-emerald-700 px-4 py-3 text-sm font-medium text-emerald-700">Abrir WhatsApp Web</a>
      <button type="button" onClick={() => {
        void navigator.clipboard.writeText(message).then(() => setFeedback("Mensagem e link copiados."),
          () => setFeedback("Não foi possível copiar. Selecione o texto da mensagem e o link abaixo."));
      }} className="text-sm text-emerald-700 underline">Copiar mensagem e link</button>
    </div>
    <p className="mt-3 text-xs text-slate-500">No computador, use WhatsApp Web. Se os emojis não aparecerem, copie a mensagem e cole na conversa.</p>
    {feedback ? <p role="status" className="mt-3 text-sm text-slate-600">{feedback}</p> : null}
    <label className="mt-4 block text-xs text-slate-500">Link individual
      <input readOnly value={invitation.url} onFocus={(event) => event.target.select()}
        className="mt-1 w-full rounded-lg border border-slate-200 p-2" />
    </label>
    <p className="mt-4 text-sm text-slate-600">Envie a mensagem no WhatsApp. Depois, volte aqui para continuar a lista.</p>
    {invitations.length > 1 ? <div className="mt-5 flex justify-between gap-3 border-t border-slate-200 pt-4">
      <button type="button" disabled={index === 0} onClick={() => move(index - 1)}
        className="text-sm text-slate-700 underline disabled:opacity-40">Anterior</button>
      {index + 1 < invitations.length ? <button type="button" onClick={() => move(index + 1)}
        className="rounded-xl border border-emerald-700 px-4 py-2 text-sm font-medium text-emerald-700">Próximo convidado</button>
        : <button type="button" onClick={() => dialogRef.current?.close()}
          className="rounded-xl border border-emerald-700 px-4 py-2 text-sm font-medium text-emerald-700">Fechar lista</button>}
    </div> : null}
  </dialog>;
}
