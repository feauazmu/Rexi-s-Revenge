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
export { DIALOGUE_MAX_LINES, DIALOGUE_TEXT_WIDTH, revealedLines } from './dialogue/dialogue-box';
export { allStrings, strings } from './strings';
export { drawShareCard, SHARE_CARD_HEIGHT, SHARE_CARD_WIDTH } from './brand/share-card';
export {
  APP_ICON_ART,
  APP_ICON_BACKGROUND,
  appIconArt,
  favicon,
  FAVICON_SIZES,
  type FaviconSize,
} from './brand/icons';
export { createSpriteBank, rasterizeSprite, type SpriteBank, type SpriteDef } from './sprite';
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
