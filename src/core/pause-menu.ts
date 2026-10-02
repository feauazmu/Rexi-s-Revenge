import type { FullscreenSupport } from './options';

/** Every pause menu entry: Continuar, Silenciar música, Pantalla completa, Salir. */
export type PauseMenuItem = 'resume' | 'mute-music' | 'fullscreen' | 'quit';

const ALL_ITEMS: readonly PauseMenuItem[] = ['resume', 'mute-music', 'fullscreen', 'quit'];
const WITHOUT_FULLSCREEN = ALL_ITEMS.filter((item) => item !== 'fullscreen');

/**
 * The pause menu entries, top to bottom. Pantalla completa is listed only where the pause menu
 * can toggle fullscreen (`toggle` support).
 */
export function pauseMenuItems(support: FullscreenSupport): readonly PauseMenuItem[] {
  return support === 'toggle' ? ALL_ITEMS : WITHOUT_FULLSCREEN;
}

/** Moves a menu selection by `step` entries, wrapping around at both ends. */
export function moveSelection(selected: number, step: number, count: number): number {
  return (((selected + step) % count) + count) % count;
}
