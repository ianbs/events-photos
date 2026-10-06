"use client";

import { useEffect, useId, useState } from "react";
import { getEventCountdown } from "@/lib/events/event-countdown";

export function EventCountdown({ eventDate }: {
  eventDate: string;
}) {
  const headingId = useId();
  const [now, setNow] = useState<number | null>(null);
  const countdown = now === null ? null : getEventCountdown(eventDate, now);
  const upcoming = !countdown || countdown.status === "upcoming";

  useEffect(() => {
    const update = () => setNow(Date.now());
    const initialUpdate = window.setTimeout(update, 0);
    const interval = window.setInterval(update, 1000);
    // Recalculate from the clock after returning to a backgrounded tab.
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearTimeout(initialUpdate);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  const units = [
    { label: "Dias", value: countdown?.days },
    { label: "Horas", value: countdown?.hours },
    { label: "Minutos", value: countdown?.minutes },
    { label: "Segundos", value: countdown?.seconds },
  ];

  return (
    <section aria-labelledby={headingId} className="mt-7 w-full rounded-2xl bg-white p-5 text-center shadow-sm ring-1 ring-slate-200 sm:p-7">
      <h2 id={headingId} className="text-lg font-semibold text-[var(--event-primary)]">
        {upcoming ? "Contagem regressiva" : countdown?.status === "today" ? "É hoje!" : "Este evento já aconteceu"}
      </h2>
      {upcoming ? (
        <>
          <dl role="timer" aria-label="Tempo até o dia do evento" aria-live="off" className="mt-4 grid grid-cols-4 gap-2 sm:gap-4">
            {units.map(({ label, value }) => (
              <div key={label} className="flex min-w-0 flex-col rounded-xl bg-slate-50 px-1 py-4 sm:px-3">
                <dt className="order-2 mt-1 text-xs text-slate-600 sm:text-sm">{label}</dt>
                <dd className="text-2xl font-semibold tabular-nums text-[var(--event-primary)] sm:text-4xl">
                  {value === undefined ? "—" : String(value).padStart(2, "0")}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-slate-500">Até o início do dia do evento, no horário de Brasília.</p>
        </>
      ) : (
        <p className="mt-2 text-sm text-slate-600">
          {countdown?.status === "today" ? "Chegou o dia de compartilhar este momento!" : "Obrigado por fazer parte deste momento."}
        </p>
      )}
    </section>
  );
}
