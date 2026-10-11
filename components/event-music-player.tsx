"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function EventMusicPlayer({ src, eventName }: { src: string; eventName: string }) {
  const [failed, setFailed] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const initializeVolume = useCallback((audio: HTMLAudioElement | null) => {
    audioRef.current = audio;
    if (audio) audio.volume = 0.35;
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    let disposed = false;

    function stopRetrying() {
      document.removeEventListener("click", retryPlayback, true);
      document.removeEventListener("touchend", retryPlayback, true);
      document.removeEventListener("keydown", retryPlayback, true);
    }

    async function startPlayback() {
      try {
        await audio!.play();
        if (disposed) return;
        setBlocked(false);
        setFailed(false);
        stopRetrying();
      } catch (error) {
        if (disposed) return;
        const name = error instanceof Error ? error.name : "";
        if (name === "NotAllowedError") {
          setBlocked(true);
          // Retry within a real user gesture when audible autoplay is blocked.
          document.addEventListener("click", retryPlayback, true);
          document.addEventListener("touchend", retryPlayback, true);
          document.addEventListener("keydown", retryPlayback, true);
        } else if (name !== "AbortError") {
          setFailed(true);
          stopRetrying();
        }
      }
    }

    function retryPlayback(event: Event) {
      // Let the native controls handle their own play/pause gestures.
      if (event.target !== audio) void startPlayback();
    }

    // Native playback also stops retries, so a deliberate pause stays paused.
    audio.addEventListener("playing", stopRetrying);
    void startPlayback();
    return () => {
      disposed = true;
      stopRetrying();
      audio.removeEventListener("playing", stopRetrying);
      audio.pause();
    };
  }, [src]);

  return (
    <div className="mt-5 w-full max-w-sm rounded-2xl bg-white/80 p-4 text-center ring-1 ring-slate-200">
      <p className="text-sm font-medium text-[var(--event-primary)]">Música do evento</p>
      <p className="mt-1 text-xs text-slate-500">
        {blocked ? "Toque na página ou em reproduzir para ouvir a música." : "Reprodução automática. Você pode pausar a qualquer momento."}
      </p>
      <audio
        key={src}
        ref={initializeVolume}
        src={src}
        controls
        loop
        autoPlay
        preload="auto"
        aria-label={`Música de fundo de ${eventName}`}
        onError={() => setFailed(true)}
        onPlaying={() => { setFailed(false); setBlocked(false); }}
        className="mt-3 w-full"
      />
      {failed ? <p role="status" className="mt-2 text-xs text-slate-600">Não foi possível reproduzir a música. Atualize a página e tente novamente.</p> : null}
    </div>
  );
}
