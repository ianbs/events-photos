import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-dvh flex-col bg-[radial-gradient(circle_at_top_left,_#fff_0,_#f8fafc_42%,_#eef2ff_100%)] px-6 py-8 sm:px-10 sm:py-10">
      <header className="mx-auto flex w-full max-w-5xl items-center gap-3">
        <span
          aria-hidden="true"
          className="grid size-10 place-items-center rounded-2xl bg-slate-950 text-base font-semibold text-white shadow-sm"
        >
          G
        </span>
        <span className="font-semibold tracking-tight text-slate-900">
          Galeria do evento
        </span>
      </header>

      <section className="mx-auto flex w-full max-w-5xl flex-1 items-center py-16 sm:py-24">
        <div className="max-w-2xl">
          <p className="mb-5 inline-flex rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-sm font-medium text-slate-600 shadow-sm backdrop-blur">
            Galeria colaborativa e privada
          </p>
          <h1 className="text-4xl font-semibold leading-tight tracking-[-0.04em] text-slate-950 sm:text-6xl">
            As fotos do seu evento, reunidas em um só lugar.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
            Para enviar e acompanhar suas fotos, acesse a galeria pelo link ou
            QR Code compartilhado pelo organizador do evento.
          </p>

          <div className="mt-10 flex max-w-xl items-start gap-4 rounded-3xl border border-white/80 bg-white/70 p-5 shadow-[0_18px_50px_-28px_rgba(15,23,42,0.35)] backdrop-blur sm:p-6">
            <span
              aria-hidden="true"
              className="grid size-10 shrink-0 place-items-center rounded-full bg-indigo-50 text-sm font-semibold text-indigo-700"
            >
              01
            </span>
            <div>
              <h2 className="font-semibold text-slate-900">
                Abra o convite do evento
              </h2>
              <p className="mt-1 leading-6 text-slate-600">
                Toque no link recebido ou aponte a câmera do celular para o QR
                Code. Não é necessário criar uma conta.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="mx-auto flex w-full max-w-5xl items-center justify-between border-t border-slate-200/80 pt-6 text-sm text-slate-500">
        <span>Uma lembrança feita por todos.</span>
        <Link
          href="/admin/login"
          className="rounded-lg px-2 py-1 transition-colors hover:bg-white hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-900"
        >
          Administração
        </Link>
      </footer>
    </main>
  );
}
