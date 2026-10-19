"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { deleteUserAction, createUserAction, setUserPasswordAction, sendPasswordEmailAction, updateUserAccessAction, type UserFormState } from "@/app/admin/(protected)/users/actions";

const initialState: UserFormState = { error: null, success: null };
const inputClass = "mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-100";
const buttonClass = "min-h-11 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50";

function Feedback({ state }: { state: UserFormState }) {
  if (state.error) return <p role="alert" className="mt-3 text-sm text-red-700">{state.error}</p>;
  if (state.success) return <p role="status" className="mt-3 text-sm text-emerald-800">{state.success}</p>;
  return null;
}

function RoleSelect({ role = "admin", disabled = false, id }: { role?: string; disabled?: boolean; id: string }) {
  return (
    <label htmlFor={id} className="block text-sm font-medium">
      Perfil
      <select id={id} name="role" defaultValue={role} disabled={disabled} className={inputClass}>
        <option value="admin">Administrador</option>
        <option value="super_admin">Superadministrador</option>
      </select>
    </label>
  );
}


function ManualPasswordFields() {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const fieldsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const form = fieldsRef.current?.closest("form");
    const hidePasswords = () => setVisible(false);
    form?.addEventListener("reset", hidePasswords);
    return () => form?.removeEventListener("reset", hidePasswords);
  }, []);
  return (
    <div ref={fieldsRef} className="grid gap-4 sm:grid-cols-2">
      <label htmlFor={`password-${id}`} className="block text-sm font-medium">
        Nova senha
        <input id={`password-${id}`} name="password" type={visible ? "text" : "password"}
          required minLength={12} maxLength={128} autoComplete="new-password"
          aria-describedby={`password-hint-${id}`} className={inputClass} />
      </label>
      <label htmlFor={`confirmation-${id}`} className="block text-sm font-medium">
        Confirmar nova senha
        <input id={`confirmation-${id}`} name="confirmation" type={visible ? "text" : "password"}
          required minLength={12} maxLength={128} autoComplete="new-password" className={inputClass} />
      </label>
      <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
        <p id={`password-hint-${id}`} className="text-xs text-slate-500">Use de 12 a 128 caracteres. Combine letras, números e símbolos.</p>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-xs font-medium text-slate-600">
          <input type="checkbox" checked={visible} onChange={(event) => setVisible(event.target.checked)} className="size-4 accent-emerald-700" />
          Mostrar senhas
        </label>
      </div>
    </div>
  );
}
export function CreateAdminUserForm() {
  const [state, action, pending] = useActionState(createUserAction, initialState);
  const [passwordMode, setPasswordMode] = useState<"manual" | "email">("manual");
  return (
    <form action={action} onReset={() => setPasswordMode("manual")} className="mt-5">
      <fieldset disabled={pending} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            E-mail
            <input type="email" name="email" required maxLength={254} autoComplete="off" className={inputClass} />
          </label>
          <RoleSelect id="new-user-role" />
        </div>
        <label htmlFor="new-user-password-mode" className="block text-sm font-medium">
          Como definir a senha
          <select id="new-user-password-mode" name="passwordMode" value={passwordMode}
            onChange={(event) => setPasswordMode(event.target.value as "manual" | "email")} className={inputClass}>
            <option value="manual">Definir agora no painel, sem e-mail</option>
            <option value="email">Enviar link por e-mail para o usuário definir</option>
          </select>
        </label>
        {passwordMode === "manual" ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <ManualPasswordFields />
          <p className="mt-2 text-xs text-slate-500">O usuário poderá entrar com esta senha assim que a conta for criada.</p>
        </div> : <p className="text-sm text-slate-500">O usuário receberá um link para escolher a própria senha. O envio depende da configuração SMTP.</p>}
        <button type="submit" className={buttonClass}>{pending ? "Criando…" : passwordMode === "manual" ? "Criar usuário com senha" : "Criar usuário e enviar link"}</button>
      </fieldset>
      <Feedback state={state} />
    </form>
  );
}

export function AdminUserAccessForm({ userId, role, isActive, isSelf }: {
  userId: string; role: "admin" | "super_admin"; isActive: boolean; isSelf: boolean;
}) {
  const [state, action, pending] = useActionState(updateUserAccessAction, initialState);
  return (
    <form action={action}>
      <input type="hidden" name="userId" value={userId} />
      <fieldset disabled={pending || isSelf} className="flex flex-wrap items-end gap-4">
        <div className="min-w-48 flex-1"><RoleSelect id={`role-${userId}`} role={role} /></div>
        <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
          <input type="checkbox" name="isActive" defaultChecked={isActive} className="size-4 accent-emerald-700" />
          Acesso ativo
        </label>
        <button type="submit" className={buttonClass}>{pending ? "Salvando…" : "Salvar acesso"}</button>
      </fieldset>
      {isSelf ? <p className="mt-3 text-xs text-slate-500">Esta é sua conta. Outro superadministrador pode alterar seu acesso.</p> : null}
      <Feedback state={state} />
    </form>
  );
}

