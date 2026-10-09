import type { TechConcept, Term, TimelineEvent } from "../types";

const T = (r: RegExp): Term => ({ src: r.source, flags: r.flags });
const ev = (
  id: string,
  date: string,
  label: string,
  summary: string,
  terms: RegExp[],
  user_terms: RegExp[] = [],
): TimelineEvent => ({ id, date, label, summary, terms: terms.map(T), user_terms: user_terms.map(T) });

/**
 * Línea de tiempo. Los eventos con fecha <= fecha activa forman el "estado del mundo" que Perón conoce.
 * Los posteriores están BLOQUEADOS: sus `terms` se usan para detectar fugas en la respuesta y
 * revelaciones del usuario. Los resúmenes sólo llegan al prompt si la fecha activa los alcanza.
 * Fechas y hechos: nivel de confianza alta salvo nota; pendientes de verificación contra fuentes primarias.
 */
export const PERON_TIMELINE: TimelineEvent[] = [
  // ───── Pasado (conocido en la fecha inicial) ─────
  ev("p-1938-tizon", "1938-09-10", "Muere su primera esposa, Aurelia Tizón", "Perón enviudó; fue un golpe personal fuerte.", []),
  ev("p-1943-golpe", "1943-06-04", "Revolución del 4 de junio de 1943", "Participaste con el GOU en el golpe militar que derrocó a Castillo.", []),
  ev("p-1943-trabajo", "1943-11-27", "Secretaría de Trabajo y Previsión", "Desde ahí construiste el vínculo con los sindicatos y la legislación social.", []),
  ev("p-1945-17oct", "1945-10-17", "17 de octubre de 1945", "Multitud en Plaza de Mayo reclamando tu libertad tras la detención; origen político del movimiento.", []),
  ev("p-1945-eva", "1945-10-22", "Casamiento civil con Eva Duarte", "Te casaste con Eva (civil en Junín; religioso en diciembre en La Plata).", []),
  ev("p-1946-presidencia", "1946-06-04", "Asumís la presidencia", "Ganaste las elecciones del 24 de febrero de 1946.", []),
  ev("p-1947-independencia", "1947-07-09", "Declaración de independencia económica", "Proclamada en Tucumán, el 9 de julio de 1947.", []),
  ev("p-1947-voto", "1947-09-23", "Ley del voto femenino (13.010)", "Las mujeres votarán por primera vez en una elección nacional más adelante.", []),
  ev("p-1948-ferrocarriles", "1948-03-01", "Traspaso de los ferrocarriles británicos al Estado", "Nacionalización de los ferrocarriles.", []),
  ev("p-1949-constitucion", "1949-03-11", "Reforma constitucional de 1949", "Derechos del trabajador, función social de la propiedad, recursos naturales y reelección presidencial inmediata.", []),
  ev("p-1949-comunidad", "1949-04-09", "Discurso de La Comunidad Organizada en Mendoza", "Cierre del Congreso de Filosofía; tu exposición sobre el equilibrio entre individuo y comunidad.", []),
  ev("p-1949-pf", "1949-07-26", "Partido Peronista Femenino", "Fundado con Eva como figura central.", []),
  ev("p-1950-corea", "1950-06-25", "Comienza la guerra de Corea", "Se teme una escalada hacia una tercera guerra mundial.", []),
  ev("p-1950-verdades", "1950-10-17", "Las Veinte Verdades del Justicialista", "Proclamadas el 17 de octubre de 1950.", []),
  ev("p-1951-prensa", "1951-01-26", "La Prensa deja de aparecer tras un conflicto gremial", "Conflicto con el diario opositor; el Congreso avanzó con su expropiación (fecha exacta a verificar).", []),

  // ───── Futuro bloqueado ─────
  ev("f-1951-renunciamiento", "1951-08-22", "El Renunciamiento de Eva a la candidatura", "El 22 de agosto de 1951, en un cabildo abierto, Eva declinó la candidatura a vicepresidenta.", [/renunciamiento/i, /cabildo abierto del 22/i]),
  ev("f-1951-menendez", "1951-09-28", "Intentona golpista del general Menéndez", "Levantamiento fracasado el 28 de septiembre de 1951.", [/Benjam[ií]n Men[eé]ndez/i, /intentona (de|del) (general )?Men[eé]ndez/i, /28 de septiembre de 1951/i]),
  ev("f-1951-eva-enfermedad", "1951-11-06", "Eva es operada: se revela su enfermedad", "A fines de 1951 se le diagnosticó un cáncer; fue operada.", [/c[aá]ncer.{0,40}(Eva|Evita|su esposa|ella)/i, /(Eva|Evita|su esposa).{0,60}c[aá]ncer/i, /George Pack/i, /Ivor Dickson/i]),
  ev("f-1951-reeleccion", "1951-11-11", "Reelección de noviembre de 1951", "El 11 de noviembre de 1951 ganaste ampliamente; por primera vez votaron mujeres en una elección nacional.", [/(gan[oó]|ganar[aá]s?|triunf[oó]|reelecto|reelegido).{0,60}1951/i, /1951.{0,60}(gan[oó]|triunf[oó]|reelecto|reelegido)/i, /62 ?%/i]),
  ev("f-1952-eva-muerte", "1952-07-26", "Muerte de Eva Perón", "Eva murió el 26 de julio de 1952, a las 20:25. Su ausencia pesa para siempre.", [/muerte de (Eva|Evita)/i, /(Eva|Evita)\b.{0,50}(muri[oó]|falleci[oó]|morir[aá]|va a morir|est[aá] muerta|ha muerto)/i, /26 de julio de 1952/i, /duelo nacional/i]),
  ev("f-1952-ara", "1952-07-27", "Embalsamamiento del cuerpo de Eva", "El cuerpo fue embalsamado por Pedro Ara.", [/Pedro Ar[aá]\b/i, /embalsam/i]),
  ev("f-1953-plaza", "1953-04-15", "Atentado en Plaza de Mayo e incendio del Jockey Club", "El 15 de abril de 1953 estallaron bombas en un acto y turbas incendiaron la sede del Jockey Club y otros locales.", [/atentado.{0,40}Plaza de Mayo/i, /bombas?.{0,30}Plaza de Mayo/i, /15 de abril de 1953/i, /Jockey Club.{0,40}(incendi|quem)/i]),
  ev("f-1954-iglesia", "1954-11-10", "Conflicto con la Iglesia", "Desde fines de 1954 el enfrentamiento con la jerarquía católica escaló.", [/conflicto con la Iglesia/i, /quema de iglesias/i, /Corpus Christi.{0,30}1955/i], [/(pele|choque|enfrentamiento|conflicto).{0,30}(con )?(la )?Iglesia/i]),
  ev("f-1955-bombardeo", "1955-06-16", "Bombardeo de la Plaza de Mayo", "El 16 de junio de 1955 la Aviación Naval bombardeó la Plaza de Mayo.", [/bombardeo.{0,40}(Plaza|1955|Aviaci[oó]n Naval)/i, /16 de junio de 1955/i]),
  ev("f-1955-libertadora", "1955-09-16", "Revolución Libertadora: derrocamiento de Perón", "El 16 de septiembre de 1955 se alzaron sectores militares y fuiste derrocado; el 20 buscaste asilo en una cañonera paraguaya.", [/Revoluci[oó]n Libertadora/i, /\bLibertadora\b/i, /Lonardi/i, /Aramburu/i, /Isaac Rojas/i, /16 de septiembre de 1955/i, /Humait[aá]/i], [/derroc/i, /golpe de (estado )?(de )?1955/i, /(me|lo|te) (van|iban|va) a (sacar|echar|voltear)/i]),
  ev("f-1955-exilio", "1955-09-20", "Exilio de Perón", "Asilo en Paraguay y luego años de exilio (Panamá, Venezuela, República Dominicana, España).", [/Puerta de Hierro/i, /Ciudad Trujillo/i], [/(su|tu|el) exilio/i, /exiliad[oa]/i, /exiliarse/i, /exiliar(lo|me|te)/i]),
  ev("f-1956-valle", "1956-06-09", "Levantamiento de Valle y fusilamientos", "Junio de 1956: sublevación peronista y fusilamientos, incluidos civiles en José León Suárez.", [/Juan Jos[eé] Valle/i, /Operaci[oó]n Masacre/i, /Rodolfo Walsh/i, /Le[oó]n Su[aá]rez/i]),
  ev("f-1958-frondizi", "1958-02-23", "Elección de Frondizi y pacto con Perón", "Frondizi ganó con el apoyo del voto peronista tras un pacto.", [/pacto Per[oó]n[- ]Frondizi/i, /Frondizi.{0,40}(presidente|asumi[oó]|gan[oó]|pacto)/i]),
  ev("f-1966-ongania", "1966-06-28", "Golpe de Onganía", "Golpe militar de 1966 contra Illia.", [/Ongan[ií]a/i, /\bIllia\b.{0,40}(presidente|derrocad)/i]),
  ev("f-1969-cordobazo", "1969-05-29", "El Cordobazo", "Estallido obrero y estudiantil en Córdoba.", [/Cordobazo/i]),
  ev("f-1970-montoneros", "1970-05-29", "Montoneros y secuestro de Aramburu", "Surge Montoneros con el secuestro y ejecución de Aramburu.", [/\bMontoneros\b/, /Firmenich/i, /Padre Mugica/i]),
  ev("f-1972-regreso", "1972-11-17", "Regreso de Perón a la Argentina", "El 17 de noviembre de 1972, tras 17 años de exilio.", [/17 de noviembre de 1972/i, /Gaspar Campos/i]),
  ev("f-1973-presidencia", "1973-09-23", "Tercera presidencia y Cámpora, Isabel, López Rega", "Cámpora, Ezeiza, tercera presidencia con Isabel como vice.", [/H[eé]ctor C[aá]mpora/i, /Isabelita/i, /Isabel Per[oó]n/i, /Mar[ií]a Estela Mart[ií]nez/i, /L[oó]pez Rega/i, /masacre de Ezeiza/i, /\bTriple A\b/]),
  ev("f-1974-muerte", "1974-07-01", "Muerte de Perón", "Falleció el 1 de julio de 1974.", [/1 de julio de 1974/i]),
  ev("f-1976-golpe", "1976-03-24", "Golpe de 1976 y dictadura", "Dictadura militar y desaparición forzada de personas.", [/\bVidela\b/i, /\bMassera\b/i, /Proceso de Reorganizaci[oó]n/i, /desaparecidos/i]),
  ev("f-1982-malvinas", "1982-04-02", "Guerra de Malvinas", "Guerra de 1982 contra el Reino Unido.", [/Guerra de (las )?Malvinas/i, /Galtieri/i]),
  ev("f-1983-democracia", "1983-12-10", "Democracia y presidentes posteriores", "Alfonsín, Menem, De la Rúa, Kirchner, Macri, Milei, etc.", [/Alfons[ií]n/i, /\bMenem\b/i, /Kirchner/i, /De la R[uú]a/i, /\bMacri\b/i, /\bMilei\b/i, /Duhalde/i, /Cristina Fern[aá]ndez/i, /Alberto Fern[aá]ndez/i, /Cavallo/i, /corralito/i]),
  ev("f-w-1953-stalin", "1953-03-05", "Muerte de Stalin", "Stalin murió el 5 de marzo de 1953.", [/muerte de Stalin/i, /Stalin.{0,30}(muri[oó]|falleci[oó])/i, /Jruschov|Khrushchev/i]),
  ev("f-w-1957-sputnik", "1957-10-04", "Sputnik", "Primer satélite artificial.", [/Sputnik/i, /Gagarin/i, /Apolo ?11/i, /Neil Armstrong/i, /(llegada|llegó) (del hombre )?a la Luna/i, /hombre en la Luna/i]),
  ev("f-w-1959-cuba", "1959-01-01", "Revolución cubana", "Triunfo de la revolución en Cuba.", [/Fidel Castro/i, /Che Guevara/i, /Revoluci[oó]n Cubana/i]),
  ev("f-w-1963-kennedy", "1963-11-22", "Asesinato de Kennedy", "Murió asesinado el presidente estadounidense.", [/asesinato de (John )?Kennedy/i, /presidente Kennedy/i]),
  ev("f-w-1989-muro", "1989-11-09", "Caída del Muro de Berlín y disolución de la URSS", "Fin de la Guerra Fría.", [/Muro de Berl[ií]n/i, /Gorbachov|Gorbachev/i, /disoluci[oó]n de la (Uni[oó]n Sovi[eé]tica|URSS)/i, /ca[ií]da de la (Uni[oó]n Sovi[eé]tica|URSS)/i]),
  ev("f-w-2001-11s", "2001-09-11", "Atentados del 11 de septiembre", "Ataques a Nueva York y Washington.", [/11 de septiembre de 2001/i, /Torres Gemelas/i, /Bin Laden/i]),
  ev("f-w-leaders", "1960-01-01", "Líderes mundiales posteriores", "Dirigentes de décadas siguientes.", [/\bTrump\b/i, /\bObama\b/i, /\bBiden\b/i, /\bPutin\b/i, /Xi Jinping/i, /\bReagan\b/i, /Thatcher/i, /\bCOVID\b/i, /coronavirus/i]),
];

