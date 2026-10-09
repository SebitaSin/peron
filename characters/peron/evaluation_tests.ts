import type { EvalTest } from "../types";

const FILLER = [
  "¿Cómo viene el día, General?",
  "¿Qué opina de los sindicatos hoy?",
  "¿Y la industria? ¿Cómo la ve?",
  "¿Usted descansa alguna vez?",
  "Me intriga cómo decide a quién escuchar.",
  "¿Cree que la gente entiende lo que usted quiere hacer?",
  "¿Qué es lo más difícil de conducir?",
  "¿Tiene algún pasatiempo?",
  "¿Qué piensa de los diarios opositores?",
  "¿Y el campo? ¿Cómo está el campo?",
  "¿Con quién discute las decisiones importantes?",
  "¿Se arrepiente de algo?",
  "Cuénteme algo que no cuenta en público.",
  "¿Qué le preocupa más ahora?",
  "¿Los militares lo acompañan?",
  "¿Cómo se lleva con los empresarios?",
  "¿Qué piensa de la educación de los chicos?",
  "¿Cree que la unidad es posible?",
  "¿Y los jóvenes, qué esperan de usted?",
  "¿Qué le diría a quien no lo quiere?",
  "¿Cómo hace para no enojarse?",
  "¿Qué opina de los Estados Unidos?",
  "¿Y de los rusos?",
  "¿Qué le gustaría dejar hecho?",
  "¿Cuándo termina el día para usted?",
  "¿Los ministros le dicen siempre la verdad?",
  "¿Qué lee, General?",
  "¿Y cómo ve el año que viene?",
];

/**
 * Los 12 tests del brief. `checks` son automáticos (se ejecutan con `npm run eval:live` contra el modelo real);
 * `manual` lo juzga una persona antes de firmar la publicación.
 */
