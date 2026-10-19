export function RsvpStatusBadge({ attending }: { attending: boolean | null }) {
  const label = attending === null ? "Aguardando resposta" : attending ? "Confirmada" : "Não comparecerá";
  const color = attending === null ? "bg-amber-50 text-amber-800 ring-amber-200"
    : attending ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-slate-100 text-slate-700 ring-slate-200";
  return (
    <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${color}`}>
      <svg aria-hidden="true" className="size-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {attending === null ? <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></> : attending ? <path d="m5 12 4 4L19 6" /> : <path d="m7 7 10 10M17 7 7 17" />}
      </svg>
      {label}
    </span>
  );
}
