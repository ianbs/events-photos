import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <section className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          Galeria do evento
        </h1>
        <p className="mt-3 text-slate-600">
          Aplicação configurada com sucesso.
        </p>
        <Link
          href="/e/batizado-teste"
          className="mt-6 inline-flex min-h-12 items-center rounded-xl bg-slate-900 px-5 py-3 font-medium text-white"
        >
          Abrir evento de teste
        </Link>
        <Link
          href="/admin/login"
          className="mt-3 block text-sm text-slate-600 underline"
        >
          Administração
        </Link>
      </section>
    </main>
  );
}
