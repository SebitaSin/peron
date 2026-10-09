/** Abstracción de voz: se puede reemplazar el proveedor (p. ej. STT/TTS en la nube) sin tocar la UI. */
export interface ListenHooks {
  lang: string;
  onInterim(text: string): void;
  onFinal(text: string): void;
  onEnd(): void;
  onError(code: string): void;
}
export interface SpeakHooks {
  onStart?(): void;
  onEnd?(): void;
}
export interface VoiceProvider {
  readonly id: string;
  sttSupported(): boolean;
  ttsSupported(): boolean;
  startListening(h: ListenHooks): void;
  stopListening(): void;
  speak(text: string, h?: SpeakHooks, emotion?: string): void;
  /** Llamar dentro de un gesto del usuario (toque) para permitir audio automático después. */
  unlock(): void;
  stopSpeaking(): void;
  isSpeaking(): boolean;
}

interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type RecognitionCtor = new () => RecognitionLike;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function splitSentences(text: string): string[] {
  const parts = text.replace(/\s+/g, " ").trim().match(/[^.!?…]+[.!?…]*["”)]*\s*/g) ?? [];
  const out: string[] = [];
  for (const p of parts.map((x) => x.trim()).filter(Boolean)) {
    if (out.length && (out[out.length - 1].length < 28 || p.length < 14)) out[out.length - 1] += " " + p;
    else out.push(p);
  }
  return out;
}

/** Prosodia por estado de ánimo (voz del navegador). */
const PROSODY: Record<string, { rate: number; pitch: number; volume: number }> = {
  sereno: { rate: 0.95, pitch: 0.88, volume: 0.95 },
  calido: { rate: 0.93, pitch: 0.95, volume: 0.95 },
  firme: { rate: 0.98, pitch: 0.82, volume: 1 },
  ironico: { rate: 1.02, pitch: 0.92, volume: 0.95 },
  grave: { rate: 0.84, pitch: 0.74, volume: 0.9 },
  emocionado: { rate: 1.08, pitch: 1.0, volume: 1 },
  curioso: { rate: 0.98, pitch: 0.98, volume: 0.95 },
};

/** Voz del navegador (Web Speech API): costo cero, voz genérica sintética. No clona ninguna voz real. */
export class BrowserVoiceProvider implements VoiceProvider {
  readonly id: string = "browser-webspeech";
  private rec: RecognitionLike | null = null;
  protected speaking = false;

  sttSupported() {
    return recognitionCtor() !== null;
  }
  ttsSupported() {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  }

  startListening(h: ListenHooks) {
    const Ctor = recognitionCtor();
    if (!Ctor) return h.onError("unsupported");
    this.stopSpeaking();
    this.stopListening();
    const rec = new Ctor();
    rec.lang = h.lang;
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    let finalText = "";
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const t = r[0]?.transcript ?? "";
        if (r.isFinal) finalText += t;
        else interim += t;
      }
      if (interim) h.onInterim((finalText + interim).trim());
    };
    rec.onerror = (e) => h.onError(e.error);
    rec.onend = () => {
      this.rec = null;
      if (finalText.trim()) h.onFinal(finalText.trim());
      h.onEnd();
    };
    this.rec = rec;
    try {
      rec.start();
    } catch {
      h.onError("start-failed");
    }
  }

  stopListening() {
    try {
      this.rec?.stop();
    } catch {
      /* ya detenido */
    }
  }

  protected pickVoice(): SpeechSynthesisVoice | undefined {
    const voices = window.speechSynthesis.getVoices();
    const es = voices.filter((v) => v.lang.toLowerCase().startsWith("es"));
    const natural = /natural|neural|online|enhanced|premium/i;
    const male = /diego|jorge|juan|carlos|pablo|tom[aá]s|alvaro|álvaro|male|hombre|google espa/i;
    return (
      es.find((v) => /es-ar/i.test(v.lang) && natural.test(v.name) && male.test(v.name)) ??
      es.find((v) => /es-ar/i.test(v.lang) && natural.test(v.name)) ??
      es.find((v) => /es-(419|us|mx|co|cl|uy)/i.test(v.lang) && natural.test(v.name) && male.test(v.name)) ??
      es.find((v) => natural.test(v.name) && male.test(v.name)) ??
      es.find((v) => /es-ar/i.test(v.lang) && male.test(v.name)) ??
      es.find((v) => male.test(v.name)) ??
      es.find((v) => /es-ar/i.test(v.lang)) ??
      es[0]
    );
  }

  unlock() {
    /* la voz del navegador no necesita desbloqueo */
  }

  speak(text: string, h?: SpeakHooks, emotion?: string) {
    if (!this.ttsSupported()) return;
    this.stopSpeaking();
    const parts = splitSentences(text);
    if (!parts.length) return;
    const v = this.pickVoice();
    const base = PROSODY[emotion ?? "sereno"] ?? PROSODY.sereno;
    let started = false;
    parts.forEach((part, i) => {
      const u = new SpeechSynthesisUtterance(part);
      if (v) {
        u.voice = v;
        u.lang = v.lang;
      } else u.lang = "es-AR";
      const q = /\?\s*$/.test(part);
      const ex = /!\s*$/.test(part);
      u.rate = base.rate * (i === 0 ? 1.04 : 1);
      u.pitch = Math.min(2, Math.max(0.1, base.pitch + (q ? 0.12 : 0) + (ex ? 0.06 : 0)));
      u.volume = base.volume;
      if (i === 0)
        u.onstart = () => {
          if (started) return;
          started = true;
          this.speaking = true;
          h?.onStart?.();
        };
      const last = i === parts.length - 1;
      u.onend = () => {
        if (last) {
          this.speaking = false;
          h?.onEnd?.();
        }
      };
      u.onerror = () => {
        if (last) {
          this.speaking = false;
          h?.onEnd?.();
        }
      };
      window.speechSynthesis.speak(u);
    });
  }

  stopSpeaking() {
    if (!this.ttsSupported()) return;
    window.speechSynthesis.cancel();
    this.speaking = false;
  }

  isSpeaking() {
    return this.speaking || (this.ttsSupported() && window.speechSynthesis.speaking);
  }
}

