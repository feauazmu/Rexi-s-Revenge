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
