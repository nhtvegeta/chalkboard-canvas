import type { Box, El, StrokeEl } from './types';
import { STICKY_PAD } from './constants';
import { layoutText, LINE_HEIGHT } from './text';
import { distToSeg, expandBox, normBox, pointInBox, rotatePoint } from './utils';

export function rawStrokeBox(el: StrokeEl): Box {
  const p = el.points;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < p.length; i += 2) {
    if (p[i] < minX) minX = p[i];
    if (p[i] > maxX) maxX = p[i];
    if (p[i + 1] < minY) minY = p[i + 1];
    if (p[i + 1] > maxY) maxY = p[i + 1];
  }
  return { x: minX, y: minY, w: Math.max(maxX - minX, 0.001), h: Math.max(maxY - minY, 0.001) };
}

export function textBox(el: { x: number; y: number; w: number; text: string; font: any; fontSize: number }): Box {
  const L = layoutText(el.text, el.font, el.fontSize, el.w);
  const lh = el.fontSize * LINE_HEIGHT[el.font as keyof typeof LINE_HEIGHT];
  const w = Math.min(el.w, Math.max(L.width, el.fontSize));
  return { x: el.x, y: el.y, w, h: Math.max(L.height, lh) };
}

export function getBaseBox(el: El): Box {
  switch (el.type) {
    case 'image':
      return { x: el.x, y: el.y, w: el.w, h: el.h };
    case 'sticky':
      return { x: el.x, y: el.y, w: el.w, h: el.h };
    case 'text':
      return textBox(el);
    case 'shape':
      return normBox(el.x1, el.y1, el.x2, el.y2);
    case 'stroke':
      return rawStrokeBox(el);
  }
}

export function getElementCenter(el: El): { cx: number; cy: number } {
  if (el.type === 'shape' && (el.shape === 'line' || el.shape === 'arrow')) {
    return { cx: (el.x1 + el.x2) / 2, cy: (el.y1 + el.y2) / 2 };
  }
  const b = getBaseBox(el);
  return { cx: b.x + b.w / 2, cy: b.y + b.h / 2 };
}

export function elementCorners(el: El): { x: number; y: number }[] {
  const { cx, cy } = getElementCenter(el);
  const r = el.rotation || 0;
  if (el.type === 'shape' && (el.shape === 'line' || el.shape === 'arrow')) {
    return [
      rotatePoint(el.x1, el.y1, cx, cy, r),
      rotatePoint(el.x2, el.y2, cx, cy, r),
    ];
  }
  const b = getBaseBox(el);
  return [
    rotatePoint(b.x, b.y, cx, cy, r),
    rotatePoint(b.x + b.w, b.y, cx, cy, r),
    rotatePoint(b.x + b.w, b.y + b.h, cx, cy, r),
    rotatePoint(b.x, b.y + b.h, cx, cy, r),
  ];
}

export function imageCorners(el: { x: number; y: number; w: number; h: number; rotation: number }) {
  const cx = el.x + el.w / 2;
  const cy = el.y + el.h / 2;
  return [
    rotatePoint(el.x, el.y, cx, cy, el.rotation),
    rotatePoint(el.x + el.w, el.y, cx, cy, el.rotation),
    rotatePoint(el.x + el.w, el.y + el.h, cx, cy, el.rotation),
    rotatePoint(el.x, el.y + el.h, cx, cy, el.rotation),
  ];
}

let bcache = new WeakMap<El, Box>();
export function clearBoundsCache() {
  bcache = new WeakMap();
}

/** Axis-aligned world bounds (memoised per immutable element object). */
export function getBounds(el: El): Box {
  const c = bcache.get(el);
  if (c) return c;
  let b: Box;
  switch (el.type) {
    case 'stroke':
      b = expandBox(rawStrokeBox(el), el.size * (el.kind === 'chalk' ? 1 : 0.5));
      break;
    case 'shape': {
      const head = el.shape === 'arrow' ? Math.max(16, el.size * 4) : 0;
      b = expandBox(normBox(el.x1, el.y1, el.x2, el.y2), el.size / 2 + head);
      break;
    }
    case 'text':
      b = textBox(el);
      break;
    case 'sticky':
      b = { x: el.x, y: el.y - 12, w: el.w, h: el.h + 12 };
      break;
    case 'image': {
      const pts = imageCorners(el);
      const xs = pts.map((p) => p.x);
      const ys = pts.map((p) => p.y);
      b = normBox(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys));
      break;
    }
  }
  if (el.rotation && el.type !== 'image') {
    const { cx, cy } = getElementCenter(el);
    const pts = [
      rotatePoint(b.x, b.y, cx, cy, el.rotation),
      rotatePoint(b.x + b.w, b.y, cx, cy, el.rotation),
      rotatePoint(b.x + b.w, b.y + b.h, cx, cy, el.rotation),
      rotatePoint(b.x, b.y + b.h, cx, cy, el.rotation),
    ];
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    b = normBox(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys));
  }
  bcache.set(el, b);
  return b;
}