/**
 * Voz natural en la nube (POST /api/tts): pide todas las frases en paralelo y reproduce en cuanto llega la primera.
 * Si el servidor no tiene TTS configurado o falla, cae a la voz del navegador sin que la UI lo note.
 * Voz sintética genérica; nunca clona la voz de una persona real.
 */
export class CloudVoiceProvider extends BrowserVoiceProvider {
  override readonly id = "cloud-tts";
  private audio: HTMLAudioElement | null = null;
  private token = 0;
  private cloudSpeaking = false;
  private cloudOff = false;

  override unlock() {
    if (typeof window === "undefined" || this.cloudOff) return;
    if (!this.audio) this.audio = new Audio();
    // WAV silencioso mínimo: habilita reproducción automática posterior en móviles
    this.audio.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
    void this.audio.play().catch(() => {});
  }

  override speak(text: string, h?: SpeakHooks, emotion?: string) {
    if (this.cloudOff || typeof window === "undefined" || !this.audio) return super.speak(text, h, emotion);
    const parts = splitSentences(text).slice(0, 8);
    if (!parts.length) return;
    this.stopSpeaking();
    const my = ++this.token;
    const audio = this.audio;
    const jobs = parts.map((p) =>
      fetch("/api/tts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: p, emotion }) })
        .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
        .then((b) => URL.createObjectURL(b)),
    );
    jobs.forEach((j) => j.catch(() => {}));
    this.cloudSpeaking = true;
    void (async () => {
      let spoke = false;
      for (let i = 0; i < jobs.length; i++) {
        let url: string;
        try {
          url = await jobs[i];
        } catch {
          if (my !== this.token) return;
          if (!spoke) this.cloudOff = true;
          this.cloudSpeaking = false;
          // el resto lo dice la voz del navegador
          return super.speak(parts.slice(i).join(" "), h, emotion);
        }
        if (my !== this.token) return;
        await new Promise<void>((resolve) => {
          audio.src = url;
          audio.onended = () => resolve();
          audio.onerror = () => resolve();
          audio
            .play()
            .then(() => {
              if (!spoke) {
                spoke = true;
                h?.onStart?.();
              }
            })
            .catch(() => resolve());
        });
        URL.revokeObjectURL(url);
        if (my !== this.token) return;
      }
      this.cloudSpeaking = false;
      h?.onEnd?.();
    })();
  }

  override stopSpeaking() {
    this.token++;
    this.cloudSpeaking = false;
    try {
      this.audio?.pause();
    } catch {
      /* nada */
    }
    super.stopSpeaking();
  }

  override isSpeaking() {
    return this.cloudSpeaking || super.isSpeaking();
  }
}
