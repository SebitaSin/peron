/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";

/** Retrato circular. Si no hay imagen con licencia verificada, muestra un monograma tipográfico (sin caricatura). */
export default function Portrait({ src, name, size }: { src: string | null; name: string; size: number }) {
  const [broken, setBroken] = useState(false);
  const initials = name
    .split(" ")
    .filter((w) => w.length > 2)
    .map((w) => w[0])
    .join("")
    .slice(0, 3);
  const ring = { width: size, height: size };
  return (
    <div className="relative shrink-0 overflow-hidden rounded-full border border-brass/70 bg-panel" style={ring}>
      {src && !broken ? (
        <img src={src} alt={`Retrato de ${name}`} width={size} height={size} className="h-full w-full object-cover grayscale-[35%] sepia-[12%]" onError={() => setBroken(true)} />
      ) : (
        <div className="grid h-full w-full place-items-center font-serif text-brass" style={{ fontSize: size * 0.32, letterSpacing: "0.08em" }} aria-label={name} role="img">
          {initials}
        </div>
      )}
    </div>
  );
}
