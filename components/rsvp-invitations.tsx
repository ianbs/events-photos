"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { apiErrorResponseSchema } from "@/lib/photos/upload-contract";
import { createWhatsAppUrl } from "@/lib/events/invitation-distribution";
import { getRsvpCompanionLimit } from "@/lib/events/rsvp-companions";

type Guest = {
  guest_id: string; name: string; email: string | null; phone: string | null;
  invitation_revoked_at: string | null; hasRecoverableLink: boolean;
  max_companions: number | null;
  response: { attending: boolean; companions: number; companion_names: string[] } | null;
};
const responseSchema = z.object({ invitation: z.object({ code: z.string(), url: z.url(), message: z.string(), phone: z.string().nullable(), whatsappUrl: z.url().nullable() }).nullable() });
type GeneratedInvitation = z.infer<typeof responseSchema>["invitation"];

export function RsvpInvitations({ eventId, invitations, total, page, eventMaxCompanions }: {
  eventId: string; invitations: Guest[]; total: number; page: number; eventMaxCompanions: number | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [generated, setGenerated] = useState<GeneratedInvitation>(null);
  const [editing, setEditing] = useState<Guest | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [deleting, setDeleting] = useState<Guest | null>(null);
  const exportable = invitations.filter((guest) => guest.phone && guest.hasRecoverableLink && !guest.invitation_revoked_at);

  async function request(method: "POST" | "PATCH" | "DELETE", input: unknown) {
    setPending(true); setMessage(""); setGenerated(null);
    try {
      const response = await fetch(`/api/admin/events/${eventId}/invitations`, {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
      });
      const body: unknown = await response.json();
      if (!response.ok) throw responseError(body);
      setGenerated(responseSchema.parse(body).invitation);
      const retrieving = typeof input === "object" && input !== null && "action" in input && input.action === "retrieve";
      setMessage(method === "DELETE" ? "Convidado excluído. Seu convite e sua resposta de presença foram removidos." : method === "POST" ? "Convidado cadastrado. O link está salvo e pode ser recuperado depois." : retrieving ? "Link e código recuperados." : "Convite atualizado.");
      setEditing(null); setDeleting(null); setSelected([]);
      if (method === "DELETE" && invitations.length === 1 && page > 1) {
        const params = new URLSearchParams(window.location.search);
        params.set("invitationPage", String(page - 1));
        router.replace(`?${params.toString()}`);
      }
      router.refresh();
      return true;
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível atualizar o convidado."); return false; }
    finally { setPending(false); }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const saved = await request(editing ? "PATCH" : "POST", {
      name: data.get("name"), email: data.get("email"), phone: data.get("phone"),
      maxCompanions: data.get("maxCompanions"),
      ...(editing ? { action: "edit", guestId: editing.guest_id } : {}),
    });
    if (saved && !editing) form.reset();
  }

  async function exportSelected() {
    setPending(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/events/${eventId}/invitations/export`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ guestIds: selected }),
      });
      if (!response.ok) throw responseError(await response.json());
      const blobUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a"); link.href = blobUrl; link.download = "convites-whatsapp.csv";
      document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      setMessage("Lista exportada com telefones, links e mensagens prontas para WhatsApp.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível exportar os convites."); }
    finally { setPending(false); }
  }

  return <section className="mt-8 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
    <h2 className="text-xl font-semibold">Cadastro de convidados</h2>
    <p className="mt-2 text-sm text-slate-600">Cadastre cada convidado uma vez. Seu código e link ficam disponíveis aqui para consulta e compartilhamento a qualquer momento.</p>
    <form key={editing?.guest_id ?? "new"} onSubmit={save} className="mt-5 grid gap-3 sm:grid-cols-3">
      <label className="text-sm">Nome<input name="name" required maxLength={200} disabled={pending} defaultValue={editing?.name ?? ""}
        className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" /></label>
      <label className="text-sm">WhatsApp (opcional)<input name="phone" type="tel" maxLength={30} disabled={pending} defaultValue={editing?.phone ?? ""}
        placeholder="55 11 99999-9999" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
        <span className="mt-1 block text-xs text-slate-500">Inclua país e DDD.</span></label>
      <label className="text-sm">E-mail de contato (opcional)<input name="email" type="email" maxLength={254} disabled={pending} defaultValue={editing?.email ?? ""}
        className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" /></label>
      <label className="text-sm sm:col-span-3">Máximo de acompanhantes deste convidado
        <input name="maxCompanions" type="number" min={0} max={2147483647} step={1} disabled={pending}
          defaultValue={editing?.max_companions ?? ""} placeholder={`Padrão do evento: ${getRsvpCompanionLimit(eventMaxCompanions)}`}
          className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 sm:max-w-xs" />
        <span className="mt-1 block text-xs text-slate-500">Sem contar o próprio convidado. Deixe vazio para usar o padrão do evento ou informe 0 para um convite individual. O limite individual substitui o padrão.</span>
      </label>
      <div className="flex gap-3 sm:col-span-3">
        <button disabled={pending} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm text-white disabled:opacity-60">{editing ? "Salvar convidado" : "Cadastrar convidado"}</button>
        {editing ? <button type="button" disabled={pending} onClick={() => setEditing(null)} className="text-sm text-slate-600 underline">Cancelar edição</button> : null}
      </div>
    </form>
    {message ? <p role="status" className="mt-3 text-sm text-slate-700">{message}</p> : null}
    {generated ? <div className="mt-4 space-y-3 rounded-xl bg-emerald-50 p-4 text-sm">
      <label className="block">Link individual<input readOnly value={generated.url} onFocus={(e) => e.target.select()}
        className="mt-1 w-full rounded-lg border border-emerald-200 bg-white p-2" /></label>
      <label className="block">Código<input readOnly value={generated.code} onFocus={(e) => e.target.select()}
        className="mt-1 w-full rounded-lg border border-emerald-200 bg-white p-2" /></label>
      <label className="block">Mensagem para este convidado<textarea rows={5} maxLength={6000} value={generated.message}
        onChange={(e) => setGenerated({ ...generated, message: e.target.value })}
        className="mt-1 w-full resize-y rounded-lg border border-emerald-200 bg-white p-2" /></label>
      <p className="text-xs text-slate-600">Você pode ajustar esta mensagem antes de abrir o WhatsApp. Esta edição vale apenas para este envio; o link individual será incluído se necessário.</p>
      <div className="flex flex-wrap gap-4">
        <button type="button" onClick={() => { void navigator.clipboard.writeText(generated.url).then(() => setMessage("Link copiado."), () => setMessage("Selecione e copie o link acima.")); }} className="font-medium text-emerald-800 underline">Copiar link</button>
        {generated.phone ? <a href={createWhatsAppUrl(generated.phone, generated.message.includes(generated.url) ? generated.message : `${generated.message}\n\n${generated.url}`)!} target="_blank" rel="noopener noreferrer" className="font-medium text-emerald-800 underline">Abrir mensagem no WhatsApp</a> : null}
      </div>
    </div> : null}
    {deleting ? <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm">
      <p className="font-semibold text-red-800">Excluir {deleting.name}?</p>
      <p className="mt-2 text-red-700">O cadastro, o convite e a resposta de presença serão removidos. O link deixará de funcionar. As fotos já enviadas serão preservadas.</p>
      <div className="mt-3 flex gap-4">
        <button type="button" disabled={pending} onClick={() => void request("DELETE", { guestId: deleting.guest_id })}
          className="rounded-lg bg-red-700 px-3 py-2 text-white disabled:opacity-60">Confirmar exclusão</button>
        <button type="button" disabled={pending} onClick={() => setDeleting(null)} className="text-slate-700 underline">Cancelar</button>
      </div>
    </div> : null}
    <div className="mt-6 flex flex-wrap items-center gap-4">
      <p className="text-sm text-slate-600">{total} convidado(s) · {selected.length} selecionado(s)</p>
      <button type="button" disabled={pending || !selected.length} onClick={() => void exportSelected()} className="rounded-xl border border-emerald-700 px-3 py-2 text-sm text-emerald-700 disabled:opacity-40">Exportar selecionados para WhatsApp</button>
    </div>
    <p className="mt-2 text-xs text-slate-500">A exportação prepara as mensagens e links. Abrir o WhatsApp permite revisar e enviar cada mensagem.</p>
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Convidados e convites individuais</caption>
        <thead className="bg-slate-50 text-slate-600"><tr>
          <th scope="col" className="p-3"><input type="checkbox" aria-label="Selecionar convidados com WhatsApp e convite ativo nesta página" disabled={pending || !exportable.length}
            checked={exportable.length > 0 && exportable.every((guest) => selected.includes(guest.guest_id))}
            onChange={(e) => setSelected(e.target.checked ? exportable.map((guest) => guest.guest_id) : [])} /></th>
          <th scope="col" className="p-3">Convidado</th><th scope="col" className="p-3">Contato</th><th scope="col" className="p-3">Limite de acompanhantes</th><th scope="col" className="p-3">Presença</th><th scope="col" className="p-3">Convite</th><th scope="col" className="p-3">Ações</th>
        </tr></thead>
        <tbody>{invitations.map((guest) => <tr key={guest.guest_id} className="border-t border-slate-100">
          <td className="p-3"><input type="checkbox" aria-label={`Selecionar ${guest.name}`} checked={selected.includes(guest.guest_id)}
            disabled={pending || !guest.phone || !guest.hasRecoverableLink || Boolean(guest.invitation_revoked_at)}
            onChange={(e) => setSelected(e.target.checked ? [...selected, guest.guest_id] : selected.filter((id) => id !== guest.guest_id))} /></td>
          <td className="p-3 font-medium">{guest.name || "Convidado sem nome"}</td>
          <td className="p-3"><p>{guest.phone ?? "Sem WhatsApp"}</p><p className="text-xs text-slate-500">{guest.email}</p></td>
          <td className="p-3">{getRsvpCompanionLimit(eventMaxCompanions, guest.max_companions)}
            <p className="text-xs text-slate-500">{guest.max_companions === null ? "Padrão do evento" : "Individual"}</p></td>
          <td className="p-3">{guest.response ? guest.response.attending ? `Confirmada · ${guest.response.companions} acompanhante(s)` : "Não comparecerá" : "Pendente"}
            {guest.response?.companion_names.length ? <p className="mt-1 whitespace-pre-line text-xs text-slate-500">{guest.response.companion_names.join("\n")}</p> : null}</td>
          <td className="p-3">{guest.invitation_revoked_at ? "Revogado" : guest.hasRecoverableLink ? "Ativo" : "Precisa gerar código"}</td>
          <td className="p-3"><div className="flex min-w-40 flex-wrap gap-x-3 gap-y-2">
            <button disabled={pending} onClick={() => { setEditing(guest); setGenerated(null); }} className="text-slate-700 underline">Editar</button>
            {guest.hasRecoverableLink && !guest.invitation_revoked_at ? <button disabled={pending} onClick={() => void request("PATCH", { guestId: guest.guest_id, action: "retrieve" })} className="text-emerald-700 underline">Ver link e código</button> : null}
            <button disabled={pending} onClick={() => void request("PATCH", { guestId: guest.guest_id, action: "renew" })} className="text-emerald-700 underline">{guest.hasRecoverableLink ? "Substituir código" : "Gerar código"}</button>
            {!guest.invitation_revoked_at ? <button disabled={pending} onClick={() => void request("PATCH", { guestId: guest.guest_id, action: "revoke" })} className="text-red-700 underline">Revogar</button> : null}
            <button type="button" disabled={pending} onClick={() => { setDeleting(guest); setGenerated(null); }} className="text-red-700 underline">Excluir convidado</button>
          </div></td>
        </tr>)}</tbody>
      </table>
    </div>
    {total === 0 ? <p className="mt-4 text-sm text-slate-500">Nenhum convidado cadastrado.</p> : null}
    <nav aria-label="Páginas de convidados" className="mt-4 flex gap-4 text-sm">
      {page > 1 ? <a href={`?invitationPage=${page - 1}`} className="text-emerald-700 underline">Anteriores</a> : null}
      {page * 50 < total ? <a href={`?invitationPage=${page + 1}`} className="text-emerald-700 underline">Próximos</a> : null}
    </nav>
  </section>;
}

function responseError(body: unknown) {
  const result = apiErrorResponseSchema.safeParse(body);
  return new Error(result.success ? result.data.error.message : "Não foi possível atualizar o convidado.");
}
