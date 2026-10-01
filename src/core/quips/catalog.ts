/**
 * The Quip catalog: what Rexi says when he destroys an Enemy, in neutral Latin American
 * Spanish. Destroying Lawyer Craft draws a `legal` Quip; destroying Gym Craft draws a `gym` one.
 *
 * Content rules (enforced by tests/content/quips.test.ts): about 40 Quips split evenly between
 * themes, unique ids, every Quip fits two Dialogue Box lines, every character exists in the
 * bitmap font, and the running gags below each appear at least three times, word for word:
 *
 * - "yo conozco uno gratis"
 * - "de qué hablan Marlene" (Marlene is the court clerk, never seen)
 * - "la cunclilla de la limpieza" (spelled like that on purpose)
 * - "jueves 2 por 1" (the Bufete & Pesas gym promo on the billboard)
 */

export type QuipTheme = 'legal' | 'gym';

export interface Quip {
  /** Stable, unique id: `<theme>-<slug>`. */
  readonly id: string;
  readonly theme: QuipTheme;
  readonly text: string;
}

const legal = (slug: string, text: string): Quip => ({ id: `legal-${slug}`, theme: 'legal', text });
const gym = (slug: string, text: string): Quip => ({ id: `gym-${slug}`, theme: 'gym', text });

export const QUIPS: readonly Quip[] = [
  // Legal: drawn by Lawyer Craft.
  legal('objecion', '¡Objeción! Ah, no, perdón, el juez soy yo. Concedida.'),
  legal('cosa-juzgada', 'Cosa juzgada. Y bien juzgada, de paso.'),
  legal('desacato', '¡Desacato! Te condeno a cien flexiones. Ah, ya no puedes.'),
  legal('apelacion', '¿Recurso de apelación? Denegado. El aterrizaje también.'),
  legal('habeas-corpus', 'Habeas corpus: tráiganme el cuerpo. O lo que quede del maletín.'),
  legal('sobreseido', 'Caso sobreseído. Bueno, más bien sobre el suelo.'),
  legal('sentencia-firme', 'Sentencia firme. Como mis abdominales.'),
  legal('notificado', 'Queda usted notificado. Por vía aérea.'),
  legal('fianza', 'Fianza denegada. Se queda en el piso hasta nuevo aviso.'),
  legal('in-dubio', 'In dubio pro reo... pero aquí no había ninguna duda.'),
  legal('actas', 'Que conste en actas: lo desestimé en una sola serie.'),
  legal('jurisprudencia', 'Ya es jurisprudencia: maletín que vuela, maletín que cae.'),
  legal('gratis-abogado', '¿Necesitas abogado? Yo conozco uno gratis. Bueno, conocía.'),
  legal(
    'gratis-honorarios',
    '¿Cobras honorarios de cinco cifras? Yo conozco uno gratis y vuela mejor.',
  ),
  legal(
    'marlene-pruebas',
    '¿Que no hay pruebas? ¿De qué hablan, Marlene? ¡Están cayendo del cielo!',
  ),
  legal('marlene-forma', '¿Vicio de forma? ¿De qué hablan, Marlene? ¡Mire esta forma!'),
  legal(
    'marlene-prescripcion',
    '¿Prescribió? ¿De qué hablan, Marlene? Lo único que prescribe aquí es mi descanso.',
  ),
  legal('cunclilla-sala', 'Sala despejada con la cunclilla de la limpieza. Marlene, anote.'),
  legal('jueves-oficio', 'Defensa de oficio: jueves 2 por 1. Hoy es lunes, qué mala suerte.'),
  legal('receso', 'Receso de quince minutos. Para ti, de quince años.'),

  // Gym: drawn by Gym Craft.
  gym('pr', '¡Nuevo PR! Récord personal en demandas desestimadas.'),
  gym('dia-de-pierna', '¿Saltarme el día de pierna? Jamás. Tú sí te saltaste el aterrizaje.'),
  gym('pre-entreno', 'Pre-entreno con doble café. Nunca tuviste oportunidad.'),
  gym('repeticion', 'Esa fue una repetición. Faltan once para completar la serie.'),
  gym('sentadilla', 'Sentadilla profunda, sentencia más profunda.'),
  gym('fallo', 'Entrené hasta el fallo muscular. Tú llegaste hasta el fallo judicial.'),
  gym('cardio', '¿Cardio? Yo hago cardio persiguiendo a sus abogados.'),
  gym('calentamiento', 'Eso fue el calentamiento. La rutina empieza ahora.'),
  gym('descanso', 'Descanso entre series: noventa segundos. Tu chatarra, de por vida.'),
  gym('selfie', 'Un momento, foto para el gimnasio. Sonríe, chatarra.'),
  gym('press-banca', 'Press de banca: 140 kilos. Press de chatarra: los que hagan falta.'),
  gym('gratis-entrenador', '¿Entrenador personal? Yo conozco uno gratis: se llama gravedad.'),
  gym('gratis-membresia', '¿Membresía de lujo? Yo conozco uno gratis: el patio de la corte.'),
  gym(
    'marlene-gritos',
    'Que no se grita en el gimnasio. ¿De qué hablan, Marlene? ¡Es un tribunal!',
  ),
  gym('cunclilla-barrer', 'Eso no fue una sentadilla: fue la cunclilla de la limpieza.'),
  gym(
    'cunclilla-rutina',
    'Rutina de hoy: tres series de la cunclilla de la limpieza. Piso impecable.',
  ),
  gym('cunclilla-mama', 'Mi entrenador le dice sentadilla. Mi mamá, la cunclilla de la limpieza.'),
  gym('jueves-promo', 'Su gimnasio tiene jueves 2 por 1. Yo también: dos golpes, una caída.'),
  gym(
    'jueves-caminadora',
    'Jueves 2 por 1 en Bufete & Pesas: la máquina y el choque, mismo precio.',
  ),
  gym('jueves-chatarra', '¿Jueves 2 por 1? Llévate la chatarra y la sentencia. Sin costo extra.'),
];
