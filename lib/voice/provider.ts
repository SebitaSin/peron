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
  speak(text: string, h?: SpeakHooks): void;
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

/** Voz del navegador (Web Speech API): costo cero, voz genérica sintética. No clona ninguna voz real. */
export class BrowserVoiceProvider implements VoiceProvider {
  readonly id = "browser-webspeech";
  private rec: RecognitionLike | null = null;
  private speaking = false;

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

  private pickVoice(): SpeechSynthesisVoice | undefined {
    const voices = window.speechSynthesis.getVoices();
    const es = voices.filter((v) => v.lang.toLowerCase().startsWith("es"));
    const male = /diego|jorge|juan|carlos|pablo|male|hombre|google espa/i;
    return (
      es.find((v) => /es-ar/i.test(v.lang) && male.test(v.name)) ??
      es.find((v) => /es-(ar|419|us|mx)/i.test(v.lang) && male.test(v.name)) ??
      es.find((v) => male.test(v.name)) ??
      es.find((v) => /es-ar/i.test(v.lang)) ??
      es[0]
    );
  }

  speak(text: string, h?: SpeakHooks) {
    if (!this.ttsSupported()) return;
    this.stopSpeaking();
    const u = new SpeechSynthesisUtterance(text);
    const v = this.pickVoice();
    if (v) {
      u.voice = v;
      u.lang = v.lang;
    } else u.lang = "es-AR";
    u.rate = 0.96;
    u.pitch = 0.85;
    u.onstart = () => {
      this.speaking = true;
      h?.onStart?.();
    };
    const done = () => {
      this.speaking = false;
      h?.onEnd?.();
    };
    u.onend = done;
    u.onerror = done;
    window.speechSynthesis.speak(u);
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