const A = (id: string, label: string, ...r: RegExp[]): TechConcept => ({ id, label, terms: r.map(T) });

/** Anacronismos tecnológicos y científicos: Perón no los sabe hasta que el interlocutor los menciona. */
export const PERON_ANACHRONISMS: TechConcept[] = [
  A("internet", "internet", /\binternet\b/i, /\bciberespacio\b/i, /\bwi-?fi\b/i, /\bonline\b/i, /\bsitio web\b/i, /\bp[aá]gina web\b/i),
  A("smartphone", "teléfono inteligente (smartphone)", /smartphone/i, /tel[eé]fono (inteligente|celular)/i, /\bcelulares?\b/i),
  A("ia", "inteligencia artificial", /inteligencia artificial/i, /chat ?gpt/i, /\bIA\b/, /machine learning/i, /aprendizaje autom[aá]tico/i, /redes? neuronales?/i, /modelo de lenguaje/i, /\bLLMs?\b/),
  A("redes-sociales", "redes sociales", /redes sociales/i, /facebook/i, /instagram/i, /twitter/i, /tiktok/i, /whatsapp/i, /youtube/i, /telegram/i, /hashtag/i, /influencers?/i, /\bselfies?\b/i),
  A("algoritmo", "algoritmos digitales", /\balgoritmos?\b/i),
  A("email", "correo electrónico", /correo electr[oó]nico/i, /\be-?mails?\b/i),
  A("computacion", "computación personal y software", /computadoras? personales?/i, /\blaptops?\b/i, /\bnotebooks?\b/i, /\bsoftware\b/i, /\bhardware\b/i, /\bapps?\b/i, /aplicaci[oó]n (m[oó]vil|para el celular)/i),
  A("streaming", "streaming y plataformas", /streaming/i, /netflix/i, /spotify/i, /\bpodcasts?\b/i, /\bgoogle\b/i, /wikipedia/i, /amazon\.com|\bamazon\b/i),
  A("gps-espacio", "GPS y satélites artificiales", /\bGPS\b/, /sat[eé]lites? artificiales?/i, /estaci[oó]n espacial/i, /viajes? espaciales?/i),
  A("medicina-moderna", "medicina moderna (imágenes, genética, trasplantes)", /resonancia magn[eé]tica/i, /tomograf[ií]a/i, /\bADN\b/, /gen[oó]ma/i, /trasplantes? de (coraz[oó]n|ri[nñ][oó]n|[oó]rganos|h[ií]gado)/i, /marcapasos/i, /\bstents?\b/i, /inmunoterapia/i, /vacuna (contra la polio|Salk)/i, /c[eé]lulas madre/i, /ecograf[ií]a/i, /laparoscop[ií]a/i, /cirug[ií]a rob[oó]tica/i),
  A("siglo-xxi", "siglo XXI", /siglo (XXI|21|veintiuno)/i),
  A("cripto", "criptomonedas", /bitcoin/i, /criptomonedas?/i, /blockchain/i),
  A("drones", "drones", /\bdrones?\b/i),
  A("videollamada", "videollamadas", /videollamadas?/i, /videoconferencias?/i, /\bzoom\b/i),
  A("finanzas-digitales", "cajeros automáticos y billeteras virtuales", /cajeros? autom[aá]ticos?/i, /\bATM\b/, /billeteras? virtual(es)?/i, /home banking/i, /mercado ?pago/i, /tarjeta de d[eé]bito/i),
];
