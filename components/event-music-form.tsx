"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { cleanupMusicUpload, persistEventMusic, uploadEventMusic } from "@/lib/events/event-music-browser-service";
import { validateMusicFile, type UploadedMusic } from "@/lib/events/event-music-contract";

export function EventMusicForm({ eventId, initialMusicUrl, hasMusic }: {
  eventId: string;
  initialMusicUrl: string | null;
  hasMusic: boolean;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const previewUrl = useRef<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removeMusic, setRemoveMusic] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
  }, []);

  function selectFile(selected: File | null) {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = selected ? URL.createObjectURL(selected) : null;
    setPreview(previewUrl.current);
    setFile(selected);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    let asset: UploadedMusic | null = null;
    try {
      if (file) asset = await uploadEventMusic(eventId, file);
      await persistEventMusic(eventId, asset, removeMusic);
      setMessage(removeMusic ? "Música removida." : "Música salva.");
      selectFile(null);
      setRemoveMusic(false);
      if (fileInput.current) fileInput.current.value = "";
      router.refresh();
    } catch (failure) {
      if (asset) await cleanupMusicUpload(eventId, asset);
      setError(failure instanceof Error ? failure.message : "Não foi possível salvar a música.");
    } finally { setBusy(false); }
  }

  const source = removeMusic ? null : file ? preview : initialMusicUrl;
  return (
    <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-8">
      <h2 className="text-xl font-semibold">Música de fundo</h2>
      <p className="mt-2 text-sm text-slate-600">Escolha uma música para tocar automaticamente no convite, save the date e galeria. Os convidados podem pausar e ajustar a reprodução.</p>
      <form onSubmit={submit} className="mt-5 space-y-4">
        <div>
          <label htmlFor="event-music-file" className="block text-sm font-medium">Arquivo de música (MP3)</label>
          <input id="event-music-file" ref={fileInput} type="file" accept=".mp3,audio/mpeg,audio/mp3" disabled={busy}
            aria-describedby="event-music-help"
            className="mt-2 block w-full rounded-xl border border-slate-300 p-3 text-sm"
            onChange={(event) => {
              setError(null); setMessage(null);
              const selected = event.target.files?.[0] ?? null;
              if (selected && !validateMusicFile(selected).success) {
                setError("Envie um arquivo MP3 de até 15 MB.");
                event.target.value = ""; selectFile(null); return;
              }
              selectFile(selected);
              if (selected) setRemoveMusic(false);
            }} />
          <p id="event-music-help" className="mt-2 text-xs text-slate-500">Até 15 MB. Se o navegador bloquear o início automático, a música começa ao tocar na página ou em reproduzir.</p>
        </div>
        {source ? <audio key={source} src={source} controls preload="none" aria-label="Prévia da música do evento" className="w-full" /> : null}
        {hasMusic ? <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={removeMusic} disabled={busy} onChange={(event) => {
            setRemoveMusic(event.target.checked); setMessage(null);
            if (event.target.checked) { selectFile(null); if (fileInput.current) fileInput.current.value = ""; }
          }} />Remover música atual
        </label> : null}
        {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
        {message ? <p role="status" className="text-sm text-emerald-700">{message}</p> : null}
        <button type="submit" disabled={busy || (!file && !removeMusic)} className="rounded-xl bg-emerald-700 px-4 py-3 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50">
          {busy ? "Salvando música…" : "Salvar música"}
        </button>
      </form>
    </section>
  );
}
