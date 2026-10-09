"use client";

import { useEffect } from "react";
import type { BasisItem } from "@/lib/engine/turn";

interface Props {
  message: { content: string; basis?: BasisItem[] };
  onClose: () => void;
}

const SECTIONS: { kind: BasisItem["kind"]; title: string; hint: string }[] = [
  { kind: "DOCUMENTADO", title: "Documentado", hint: "Apoyado en fichas del archivo." },
  { kind: "INFERENCIA", title: "Inferencia", hint: "Razonamiento del personaje a partir de su forma de pensar; no es un hecho documentado." },
  { kind: "USUARIO", title: "Información contada por vos", hint: "Datos que aportaste en esta conversación." },
];

export default function SourcesSheet({ message, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const basis = message.basis ?? [];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label="¿En qué se basa esta respuesta?">
      <button aria-label="Cerrar" className="absolute inset-0 cursor-default bg-night/70 backdrop-blur-[2px]" onClick={onClose} />
      <div className="sheet-up relative max-h-[82dvh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-ivory/10 bg-ink px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 shadow-2xl">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-ivory/20" />
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-serif text-xl text-ivory">¿En qué se basa esta respuesta?</h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-mist hover:text-ivory">
            ✕
          </button>
        </div>
        <p className="mt-2 text-[13px] italic leading-relaxed text-mist">“{message.content.length > 140 ? message.content.slice(0, 140).trimEnd() + "…" : message.content}”</p>

        {basis.length === 0 ? (
          <p className="mt-5 rounded-md bg-panel px-4 py-3 text-[14px] leading-relaxed text-paper">
            Esta respuesta no se apoya en un documento puntual: es conversación. Perón responde desde su forma de razonar y desde lo que le contaste.
          </p>
        ) : (
          SECTIONS.map((s) => {
            const items = basis.filter((b) => b.kind === s.kind);
            if (!items.length) return null;
            return (
              <section key={s.kind} className="mt-5">
                <h3 className="text-[11px] font-medium uppercase tracking-[0.22em] text-brass">{s.title}</h3>
                <p className="mt-1 text-[12px] text-mist">{s.hint}</p>
                <ul className="mt-2 flex flex-col gap-2.5">
                  {items.map((b, i) => (
                    <li key={i} className="rounded-md bg-panel px-4 py-3 text-[14px] leading-snug text-ivory">
                      {b.text}
                      {b.sources.length > 0 && (
                        <ul className="mt-2 flex flex-col gap-1.5 border-t border-ivory/10 pt-2">
                          {b.sources.map((src) => (
                            <li key={src.source_id} className="text-[12.5px] leading-snug text-paper">
                              <span className="font-serif">{src.title}</span>
                              <span className="text-mist"> — {src.author}, {src.date}</span>
                              <span className="ml-2 rounded-sm border border-brass/50 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-brass">Nivel {src.reliability}</span>
                              {!src.url_checked && (
                                <span className="ml-1.5 rounded-sm border border-oxide/50 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-oxide">ficha sin verificar</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })
        )}
        <p className="mt-6 text-[11.5px] leading-relaxed text-mist/80">
          Reconstrucción generada con inteligencia artificial. Las fichas marcadas “sin verificar” todavía no fueron cotejadas contra el original.
        </p>
      </div>
    </div>
  );
}
