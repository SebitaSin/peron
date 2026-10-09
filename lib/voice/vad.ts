import type { LiveHooks } from "./provider";

/**
 * Escucha en vivo con detección de voz propia + transcripción en el servidor (/api/stt).
 *  - Cancelación de eco del navegador (getUserMedia echoCancellation): lo que sale del parlante no se toma como voz del usuario.
 *  - Sin sonidos de "inicio de dictado": el micrófono queda abierto y no se reinicia.
 *  - Permite interrumpir: si el usuario habla mientras el personaje habla, avisa con onVoice().
 */
const TARGET_RATE = 16000;
const END_SILENCE_MS = 700;
const MAX_UTTERANCE_MS = 15000;
const MIN_UTTERANCE_MS = 450;
const PREROLL_FRAMES = 10;

type ACtor = typeof AudioContext;

export class VadLive {
  private stopped = false;
  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private proc: ScriptProcessorNode | null = null;

  async start(h: LiveHooks, isBotSpeaking: () => boolean): Promise<"ok" | "denied" | "unsupported"> {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return "unsupported";
    const w = window as unknown as { AudioContext?: ACtor; webkitAudioContext?: ACtor };
    const AC = w.AudioContext ?? w.webkitAudioContext;
    if (!AC) return "unsupported";
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
    } catch {
      return "denied";
    }
    if (this.stopped) {
      stream.getTracks().forEach((t) => t.stop());
      return "ok";
    }
    this.stream = stream;
    const ctx = new AC();
    this.ctx = ctx;
    await ctx.resume().catch(() => {});
    const src = ctx.createMediaStreamSource(stream);
    const proc = ctx.createScriptProcessor(2048, 1, 1);
    const mute = ctx.createGain();
    mute.gain.value = 0;
    src.connect(proc);
    proc.connect(mute);
    mute.connect(ctx.destination);
    this.proc = proc;

    const frameMs = (2048 / ctx.sampleRate) * 1000;
    let floor = 0.01;
    let calib = 0;
    let voiced = 0;
    let inSpeech = false;
    let silenceMs = 0;
    let frames: Float32Array[] = [];
    const pre: Float32Array[] = [];
    let announced = false;

    const finalize = () => {
      const segment = frames;
      frames = [];
      inSpeech = false;
      voiced = 0;
      silenceMs = 0;
      announced = false;
      h.onInterim("");
      const dur = segment.length * frameMs;
      if (dur < MIN_UTTERANCE_MS) return;
      const wav = toWav(segment, ctx.sampleRate);
      void fetch("/api/stt", { method: "POST", body: (() => { const fd = new FormData(); fd.append("audio", wav, "voz.wav"); return fd; })() })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((j: { text?: string }) => {
          const t = (j.text ?? "").trim();
          if (t && !this.stopped) h.onUtterance(t);
        })
        .catch(() => {});
    };

    proc.onaudioprocess = (e) => {
      if (this.stopped) return;
      const input = e.inputBuffer.getChannelData(0);
      const frame = new Float32Array(input);
      let sum = 0;
      for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i];
      const rms = Math.sqrt(sum / frame.length);
      const bot = isBotSpeaking();
      const thr = Math.max(bot ? 0.035 : 0.018, floor * (bot ? 5 : 3));

      if (calib < 12) {
        floor = (floor * calib + rms) / (calib + 1);
        calib++;
        return;
      }
      if (!inSpeech) {
        pre.push(frame);
        if (pre.length > PREROLL_FRAMES) pre.shift();
        if (rms > thr) voiced++;
        else {
          voiced = 0;
          floor = floor * 0.95 + rms * 0.05;
        }
        const need = bot ? 7 : 3; // ~300 ms para interrumpir, ~130 ms normal
        if (voiced >= need) {
          inSpeech = true;
          frames = pre.splice(0, pre.length);
          silenceMs = 0;
          if (!announced) {
            announced = true;
            h.onVoice?.();
            h.onInterim("…");
          }
        }
      } else {
        frames.push(frame);
        if (rms > Math.max(0.012, thr * 0.6)) silenceMs = 0;
        else silenceMs += frameMs;
        if (silenceMs >= END_SILENCE_MS || frames.length * frameMs >= MAX_UTTERANCE_MS) finalize();
      }
    };
    return "ok";
  }

  stop() {
    this.stopped = true;
    try {
      if (this.proc) this.proc.onaudioprocess = null;
      this.proc?.disconnect();
    } catch {
      /* nada */
    }
    this.stream?.getTracks().forEach((t) => t.stop());
    void this.ctx?.close().catch(() => {});
    this.proc = null;
    this.stream = null;
    this.ctx = null;
  }
}

/** PCM float → WAV 16 kHz mono (16 bits). */
function toWav(frames: Float32Array[], inRate: number): Blob {
  let n = 0;
  for (const f of frames) n += f.length;
  const all = new Float32Array(n);
  let o = 0;
  for (const f of frames) {
    all.set(f, o);
    o += f.length;
  }
  const ratio = inRate / TARGET_RATE;
  const outLen = Math.floor(all.length / ratio);
  const pcm = new Int16Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(all.length, Math.floor((i + 1) * ratio));
    let s = 0;
    for (let j = start; j < end; j++) s += all[j];
    const v = end > start ? s / (end - start) : 0;
    pcm[i] = Math.max(-1, Math.min(1, v)) * 0x7fff;
  }
  const buf = new ArrayBuffer(44 + pcm.length * 2);
  const dv = new DataView(buf);
  const wr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) dv.setUint8(off + i, s.charCodeAt(i));
  };
  wr(0, "RIFF");
  dv.setUint32(4, 36 + pcm.length * 2, true);
  wr(8, "WAVE");
  wr(12, "fmt ");
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true);
  dv.setUint16(22, 1, true);
  dv.setUint32(24, TARGET_RATE, true);
  dv.setUint32(28, TARGET_RATE * 2, true);
  dv.setUint16(32, 2, true);
  dv.setUint16(34, 16, true);
  wr(36, "data");
  dv.setUint32(40, pcm.length * 2, true);
  new Int16Array(buf, 44).set(pcm);
  return new Blob([buf], { type: "audio/wav" });
}
