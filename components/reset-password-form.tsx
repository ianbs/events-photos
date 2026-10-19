"use client";

import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { newPasswordSchema, readRecoveryCredentials } from "@/lib/auth/password-recovery";
import { getPublicEnvironment } from "@/lib/config/public-environment";
import type { Database } from "@/types/database";

function createRecoveryClient() {
  const environment = getPublicEnvironment();
  // The email is requested by an administrator, and can be opened on another
  // device. Its default Supabase link carries an implicit session in the fragment.
  return createBrowserClient<Database>(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { isSingleton: false, auth: { flowType: "implicit", detectSessionInUrl: false } },
  );
}

export function ResetPasswordForm() {
  const clientRef = useRef<ReturnType<typeof createRecoveryClient> | null>(null);
  const initialization = useRef<Promise<string> | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "invalid" | "success">("loading");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let current = true;
    if (!initialization.current) {
      initialization.current = (async () => {
        const credentials = readRecoveryCredentials(new URL(window.location.href));
        // Never leave credentials in history or pass them to application requests.
        window.history.replaceState(window.history.state, "", "/admin/reset-password");
        if (credentials.kind === "invalid") throw new Error("invalid_link");
        const client = createRecoveryClient();
        clientRef.current = client;
        if (credentials.kind === "session") {
          const { error } = await client.auth.setSession({ access_token: credentials.accessToken, refresh_token: credentials.refreshToken });
          if (error) throw new Error("invalid_link");
        } else if (credentials.kind === "token") {
          const { error } = await client.auth.verifyOtp({ token_hash: credentials.tokenHash, type: credentials.type });
          if (error) throw new Error("invalid_link");
        }
        const { data: { user }, error } = await client.auth.getUser();
        if (error || !user?.email) throw new Error("invalid_link");
        return user.email;
      })();
    }
    initialization.current.then((value) => {
      if (current) { setEmail(value); setState("ready"); }
    }).catch(() => { if (current) setState("invalid"); });
    return () => { current = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !clientRef.current) return;
    const data = new FormData(event.currentTarget);
    const parsed = newPasswordSchema.safeParse({ password: data.get("password"), confirmation: data.get("confirmation") });
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    setError("");
    setPending(true);
    try {
      const { error } = await clientRef.current.auth.updateUser({ password: parsed.data.password });
      if (error) {
        if (error.code === "same_password") { setError("Escolha uma senha diferente da senha atual."); return; }
        if (error.code === "weak_password") { setError("Escolha uma senha mais forte, com letras, números e símbolos."); return; }
        if (error.status === 401 || error.code === "session_not_found" || error.code === "refresh_token_not_found") {
          setState("invalid"); return;
        }
        setError("Não foi possível salvar a senha. Tente novamente ou solicite outro link.");
        return;
      }
      // Password recovery should end other refresh sessions as well.
      await clientRef.current.auth.signOut({ scope: "global" }).catch(() => undefined);
      setState("success");
    } catch {
      setError("A conexão foi interrompida. Tente novamente.");
    } finally { setPending(false); }
  }

  if (state === "loading") return <p role="status" className="mt-6 text-sm text-slate-600">Verificando seu link…</p>;
  if (state === "invalid") return (
    <div className="mt-6">
      <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm leading-relaxed text-red-800">Este link é inválido, já foi usado ou expirou. Solicite um novo link ao superadministrador.</p>
      <Link href="/admin/login" className="mt-5 inline-flex min-h-11 items-center text-sm font-medium text-emerald-800 underline">Voltar para entrar</Link>
    </div>
  );
  if (state === "success") return (
    <div className="mt-6">
      <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">Senha atualizada. Agora entre com sua nova senha.</p>
      <Link href="/admin/login" className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white hover:bg-emerald-800">Entrar</Link>
    </div>
  );
  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <p className="text-sm text-slate-600">Conta: <strong className="break-all text-slate-900">{email}</strong></p>
      <fieldset disabled={pending} className="space-y-4">
        <label className="block text-sm font-medium">Nova senha
          <input type="password" name="password" required minLength={12} maxLength={128} autoComplete="new-password" aria-describedby="password-requirements" className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
        </label>
        <p id="password-requirements" className="text-xs text-slate-500">Use de 12 a 128 caracteres. Combine letras, números e símbolos.</p>
        <label className="block text-sm font-medium">Confirmar nova senha
          <input type="password" name="confirmation" required minLength={12} maxLength={128} autoComplete="new-password" className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
        </label>
        {error ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
        <button type="submit" className="min-h-12 w-full rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">{pending ? "Salvando…" : "Salvar nova senha"}</button>
      </fieldset>
    </form>
  );
}
