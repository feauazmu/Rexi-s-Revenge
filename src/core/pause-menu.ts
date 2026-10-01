/** Pause menu entries, top to bottom: Continuar, Silenciar música, Salir. */
export const PAUSE_MENU_ITEMS = ['resume', 'mute-music', 'quit'] as const;
export type PauseMenuItem = (typeof PAUSE_MENU_ITEMS)[number];

/** Moves a menu selection by `step` entries, wrapping around at both ends. */
export function moveSelection(selected: number, step: number, count: number): number {
  return (((selected + step) % count) + count) % count;
}
