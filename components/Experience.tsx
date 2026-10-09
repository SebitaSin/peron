"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { PublicCharacter } from "@/characters/types";
import type { SessionState } from "@/lib/engine/state";
import type { BasisItem } from "@/lib/engine/turn";
import { BrowserVoiceProvider, type VoiceProvider } from "@/lib/voice/provider";
import Portrait from "./Portrait";
import SourcesSheet from "./SourcesSheet";

interface Msg {
  id: string;
  role: "user" | "assistant";
  content: string;
  basis?: BasisItem[];
}
interface Saved {
  phase: "cover" | "chat";
  messages: Msg[];
  state: SessionState | null;
}

let voiceSingleton: VoiceProvider | null = null;
const getVoice = (): VoiceProvider => (voiceSingleton ??= new BrowserVoiceProvider());
const noopSubscribe = () => () => {};

function loadSaved(key: string): Saved | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const s = JSON.parse(raw) as Saved;
    return s && Array.isArray(s.messages) ? s : null;
  } catch {
    return null;
  }
}

const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random()).slice(2));

const ERRORS: Record<string, string> = {
  not_configured: "La conversación todavía no está disponible: el servicio de IA no está configurado en este servidor.",
  rate_limited: "Demasiados mensajes seguidos. Esperá unos minutos y seguimos.",
  upstream: "Hubo un problema al procesar la respuesta. Probá de nuevo en un momento.",
  too_large: "La conversación se hizo demasiado larga. Reiniciala para empezar de nuevo.",
  not_found: "Este personaje no está disponible.",
  network: "No hay conexión con el servidor. Revisá tu red y reintentá.",
};

