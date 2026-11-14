export type Tool =
  | 'select'
  | 'hand'
  | 'chalk'
  | 'highlighter'
  | 'eraser'
  | 'text'
  | 'sticky'
  | 'rect'
  | 'ellipse'
  | 'line'
  | 'arrow'
  | 'region';

export type EraserMode = 'object' | 'pixel';
export type GridMode = 'none' | 'dots' | 'squares' | 'lines';
export type FontKind = 'hand' | 'print' | 'sans';
export type BoardTheme = 'green' | 'black';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Camera {
  /** screen = world * z + (x, y) */
  x: number;
  y: number;
  z: number;
}

export interface StrokeEl {
  id: string;
  type: 'stroke';
  kind: 'chalk' | 'highlighter' | 'erase';
  points: number[];
  color: string;
  size: number;
  seed: number;
  rotation?: number;
}

export interface ShapeEl {
  id: string;
  type: 'shape';
  shape: 'rect' | 'ellipse' | 'line' | 'arrow';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  size: number;
  seed: number;
  rotation?: number;
}

export interface TextEl {
  id: string;
  type: 'text';
  x: number;
  y: number;
  /** max wrap width */
  w: number;
  text: string;
  color: string;
  fontSize: number;
  font: FontKind;
  rotation?: number;
}

export interface StickyEl {
  id: string;
  type: 'sticky';
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  color: string;
  fontSize: number;
  font: FontKind;
  rotation?: number;
}

export interface ImageEl {
  id: string;
  type: 'image';
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  src: string;
}

export type El = StrokeEl | ShapeEl | TextEl | StickyEl | ImageEl;

export interface Region extends Box {
  id: string;
  name: string;
  color: string;
  createdAt: number;
}

export interface Doc {
  elements: El[];
  regions: Region[];
}

export interface Settings {
  chalkColor: string;
  chalkSize: number;
  hlColor: string;
  hlSize: number;
  eraserMode: EraserMode;
  eraserSize: number;
  font: FontKind;
  fontSize: number;
  stickyColor: string;
  grid: GridMode;
  board: BoardTheme;
  showRegions: boolean;
}
