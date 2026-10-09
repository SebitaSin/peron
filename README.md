# Historia Viva — MVP 01 · Perón · 1 de mayo de 1951

Plataforma multipersona para conversar con reconstrucciones históricas documentadas. Next.js 16 · TypeScript · Tailwind 4.

## Desplegar (único paso humano)

```bash
cd historia-viva
npx vercel login
npx vercel link
npx vercel env add ANTHROPIC_API_KEY production     # pegar la clave (solo servidor)
npx vercel env add ALLOW_DRAFT_CHARACTERS production # valor: 1  (ver "Publicación")
npx vercel --prod
```

La URL pública queda en `https://<proyecto>.vercel.app/p/peron`. Para dominio propio: Vercel → Settings → Domains.
Alternativa: subir la carpeta a GitHub e importarla en vercel.com/new con las mismas variables.

## Publicación (la regla del brief)

Un personaje es `published` sólo si pasó la evaluación y una persona firmó:

1. `npm run eval:live -- peron` — corre los 12 tests contra el modelo real y escribe `characters/peron/evaluation_report.json`.
2. Revisar los criterios `manual` que imprime y poner `"manual_signoff": true` en ese JSON.
3. `npm run gate` debe salir en verde.

Mientras eso no ocurra, el personaje está en **draft**: `/p/peron` devuelve 404 salvo que se defina `ALLOW_DRAFT_CHARACTERS=1`
(la portada muestra "Versión de prueba"). Es para pruebas internas, no para difusión pública.

## Variables de entorno (ver `.env.example`)

| Variable | Uso |
|---|---|
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | Sólo servidor. Sin ninguna, el chat responde 503 `not_configured` (nunca respuestas simuladas). |
| `LLM_PROVIDER`, `LLM_MODEL` | `anthropic` (modelo por defecto `claude-sonnet-5-5`) u `openai` (`LLM_MODEL` obligatorio). |
| `ALLOW_DRAFT_CHARACTERS` | `1` sirve personajes sin evaluación aprobada. |
| `NEXT_PUBLIC_SITE_URL` | URL pública para OpenGraph (opcional en Vercel). |

## Retrato

No se incluye fotografía: hay que usar una imagen con licencia verificada. Copiarla a
`public/characters/peron/portrait.jpg` (o `.png`/`.webp`) y se usa en portada, chat y vista previa de WhatsApp/Instagram.
Sin imagen se muestra un monograma tipográfico.

## Arquitectura

- `characters/<slug>/` — Character Pack: profile, timeline, world_state, relationships, personality, decision_model, speaking_style, source_registry, knowledge, temporal_gates, conversation_rules, system_prompt, evaluation_tests. `characters/peron/source/` guarda verbatim el dossier, el Anexo A y el brief.
- `lib/engine/` — `gate` (compuerta temporal determinista), `state` (memoria de sesión, validada en servidor), `retrieval` (RAG léxico sólo ante coincidencia clara y filtrado por fecha), `context` (7 capas), `turn` (orquestación + verificación de fugas con una corrección y respuesta segura).
- `lib/llm/` — `LLMProvider` (Anthropic con prompt caching del bloque de identidad, OpenAI). `lib/voice/` — `VoiceProvider` (Web Speech API, voz sintética genérica).
- `app/api/chat` — el único punto que toca el LLM. Rate limit por IP, topes de tamaño, estado saneado.
- `lib/research/` + `npm run research -- "Nombre"` — andamiaje de las 15 etapas para nuevos personajes.

Privacidad: el servidor no guarda conversaciones. La memoria vive en `sessionStorage` del navegador (nueva visita = nueva conversación) y viaja en cada turno; los logs registran metadatos, nunca texto.

## Verificación

```bash
npm run verify   # lint + typecheck + tests + build + escaneo de secretos en el bundle
```
