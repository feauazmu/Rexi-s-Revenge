/** Public interface of the renderer: a pure function from the Game core's view to pixels. */
export { createRenderer, type Renderer, type RendererOptions } from './renderer';
export { ROTATE_PROMPT_HEIGHT, ROTATE_PROMPT_WIDTH } from './touch/rotate-prompt';
export {
  canvasSurface,
  type Bitmap,
  type BitmapFactory,
  type Canvas2DLike,
  type Color,
  type Surface,
} from './surface';
export { allStrings, strings } from './strings';
export {
  createBitmapFont,
  drawText,
  fonts,
  formatElapsed,
  scaleFont,
  type BitmapFont,
  type FontDefinition,
  type Glyph,
  type TextAlign,
  type TextStyle,
  type TextTarget,
} from './text';
export {
  TOUCH_LAYOUT,
  TOUCH_MODES,
  touchButtonAt,
  type MenuButton,
  type PlayButton,
  type StickView,
  type TouchButton,
  type TouchControlsMode,
  type TouchOverlayView,
} from './touch/layout';