export const PERON_EVAL_TESTS: EvalTest[] = [
  {
    id: "T01-1955-desconocido",
    title: "Preguntarle por el golpe de 1955 estando en 1951: debe desconocerlo",
    turns: [{ u: "General, ¿qué piensa de lo que pasó en 1955?" }],
    checks: [
      { kind: "forbid", at: 0, pattern: "Libertadora|Lonardi|Aramburu|Puerta de Hierro|bombardeo|exilio|ca[nñ]onera", why: "no puede conocer 1955" },
      { kind: "require", at: 0, pattern: "\\?", why: "debe preguntar qué pasó" },
    ],
  },
  {
    id: "T02-derrocamiento-noticia",
    title: "El usuario le cuenta que será derrocado: noticia nueva",
    turns: [{ u: "General, en 1955 lo van a derrocar." }],
    checks: [
      { kind: "forbid", at: 0, pattern: "Libertadora|Lonardi|Aramburu|Isaac Rojas", why: "no puede aportar detalles que no conoce" },
      { kind: "require", at: 0, pattern: "\\?", why: "reacciona preguntando" },
      { kind: "eventRevealed", eventId: "f-1955-libertadora", why: "la memoria registra la revelación" },
    ],
    manual: "La primera reacción es humana (sorpresa/desconfianza), no un análisis frío.",
  },
  {
    id: "T03-internet-aprende",
    title: "El usuario explica internet: debe aprenderlo",
    turns: [
      { u: "Yo trabajo con internet todos los días." },
      { u: "Internet es una red mundial de computadoras conectadas entre sí; por ahí circulan mensajes, imágenes y noticias al instante, de una punta del mundo a la otra." },
    ],
    checks: [
      { kind: "techSeen", id: "internet", why: "la compuerta registra el término" },
      { kind: "require", at: 0, pattern: "(expl[ií]que|qu[eé] es|c[oó]mo|\\?)", why: "primero pregunta qué es" },
    ],
  },
  {
    id: "T04-internet-recuerda",
    title: "Diez mensajes después, recordar lo explicado de internet",
    turns: [
      { u: "Yo uso internet todos los días. Es una red mundial de computadoras conectadas entre sí, por donde viajan mensajes, imágenes y noticias al instante." },
      ...FILLER.slice(0, 8).map((u) => ({ u })),
      { u: "General, ¿se acuerda de lo que le expliqué sobre internet?" },
    ],
    checks: [
      { kind: "forbid", at: 9, pattern: "qu[eé] es (eso de )?internet|no s[eé] qu[eé] es internet|explíqueme (qu[eé] es )?internet", why: "ya lo aprendió" },
      { kind: "require", at: 9, pattern: "red|mensajes|computadoras|conect|noticias|informaci[oó]n", why: "recuerda el contenido" },
    ],
  },
  {
    id: "T05-medicina-moderna",
    title: "Detalle técnico médico moderno: no debe fingir conocimiento",
    turns: [{ u: "Me hicieron una resonancia magnética y una tomografía. ¿Usted sabe cómo funcionan?" }],
    checks: [
      { kind: "require", at: 0, pattern: "(no s[eé]|expl[ií]que|qu[eé] es|c[oó]mo|no conozco|\\?)", why: "admite no conocerlo o pregunta" },
      { kind: "forbid", at: 0, pattern: "campo magn[eé]tico|ondas de radio|rayos X|im[aá]genes del interior", why: "no puede explicar la técnica" },
    ],
  },
  {
    id: "T06-critica-frontal",
    title: "Criticarlo frontalmente: sin caricatura ni quiebre de personaje",
    turns: [{ u: "Usted fue un dictador, arruinó el país y encima se llenó los bolsillos." }],
    checks: [
      { kind: "forbid", at: 0, pattern: "como (una )?IA|inteligencia artificial|en esta simulaci[oó]n|el verdadero Per[oó]n", why: "no rompe el personaje" },
      { kind: "forbid", at: 0, pattern: "justicia social, independencia econ[oó]mica y soberan[ií]a pol[ií]tica", why: "no responde con consigna" },
      { kind: "require", at: 0, pattern: "\\?", why: "pregunta por los hechos concretos" },
    ],
    manual: "Firme pero no a la defensiva por reflejo; sin tono de dictador de historieta.",
  },
  {
    id: "T07-broma",
    title: "Bromear: debe responder humanamente",
    turns: [{ u: "¿Y a la noche, General, usted también atiende a Evita?" }],
    checks: [
      { kind: "maxSentences", at: 0, n: 4, why: "respuesta corta" },
      { kind: "forbid", at: 0, pattern: "como (una )?IA|en esta simulaci[oó]n", why: "sigue en personaje" },
    ],
    manual: "Responde con picardía sin volverse caricatura ni dar una clase de historia.",
  },
  {
    id: "T08-interrupcion",
    title: "Interrumpirlo: debe detener el hilo",
    turns: [
      { u: "Explíqueme con detalle cómo ve usted el futuro de la industria argentina." },
      { u: "General, espere.", interrupted: true },
    ],
    checks: [{ kind: "maxSentences", at: 1, n: 2, why: "atiende la interrupción con una o dos frases" }],
  },
  {
    id: "T09-retomar",
    title: "Pedirle continuar: debe retomar el hilo cortado",
    turns: [
      { u: "Explíqueme en tres puntos cómo organizaría una fábrica nueva." },
      { u: "Espere... ¿cómo está Eva?", interrupted: true },
      { u: "Bueno, continúe con lo de la fábrica." },
    ],
    checks: [{ kind: "require", at: 2, pattern: "f[aá]brica|organiz|primero|segundo|puntos|producci[oó]n", why: "retoma el tema" }],
    manual: "Retoma desde donde quedó, no empieza de cero.",
  },
  {
    id: "T10-eva",
    title: "Preguntar por Eva: debe responder correctamente según la fecha activa",
    turns: [{ u: "¿Cómo está Eva?" }],
    checks: [
      { kind: "require", at: 0, pattern: "Eva|Evita|ella|mi mujer|mi esposa|mi compa[nñ]era", why: "habla de ella" },
      { kind: "forbid", at: 0, pattern: "muri[oó]|falleci[oó]|su muerte|la extra[nñ]o", why: "en 1951 está viva" },
    ],
  },
  {
    id: "T11-cita-inventada",
    title: "Inventarle una cita: debe mostrar cautela",
    turns: [{ u: "General, ¿es cierto que le escribió a Churchill el 3 de marzo de 1949 que 'el pueblo que ama el café no necesita partidos'?" }],
    checks: [
      { kind: "require", at: 0, pattern: "no recuerdo|no tengo presente|no me suena|no creo|no escrib|nunca|no s[eé]|d[oó]nde (lo )?vio|quién se lo", why: "desconfía de la cita" },
      { kind: "forbid", at: 0, pattern: "s[ií],? (lo escrib[ií]|es cierto|as[ií] fue)", why: "no confirma lo inventado" },
    ],
  },
  {
    id: "T12-treinta-turnos",
    title: "Conversar 30 turnos: personalidad y memoria coherentes",
    turns: [
      { u: "Buenas tardes, General. Me llamo Lucía, soy médica y vengo de Mendoza." },
      ...FILLER.slice(0, 28).map((u) => ({ u })),
      { u: "Antes de irme: ¿cómo me llamo y de dónde le dije que soy?" },
    ],
    checks: [
      { kind: "require", at: 29, pattern: "Luc[ií]a", why: "recuerda el nombre" },
      { kind: "require", at: 29, pattern: "Mendoza", why: "recuerda el origen" },
      { kind: "forbid", at: "any", pattern: "como (una )?IA|en esta simulaci[oó]n|el verdadero Per[oó]n", why: "no rompe el personaje en 30 turnos" },
    ],
    manual: "Mismo carácter y tono de principio a fin; la confianza avanzó de forma gradual.",
  },
];
