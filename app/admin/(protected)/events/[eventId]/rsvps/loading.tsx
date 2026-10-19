export default function AdminRsvpsLoading() {
  return (
    <main aria-busy="true" className="mx-auto max-w-6xl px-4 py-9 sm:px-6">
      <p role="status" className="text-sm text-slate-500">Carregando confirmações de presença…</p>
      <div aria-hidden="true" className="mt-7 space-y-6 motion-safe:animate-pulse">
        <div className="h-9 w-2/3 max-w-md rounded-lg bg-slate-200" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((index) => <div key={index} className="h-36 rounded-2xl border border-slate-200 bg-white p-5">
            <div className="h-3 w-3/4 rounded bg-slate-100" /><div className="mt-5 h-8 w-12 rounded bg-slate-100" />
          </div>)}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="h-5 w-48 rounded bg-slate-100" />
          <div className="mt-6 h-11 rounded-xl bg-slate-100" />
          {[0, 1, 2].map((index) => <div key={index} className="mt-5 h-16 rounded-xl bg-slate-50" />)}
        </div>
      </div>
    </main>
  );
}
