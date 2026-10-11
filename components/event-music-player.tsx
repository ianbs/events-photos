"use client";

import { useCallback, useState } from "react";

export function EventMusicPlayer({ src, eventName }: { src: string; eventName: string }) {
  const [failed, setFailed] = useState(false);
  const initializeVolume = useCallback((audio: HTMLAudioElement | null) => {
    if (audio) audio.volume = 0.35;
  }, []);

  return (
    <div className="mt-5 w-full max-w-sm rounded-2xl bg-white/80 p-4 text-center ring-1 ring-slate-200">
      <p className="text-sm font-medium text-[var(--event-primary)]">Música do evento</p>
      <p className="mt-1 text-xs text-slate-500">Toque para ouvir enquanto navega.</p>
      <audio
        key={src}
        ref={initializeVolume}
        src={src}
        controls
        loop
        preload="none"
        aria-label={`Música de fundo de ${eventName}`}
        onError={() => setFailed(true)}
        onPlaying={() => setFailed(false)}
        className="mt-3 w-full"
      />
      {failed ? <p role="status" className="mt-2 text-xs text-slate-600">Não foi possível reproduzir a música. Atualize a página e tente novamente.</p> : null}
    </div>
  );
}
