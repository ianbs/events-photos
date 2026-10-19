import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/reset-password-form";

export const metadata: Metadata = {
  title: "Definir nova senha",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-100 px-4 py-10">
      <section className="w-full max-w-md rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">Sua conta</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Definir nova senha</h1>
        <p className="mt-3 text-sm text-slate-600">Escolha uma senha para acessar a administração dos eventos.</p>
        <ResetPasswordForm />
      </section>
    </main>
  );
}
