/** Public interface of the renderer: a pure function from the Game core's view to pixels. */
export { createRenderer, type Renderer } from './renderer';
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