export function AdminUserPasswordEmailForm({ userId, isActive }: { userId: string; isActive: boolean }) {
  const [state, action, pending] = useActionState(sendPasswordEmailAction, initialState);
  return (
    <form action={action} className="mt-4 border-t border-slate-100 pt-4">
      <input type="hidden" name="userId" value={userId} />
      <button type="submit" disabled={pending || !isActive} className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
        {pending ? "Enviando…" : "Enviar link para definir senha"}
      </button>
      <p className="mt-2 text-xs text-slate-500">{isActive ? "O link será enviado ao e-mail desta conta e permite definir uma nova senha." : "Ative o acesso para enviar o link."}</p>
      <Feedback state={state} />
    </form>
  );
}

export function DeleteAdminUserForm({ userId, email, isSelf }: { userId: string; email: string | null; isSelf: boolean }) {
  const [state, action, pending] = useActionState(deleteUserAction, initialState);
  const [confirmation, setConfirmation] = useState("");
  const expected = email || userId;
  const matches = confirmation.trim().toLowerCase() === expected.toLowerCase();

  if (isSelf) {
    return <p className="mt-4 border-t border-slate-100 pt-4 text-xs text-slate-500">Você não pode excluir a própria conta.</p>;
  }

  return (
    <details className="mt-4 border-t border-slate-100 pt-4">
      <summary className="w-fit cursor-pointer rounded-lg px-1 py-2 text-sm font-semibold text-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700">
        Excluir usuário
      </summary>
      <form action={action} className="mt-3 rounded-xl border border-red-200 bg-red-50 p-4">
        <input type="hidden" name="userId" value={userId} />
        <p className="text-sm font-semibold text-red-900">Excluir esta conta definitivamente?</p>
        <p id={`delete-warning-${userId}`} className="mt-2 text-sm text-red-900">
          A conta e suas permissões serão removidas, e o usuário perderá acesso. Esta ação não pode ser desfeita. Os eventos, fotos e convidados serão mantidos.
        </p>
        <fieldset disabled={pending} className="mt-4">
          <label htmlFor={`delete-confirmation-${userId}`} className="block text-sm font-medium text-red-950">
            Digite {email ? "o e-mail" : "o identificador"} <span className="break-all font-semibold">{expected}</span> para confirmar
          </label>
          <input id={`delete-confirmation-${userId}`} name="confirmation" type={email ? "email" : "text"}
            value={confirmation} onChange={(event) => setConfirmation(event.target.value)}
            required maxLength={254} autoComplete="off" spellCheck={false} autoCapitalize="none"
            aria-describedby={`delete-warning-${userId}`} className={inputClass} />
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="submit" disabled={pending || !matches}
              className="min-h-11 rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-not-allowed disabled:opacity-50">
              {pending ? "Excluindo…" : "Excluir definitivamente"}
            </button>
            <button type="button" className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={(event) => {
                setConfirmation("");
                event.currentTarget.closest("details")?.removeAttribute("open");
              }}>Cancelar</button>
          </div>
        </fieldset>
        <Feedback state={state} />
      </form>
    </details>
  );
}

export function AdminUserManualPasswordForm({ userId, isActive }: { userId: string; isActive: boolean }) {
  const [state, action, pending] = useActionState(setUserPasswordAction, initialState);
  return (
    <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-1">
      <summary className="w-fit cursor-pointer rounded-lg py-3 text-sm font-semibold text-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">
        Definir senha no painel
      </summary>
      <form action={action} className="pb-4">
        <input type="hidden" name="userId" value={userId} />
        <p className="mb-4 text-sm text-slate-600">Defina uma nova senha para esta conta, sem enviar um link por e-mail.</p>
        <fieldset disabled={pending}>
          <ManualPasswordFields />
          {!isActive ? <p className="mt-3 text-xs text-amber-800">A conta continuará sem acesso ao painel até você ativá-la.</p> : null}
          <button type="submit" className={`mt-4 ${buttonClass}`}>{pending ? "Salvando…" : "Salvar nova senha"}</button>
        </fieldset>
        <Feedback state={state} />
      </form>
    </details>
  );
}