export default function Experience({ character, portrait }: { character: PublicCharacter; portrait: string | null }) {
  const { profile, slug } = character;
  const storageKey = `hv:${slug}:v1`;

  // La portada se renderiza vacía hasta hidratar: así leer sessionStorage no genera diferencias con el HTML del servidor.
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const [saved] = useState<Saved | null>(() => (typeof window === "undefined" ? null : loadSaved(storageKey)));

  const [phase, setPhase] = useState<"cover" | "chat">(saved?.phase === "chat" ? "chat" : "cover");
  const [messages, setMessages] = useState<Msg[]>(saved?.messages ?? []);
  const [state, setState] = useState<SessionState | null>(saved?.state ?? null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Msg | null>(null);
  const [menu, setMenu] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [speakerOn, setSpeakerOn] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");

  const interrupted = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const caps = hydrated
    ? { stt: getVoice().sttSupported(), tts: getVoice().ttsSupported() }
    : { stt: false, tts: false };

  useEffect(() => () => getVoice().stopSpeaking(), []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({ phase, messages, state } satisfies Saved));
    } catch {
      /* ignorar */
    }
  }, [hydrated, phase, messages, state, storageKey]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading, interim]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  // Errores del cliente (sin contenido de conversación).
  useEffect(() => {
    const beacon = (where: string, msg: string) => {
      try {
        navigator.sendBeacon?.("/api/log", JSON.stringify({ where, msg: String(msg).slice(0, 200) }));
      } catch {
        /* ignorar */
      }
    };
    const onErr = (e: ErrorEvent) => beacon("window.error", e.message);
    const onRej = (e: PromiseRejectionEvent) => beacon("unhandledrejection", String(e.reason));
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onRej);
    return () => {
      window.removeEventListener("error", onErr);
      window.removeEventListener("unhandledrejection", onRej);
    };
  }, []);

  const start = useCallback(() => {
    setMessages((m) => (m.length ? m : [{ id: uid(), role: "assistant", content: profile.opening_message }]));
    setPhase("chat");
    setTimeout(() => inputRef.current?.focus(), 250);
  }, [profile.opening_message]);

  const stopSpeaking = useCallback(() => {
    getVoice().stopSpeaking();
    setSpeaking(false);
  }, []);

  const send = useCallback(
    async (raw: string, viaVoice = false) => {
      const text = raw.trim();
      if (!text || loading) return;
      if (getVoice().isSpeaking()) {
        interrupted.current = true;
        stopSpeaking();
      }
      setError(null);
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const userMsg: Msg = { id: uid(), role: "user", content: text };
      setMessages((m) => [...m, userMsg]);
      setInput("");
      setLoading(true);
      const wasInterrupted = interrupted.current;
      interrupted.current = false;
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ character: slug, state, history, message: text, interrupted: wasInterrupted }),
        });
        const data = (await res.json().catch(() => ({}))) as { reply?: string; state?: SessionState; basis?: BasisItem[]; error?: string };
        if (!res.ok || !data.reply) {
          setMessages((m) => m.filter((x) => x.id !== userMsg.id));
          setInput(text);
          setError(ERRORS[data.error ?? "upstream"] ?? ERRORS.upstream);
          return;
        }
        const reply: Msg = { id: uid(), role: "assistant", content: data.reply, basis: data.basis ?? [] };
        setMessages((m) => [...m, reply]);
        if (data.state) setState(data.state);
        if ((speakerOn || viaVoice) && getVoice().ttsSupported()) {
          getVoice().speak(data.reply, { onStart: () => setSpeaking(true), onEnd: () => setSpeaking(false) });
        }
      } catch {
        setMessages((m) => m.filter((x) => x.id !== userMsg.id));
        setInput(text);
        setError(ERRORS.network);
      } finally {
        setLoading(false);
      }
    },
    [loading, messages, state, slug, speakerOn, stopSpeaking],
  );

  const toggleMic = useCallback(() => {
    const v = getVoice();
    if (listening) {
      v.stopListening();
      return;
    }
    if (v.isSpeaking()) {
      interrupted.current = true;
      stopSpeaking();
    }
    setError(null);
    setListening(true);
    setInterim("");
    v.startListening({
      lang: "es-AR",
      onInterim: setInterim,
      onFinal: (t) => {
        setSpeakerOn(true);
        void send(t, true);
      },
      onEnd: () => {
        setListening(false);
        setInterim("");
      },
      onError: (code) => {
        setListening(false);
        setInterim("");
        if (code === "not-allowed" || code === "service-not-allowed") setError("Para hablar necesito permiso para usar el micrófono.");
        else if (code === "unsupported") setError("Tu navegador no permite dictado por voz. Escribí tu mensaje.");
        else if (code !== "no-speech" && code !== "aborted") setError("No pude escucharte bien. Probá de nuevo.");
      },
    });
  }, [listening, send, stopSpeaking]);

  const toggleSpeaker = () => {
    if (speakerOn) stopSpeaking();
    setSpeakerOn((s) => !s);
  };

  const share = async () => {
    const url = `${window.location.origin}/p/${slug}`;
    const data = { title: profile.og_title, text: profile.og_description, url };
    try {
      if (navigator.share) {
        await navigator.share(data);
        return;
      }
      await navigator.clipboard.writeText(url);
      setToast("Enlace copiado");
    } catch {
      /* cancelado por el usuario */
    }
  };

  const restart = () => {
    stopSpeaking();
    getVoice().stopListening();
    setMenu(false);
    if (!window.confirm("¿Reiniciar la conversación? Perón no recordará nada de lo hablado.")) return;
    setMessages([{ id: uid(), role: "assistant", content: profile.opening_message }]);
    setState(null);
    setError(null);
    setInput("");
  };

  if (!hydrated) return <main className="h-dvh bg-night" aria-busy="true" />;

  /* ───────────────────────── PORTADA ───────────────────────── */
  if (phase === "cover") {
    return (
      <main className="relative flex h-dvh flex-col items-center justify-between overflow-hidden bg-night px-8 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(3rem,env(safe-area-inset-top))] text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(120% 70% at 50% 0%, rgba(183,154,99,0.16) 0%, rgba(13,24,41,0.0) 55%), linear-gradient(180deg,#0d1829 0%,#070d18 80%)" }}
        />
        <p className="rise relative z-10 text-[11px] uppercase tracking-[0.42em] text-brass">Historia Viva</p>

        <div className="relative z-10 flex flex-col items-center">
          <div className="rise" style={{ animationDelay: "0.1s" }}>
            <Portrait src={portrait} name={profile.name} size={168} />
          </div>
          <h1 className="rise mt-9 font-serif text-[2.1rem] font-normal leading-[1.1] tracking-wide text-ivory" style={{ animationDelay: "0.25s" }}>
            {profile.name.toUpperCase()}
          </h1>
          <div className="rise mt-4 h-px w-14 bg-brass/70" style={{ animationDelay: "0.35s" }} />
          <p className="rise mt-4 font-serif text-lg text-paper" style={{ animationDelay: "0.4s" }}>
            {profile.place}
            <br />
            {profile.date_label}
          </p>
          <p className="rise mt-7 max-w-[19rem] text-[13px] leading-relaxed text-mist" style={{ animationDelay: "0.55s" }}>
            {profile.tagline}
          </p>
        </div>

        <div className="relative z-10 flex w-full max-w-sm flex-col items-center">
          <button
            onClick={start}
            className="rise w-full rounded-sm border border-brass bg-brass/10 px-6 py-4 text-sm font-medium uppercase tracking-[0.28em] text-ivory transition hover:bg-brass/25 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass active:scale-[0.99]"
            style={{ animationDelay: "0.7s" }}
          >
            Hablar con {profile.short_name}
          </button>
          <p className="rise mt-5 max-w-[19rem] text-[11px] leading-snug text-mist/80" style={{ animationDelay: "0.85s" }}>
            {profile.disclaimer}
          </p>
          {character.status === "draft" && (
            <p className="mt-3 rounded-sm border border-oxide/50 px-3 py-1 text-[10px] uppercase tracking-widest text-oxide">Versión de prueba</p>
          )}
        </div>
      </main>
    );
  }

  /* ───────────────────────── CONVERSACIÓN ───────────────────────── */
  return (
    <main className="flex h-dvh flex-col bg-night">
      <header className="relative z-20 flex items-center gap-3 border-b border-ivory/10 bg-ink/95 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
        <Portrait src={portrait} name={profile.name} size={44} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-serif text-[17px] leading-tight text-ivory">{profile.name}</h1>
          <p className="text-[11.5px] leading-snug text-mist">
            {profile.place}
            <br />
            {state?.active_date && state.active_date !== profile.start_date ? formatDate(state.active_date) : profile.date_label}
          </p>
        </div>
        {caps.tts && (
          <button
            onClick={toggleSpeaker}
            aria-pressed={speakerOn}
            aria-label={speakerOn ? "Silenciar la voz de Perón" : "Activar la voz de Perón"}
            className={`grid h-10 w-10 place-items-center rounded-full border transition ${speakerOn ? "border-brass bg-brass/20 text-brass" : "border-ivory/15 text-mist hover:text-ivory"}`}
          >
            <IconSpeaker on={speakerOn} />
          </button>
        )}
        <button onClick={share} aria-label="Compartir enlace" className="grid h-10 w-10 place-items-center rounded-full border border-ivory/15 text-mist transition hover:text-ivory">
          <IconShare />
        </button>
        <div className="relative">
          <button onClick={() => setMenu((m) => !m)} aria-label="Más opciones" aria-expanded={menu} className="grid h-10 w-10 place-items-center rounded-full border border-ivory/15 text-mist transition hover:text-ivory">
            <IconDots />
          </button>
          {menu && (
            <>
              <button aria-label="Cerrar menú" className="fixed inset-0 z-30 cursor-default" onClick={() => setMenu(false)} />
              <div className="absolute right-0 top-12 z-40 w-56 rounded-md border border-ivory/10 bg-panel p-1 shadow-2xl">
                <button onClick={restart} className="w-full rounded px-3 py-3 text-left text-sm text-ivory hover:bg-ivory/5">
                  Reiniciar conversación
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      <p className="bg-ink/60 px-4 py-1.5 text-center text-[11px] text-mist/90">{profile.disclaimer}</p>

      <div className="scroll-soft flex-1 overflow-y-auto px-4 py-5" aria-live="polite">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          {messages.map((m) =>
            m.role === "assistant" ? (
              <div key={m.id} className="rise flex max-w-[88%] flex-col items-start">
                <div className="rounded-2xl rounded-tl-sm border border-brass/25 bg-paper px-4 py-3 font-serif text-[17px] leading-[1.55] text-night shadow-sm">
                  {m.content.split(/\n{2,}/).map((p, i) => (
                    <p key={i} className={i ? "mt-2" : ""}>
                      {p}
                    </p>
                  ))}
                </div>
                {m.basis !== undefined && (
                  <button onClick={() => setSheet(m)} className="mt-1.5 px-1 text-[12px] text-mist underline decoration-mist/40 underline-offset-4 hover:text-brass">
                    ¿En qué se basa esta respuesta?
                  </button>
                )}
              </div>
            ) : (
              <div key={m.id} className="rise flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-panel px-4 py-3 text-[16px] leading-[1.5] text-ivory">{m.content}</div>
              </div>
            ),
          )}
          {loading && (
            <div className="flex items-center gap-1.5 px-2 py-2" role="status" aria-label={`${profile.short_name} está pensando`}>
              {[0, 1, 2].map((i) => (
                <span key={i} className="dot h-1.5 w-1.5 rounded-full bg-brass" style={{ animationDelay: `${i * 0.16}s` }} />
              ))}
            </div>
          )}
          {interim && <div className="flex justify-end"><div className="max-w-[85%] rounded-2xl rounded-tr-sm border border-dashed border-ivory/20 px-4 py-3 text-[16px] italic text-mist">{interim}</div></div>}
          <div ref={endRef} />
        </div>
      </div>

      {error && (
        <div role="alert" className="mx-4 mb-2 flex items-start gap-3 rounded-md border border-oxide/50 bg-oxide/10 px-3 py-2.5 text-[13px] text-ivory">
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} aria-label="Cerrar aviso" className="text-mist hover:text-ivory">✕</button>
        </div>
      )}

      <footer className="border-t border-ivory/10 bg-ink px-3 pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-2.5">
        {speaking && (
          <div className="mx-auto mb-2 flex max-w-2xl items-center justify-between rounded-md bg-panel px-3 py-2 text-[12.5px] text-paper">
            <span>{profile.short_name} está hablando · voz sintética genérica</span>
            <button onClick={stopSpeaking} className="rounded border border-ivory/20 px-2.5 py-1 text-[12px] hover:bg-ivory/10">
              Detener
            </button>
          </div>
        )}
        <form
          className="mx-auto flex max-w-2xl items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            rows={1}
            maxLength={1200}
            placeholder={listening ? "Escuchando…" : "Escribile a Perón…"}
            aria-label="Tu mensaje"
            className="max-h-32 min-h-[48px] flex-1 resize-none rounded-2xl border border-ivory/15 bg-night px-4 py-3 text-[16px] leading-snug text-ivory placeholder:text-mist/70 focus:border-brass focus:outline-none"
          />
          {caps.stt && (
            <button
              type="button"
              onClick={toggleMic}
              aria-pressed={listening}
              aria-label={listening ? "Dejar de escuchar" : "Hablar con el micrófono"}
              className={`grid h-12 w-12 shrink-0 place-items-center rounded-full border transition ${listening ? "listening border-oxide bg-oxide/20 text-oxide" : "border-ivory/20 text-ivory hover:border-brass"}`}
            >
              <IconMic />
            </button>
          )}
          <button
            type="submit"
            disabled={!input.trim() || loading}
            aria-label="Enviar mensaje"
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brass text-night transition enabled:hover:brightness-110 disabled:opacity-35"
          >
            <IconSend />
          </button>
        </form>
      </footer>

      {sheet && <SourcesSheet message={sheet} onClose={() => setSheet(null)} />}
      {toast && (
        <div role="status" className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-paper px-4 py-2 text-[13px] text-night shadow-lg">
          {toast}
        </div>
      )}
    </main>
  );
}

function formatDate(iso: string): string {
  const M = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} de ${M[m - 1]} de ${y}`;
}

const ico = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;
function IconSend() {
  return (
    <svg {...ico}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
function IconMic() {
  return (
    <svg {...ico}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}
function IconShare() {
  return (
    <svg {...ico}>
      <path d="M12 15V3M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  );
}
function IconDots() {
  return (
    <svg {...ico}>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </svg>
  );
}
function IconSpeaker({ on }: { on: boolean }) {
  return (
    <svg {...ico}>
      <path d="M4 10v4h4l5 4V6L8 10H4z" />
      {on ? <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /> : <path d="M17 9l5 6M22 9l-5 6" />}
    </svg>
  );
}