/** Tight selection bounds (no dust padding). */
export function getSelectBounds(el: El): Box {
  let b: Box;
  if (el.type === 'stroke') b = expandBox(rawStrokeBox(el), el.size / 2);
  else if (el.type === 'sticky') b = { x: el.x, y: el.y, w: el.w, h: el.h };
  else if (el.type === 'shape' && (el.shape === 'line' || el.shape === 'arrow')) b = normBox(el.x1, el.y1, el.x2, el.y2);
  else b = getBounds(el);

  if (el.rotation && el.type !== 'image') {
    const { cx, cy } = getElementCenter(el);
    const pts = [
      rotatePoint(b.x, b.y, cx, cy, el.rotation),
      rotatePoint(b.x + b.w, b.y, cx, cy, el.rotation),
      rotatePoint(b.x + b.w, b.y + b.h, cx, cy, el.rotation),
      rotatePoint(b.x, b.y + b.h, cx, cy, el.rotation),
    ];
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    return normBox(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys));
  }
  return b;
}

export function hitTest(el: El, x: number, y: number, tol: number, outlineOnly = false): boolean {
  const b = getBounds(el);
  if (!pointInBox(x, y, b, tol)) return false;
  if (el.rotation) {
    const { cx, cy } = getElementCenter(el);
    const p = rotatePoint(x, y, cx, cy, -el.rotation);
    x = p.x;
    y = p.y;
  }
  switch (el.type) {
    case 'stroke': {
      if (el.kind === 'erase') return false;
      const r = el.size / 2 + tol;
      const p = el.points;
      if (p.length === 2) return Math.hypot(x - p[0], y - p[1]) <= r;
      for (let i = 0; i < p.length - 2; i += 2) {
        if (distToSeg(x, y, p[i], p[i + 1], p[i + 2], p[i + 3]) <= r) return true;
      }
      return false;
    }
    case 'shape': {
      const r = el.size / 2 + tol;
      if (el.shape === 'line' || el.shape === 'arrow') return distToSeg(x, y, el.x1, el.y1, el.x2, el.y2) <= r;
      const nb = normBox(el.x1, el.y1, el.x2, el.y2);
      if (el.shape === 'rect') {
        if (!pointInBox(x, y, nb, r)) return false;
        if (!outlineOnly) return true;
        return !pointInBox(x, y, expandBox(nb, -r));
      }
      const rx = Math.max(1, nb.w / 2);
      const ry = Math.max(1, nb.h / 2);
      const nx = (x - (nb.x + rx)) / rx;
      const ny = (y - (nb.y + ry)) / ry;
      const d = Math.sqrt(nx * nx + ny * ny);
      if (!outlineOnly && d <= 1) return true;
      return Math.abs(d - 1) * Math.min(rx, ry) <= r;
    }
    case 'text':
      return pointInBox(x, y, textBox(el), tol);
    case 'sticky':
      return pointInBox(x, y, { x: el.x, y: el.y, w: el.w, h: el.h }, tol);
    case 'image':
      return pointInBox(x, y, el, tol);
  }
}

export function translateEl<T extends El>(el: T, dx: number, dy: number): T {
  switch (el.type) {
    case 'stroke':
      return { ...el, points: el.points.map((v, i) => (i % 2 ? v + dy : v + dx)) };
    case 'shape':
      return { ...el, x1: el.x1 + dx, y1: el.y1 + dy, x2: el.x2 + dx, y2: el.y2 + dy };
    default:
      return { ...el, x: (el as any).x + dx, y: (el as any).y + dy };
  }
}

export function stickyTextBox(el: { x: number; y: number; w: number; h: number }) {
  return { x: el.x + STICKY_PAD, y: el.y + STICKY_PAD, w: el.w - STICKY_PAD * 2, h: el.h - STICKY_PAD * 2 };
}
