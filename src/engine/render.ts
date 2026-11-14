import type { Box, Camera, El, GridMode, ImageEl, Region, ShapeEl, StickyEl, StrokeEl, TextEl } from './types';
import { STICKY_PAD } from './constants';
import { boxesIntersect, hashString, hexToRgb, hexToRgba, mulberry32, normBox, roundRectPath } from './utils';
import { drawTextLayout, layoutText } from './text';
import { getBounds, getElementCenter } from './geometry';

export interface RenderCtx {
  ctx: CanvasRenderingContext2D;
  /** CSS pixels per world unit (controls grain size) */
  zoom: number;
  /** device pixels per world unit (controls shadows) */
  px: number;
  view?: Box;
  editingId?: string | null;
  images: ImageCache;
}

/* ------------------------------------------------------------------ */
/* Image cache                                                         */
/* ------------------------------------------------------------------ */
export class ImageCache {
  private map = new Map<string, { src: string; img: HTMLImageElement }>();
  constructor(private onLoad: () => void) {}

  get(el: ImageEl): HTMLImageElement {
    const rec = this.map.get(el.id);
    if (rec && rec.src === el.src) return rec.img;
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => this.onLoad();
    img.src = el.src;
    this.map.set(el.id, { src: el.src, img });
    return img;
  }

  async ensureAll(els: El[]) {
    await Promise.all(
      els
        .filter((e): e is ImageEl => e.type === 'image')
        .map((e) => {
          const img = this.get(e);
          if (img.complete && img.naturalWidth) return Promise.resolve();
          return new Promise<void>((res) => {
            img.addEventListener('load', () => res(), { once: true });
            img.addEventListener('error', () => res(), { once: true });
          });
        }),
    );
  }
}

/* ------------------------------------------------------------------ */
/* Chalk grain                                                         */
/* ------------------------------------------------------------------ */
const grainTiles = new Map<string, HTMLCanvasElement>();
function grainTile(color: string) {
  let c = grainTiles.get(color);
  if (c) return c;
  const S = 128;
  c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  const img = g.createImageData(S, S);
  const [r, gg, b] = hexToRgb(color);
  const rnd = mulberry32(hashString(color));
  for (let i = 0; i < img.data.length; i += 4) {
    const v = rnd();
    const a = v < 0.13 ? 0 : v < 0.3 ? 0.4 + rnd() * 0.25 : 0.84 + rnd() * 0.16;
    img.data[i] = r;
    img.data[i + 1] = gg;
    img.data[i + 2] = b;
    img.data[i + 3] = a * 255;
  }
  g.putImageData(img, 0, 0);
  grainTiles.set(color, c);
  return c;
}

const patternCache = new WeakMap<CanvasRenderingContext2D, Map<string, CanvasPattern>>();
export function chalkFill(rc: RenderCtx, color: string): CanvasPattern | string {
  let m = patternCache.get(rc.ctx);
  if (!m) {
    m = new Map();
    patternCache.set(rc.ctx, m);
  }
  let p = m.get(color);
  if (!p) {
    const created = rc.ctx.createPattern(grainTile(color), 'repeat');
    if (!created) return color;
    p = created;
    m.set(color, p);
  }
  const k = 1 / rc.zoom;
  p.setTransform(new DOMMatrix([k, 0, 0, k, 0, 0]));
  return p;
}

/* ------------------------------------------------------------------ */
/* Elements                                                            */
/* ------------------------------------------------------------------ */
function tracePath(ctx: CanvasRenderingContext2D, pts: number[]) {
  const n = pts.length / 2;
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  if (n === 1) {
    ctx.lineTo(pts[0] + 0.01, pts[1]);
    return;
  }
  if (n === 2) {
    ctx.lineTo(pts[2], pts[3]);
    return;
  }
  for (let i = 1; i < n - 1; i++) {
    const x = pts[i * 2];
    const y = pts[i * 2 + 1];
    ctx.quadraticCurveTo(x, y, (x + pts[i * 2 + 2]) / 2, (y + pts[i * 2 + 3]) / 2);
  }
  ctx.lineTo(pts[(n - 1) * 2], pts[(n - 1) * 2 + 1]);
}

const DUST_ALPHAS = [0.14, 0.28, 0.45];
function chalkDust(rc: RenderCtx, pts: number[], size: number, color: string, seed: number) {
  const { ctx } = rc;
  const rng = mulberry32(seed);
  const paths = DUST_ALPHAS.map(() => new Path2D());
  const n = pts.length / 2;
  const spacing = Math.max(size * 0.45, 0.5);
  for (let i = 0; i < n; i++) {
    const ax = pts[i * 2];
    const ay = pts[i * 2 + 1];
    const bx = i < n - 1 ? pts[i * 2 + 2] : ax;
    const by = i < n - 1 ? pts[i * 2 + 3] : ay;
    const len = Math.hypot(bx - ax, by - ay);
    const count = Math.min(24, Math.max(1, Math.ceil(len / spacing)));
    for (let k = 0; k < count; k++) {
      const t = rng();
      const ang = rng() * Math.PI * 2;
      const r = size * (0.4 + rng() * 0.55);
      const d = size * (0.04 + rng() * 0.09);
      const x = ax + (bx - ax) * t + Math.cos(ang) * r;
      const y = ay + (by - ay) * t + Math.sin(ang) * r;
      paths[Math.floor(rng() * 3)].rect(x - d / 2, y - d / 2, d, d);
    }
  }
  ctx.fillStyle = color;
  paths.forEach((p, i) => {
    ctx.globalAlpha = DUST_ALPHAS[i];
    ctx.fill(p);
  });
  ctx.globalAlpha = 1;
}

function drawStroke(rc: RenderCtx, el: StrokeEl) {
  const { ctx } = rc;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = el.size;
  if (el.kind === 'erase') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = '#000';
    tracePath(ctx, el.points);
    ctx.stroke();
  } else if (el.kind === 'highlighter') {
    ctx.globalAlpha = 0.36;
    ctx.strokeStyle = el.color;
    tracePath(ctx, el.points);
    ctx.stroke();
  } else {
    ctx.strokeStyle = chalkFill(rc, el.color);
    tracePath(ctx, el.points);
    ctx.stroke();
    if (el.size * rc.zoom > 2.2) chalkDust(rc, el.points, el.size, el.color, el.seed);
  }
  ctx.restore();
}

function drawShape(rc: RenderCtx, el: ShapeEl) {
  const { ctx } = rc;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = el.size;
  ctx.strokeStyle = chalkFill(rc, el.color);
  ctx.beginPath();
  const { x1, y1, x2, y2 } = el;
  const dust: number[] = [];
  if (el.shape === 'rect') {
    const b = normBox(x1, y1, x2, y2);
    ctx.rect(b.x, b.y, b.w, b.h);
    dust.push(b.x, b.y, b.x + b.w, b.y, b.x + b.w, b.y + b.h, b.x, b.y + b.h, b.x, b.y);
  } else if (el.shape === 'ellipse') {
    const b = normBox(x1, y1, x2, y2);
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    ctx.ellipse(cx, cy, b.w / 2, b.h / 2, 0, 0, Math.PI * 2);
    for (let i = 0; i <= 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      dust.push(cx + Math.cos(a) * b.w / 2, cy + Math.sin(a) * b.h / 2);
    }
  } else {
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    dust.push(x1, y1, x2, y2);
    if (el.shape === 'arrow') {
      const ang = Math.atan2(y2 - y1, x2 - x1);
      const len = Math.min(Math.max(16, el.size * 4), Math.hypot(x2 - x1, y2 - y1) * 0.6);
      ctx.moveTo(x2 - len * Math.cos(ang - 0.45), y2 - len * Math.sin(ang - 0.45));
      ctx.lineTo(x2, y2);
      ctx.lineTo(x2 - len * Math.cos(ang + 0.45), y2 - len * Math.sin(ang + 0.45));
    }
  }
  ctx.stroke();
  if (el.size * rc.zoom > 2.2) chalkDust(rc, dust, el.size, el.color, el.seed);
  ctx.restore();
}

function drawText(rc: RenderCtx, el: TextEl) {
  if (rc.editingId === el.id || !el.text) return;
  const L = layoutText(el.text, el.font, el.fontSize, el.w);
  const fill = el.font === 'sans' ? el.color : chalkFill(rc, el.color);
  rc.ctx.save();
  drawTextLayout(rc.ctx, L, el.x, el.y, el.font, el.fontSize, fill, el.color);
  rc.ctx.restore();
}

function drawSticky(rc: RenderCtx, el: StickyEl) {
  const { ctx } = rc;
  const { x, y, w, h } = el;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = Math.min(60, 18 * rc.px);
  ctx.shadowOffsetY = Math.min(20, 7 * rc.px);
  ctx.fillStyle = el.color;
  ctx.fillRect(x, y, w, h);
  ctx.shadowColor = 'transparent';
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, 'rgba(255,255,255,0.28)');
  g.addColorStop(0.5, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.07)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  // folded corner
  const f = Math.min(w, h) * 0.12;
  ctx.fillStyle = 'rgba(0,0,0,0.13)';
  ctx.beginPath();
  ctx.moveTo(x + w - f, y + h);
  ctx.lineTo(x + w, y + h - f);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
  ctx.fill();
  // tape
  ctx.save();
  ctx.translate(x + w / 2, y + 2);
  ctx.rotate(-0.05);
  ctx.fillStyle = 'rgba(255,255,255,0.42)';
  ctx.fillRect(-w * 0.18, -12, w * 0.36, 24);
  ctx.restore();
  if (rc.editingId !== el.id && el.text) {
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    const L = layoutText(el.text, el.font, el.fontSize, w - STICKY_PAD * 2);
    drawTextLayout(ctx, L, x + STICKY_PAD, y + STICKY_PAD, el.font, el.fontSize, '#2d2a26', '#2d2a26');
  }
  ctx.restore();
}

function drawImageEl(rc: RenderCtx, el: ImageEl) {
  const { ctx } = rc;
  const img = rc.images.get(el);
  ctx.save();
  ctx.translate(el.x + el.w / 2, el.y + el.h / 2);
  ctx.rotate(el.rotation);
  if (img.complete && img.naturalWidth) {
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = Math.min(40, 14 * rc.px);
    ctx.shadowOffsetY = Math.min(14, 5 * rc.px);
    ctx.drawImage(img, -el.w / 2, -el.h / 2, el.w, el.h);
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(-el.w / 2, -el.h / 2, el.w, el.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.setLineDash([8 / rc.zoom, 6 / rc.zoom]);
    ctx.lineWidth = 1.5 / rc.zoom;
    ctx.strokeRect(-el.w / 2, -el.h / 2, el.w, el.h);
  }
  ctx.restore();
}

function drawElRaw(rc: RenderCtx, el: El) {
  switch (el.type) {
    case 'stroke':
      return drawStroke(rc, el);
    case 'shape':
      return drawShape(rc, el);
    case 'text':
      return drawText(rc, el);
    case 'sticky':
      return drawSticky(rc, el);
    case 'image':
      return drawImageEl(rc, el);
  }
}

export function drawElement(rc: RenderCtx, el: El) {
  const rot = el.rotation || 0;
  if (rot && el.type !== 'image') {
    const { cx, cy } = getElementCenter(el);
    rc.ctx.save();
    rc.ctx.translate(cx, cy);
    rc.ctx.rotate(rot);
    rc.ctx.translate(-cx, -cy);
    drawElRaw(rc, el);
    rc.ctx.restore();
  } else {
    drawElRaw(rc, el);
  }
}

export function drawElements(rc: RenderCtx, els: El[]) {
  for (const el of els) {
    if (rc.view && !boxesIntersect(getBounds(el), rc.view)) continue;
    drawElement(rc, el);
  }
}

/* ------------------------------------------------------------------ */
/* Grid                                                                */
/* ------------------------------------------------------------------ */
export function drawGrid(ctx: CanvasRenderingContext2D, cam: Camera, W: number, H: number, dpr: number, mode: GridMode) {
  if (mode === 'none') return;
  ctx.save();
  ctx.scale(dpr, dpr);
  let step = 40 * cam.z;
  let unit = 40;
  while (step < 20) {
    step *= 5;
    unit *= 5;
  }
  while (step >= 100) {
    step /= 5;
    unit /= 5;
  }
  const ox = ((cam.x % step) + step) % step;
  const oy = ((cam.y % step) + step) % step;
  const isMajor = (s: number, o: number) => Math.round((s - o) / step) % 5 === 0;

  if (mode === 'dots') {
    const r = Math.min(1.8, Math.max(0.9, step / 30));
    const minor = new Path2D();
    const major = new Path2D();
    for (let x = ox; x < W; x += step) {
      const mx = isMajor(x, cam.x);
      for (let y = oy; y < H; y += step) {
        const p = mx && isMajor(y, cam.y) ? major : minor;
        p.rect(x - r / 2, y - r / 2, r, r);
      }
    }
    ctx.fillStyle = 'rgba(255,255,255,0.13)';
    ctx.fill(minor);
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fill(major);
  } else {
    const minor = new Path2D();
    const major = new Path2D();
    if (mode === 'squares') {
      for (let x = ox; x < W; x += step) {
        const p = isMajor(x, cam.x) ? major : minor;
        p.moveTo(Math.round(x) + 0.5, 0);
        p.lineTo(Math.round(x) + 0.5, H);
      }
    }
    for (let y = oy; y < H; y += step) {
      const p = isMajor(y, cam.y) ? major : minor;
      p.moveTo(0, Math.round(y) + 0.5);
      p.lineTo(W, Math.round(y) + 0.5);
    }
    ctx.lineWidth = 1;
    ctx.strokeStyle = mode === 'lines' ? 'rgba(170,215,255,0.07)' : 'rgba(255,255,255,0.045)';
    ctx.stroke(minor);
    ctx.strokeStyle = mode === 'lines' ? 'rgba(170,215,255,0.12)' : 'rgba(255,255,255,0.09)';
    ctx.stroke(major);
  }
  void unit;
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Regions (spatial bookmarks)                                         */
/* ------------------------------------------------------------------ */
export function drawRegion(ctx: CanvasRenderingContext2D, r: Region, zoom: number, glow = 0) {
  ctx.save();
  ctx.fillStyle = hexToRgba(r.color, 0.04 + glow * 0.1);
  roundRectPath(ctx, r.x, r.y, r.w, r.h, 12 / zoom);
  ctx.fill();
  if (glow > 0) {
    ctx.shadowColor = r.color;
    ctx.shadowBlur = 24 * glow;
  }
  ctx.setLineDash([10 / zoom, 7 / zoom]);
  ctx.lineWidth = (2 + glow * 1.5) / zoom;
  ctx.strokeStyle = hexToRgba(r.color, 0.85);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.setLineDash([]);
  // label tab
  const fs = 12.5 / zoom;
  ctx.font = `600 ${fs}px Inter, system-ui, sans-serif`;
  const label = r.name || 'Vùng không tên';
  const tw = ctx.measureText(label).width;
  const padX = 9 / zoom;
  const th = 22 / zoom;
  const lx = r.x;
  const ly = r.y - th - 6 / zoom;
  ctx.fillStyle = hexToRgba(r.color, 0.92);
  roundRectPath(ctx, lx, ly, tw + padX * 2 + 12 / zoom, th, 6 / zoom);
  ctx.fill();
  ctx.fillStyle = '#1b1f1d';
  ctx.beginPath();
  ctx.arc(lx + padX + 2.5 / zoom, ly + th / 2, 2.6 / zoom, 0, Math.PI * 2);
  ctx.fill();
  ctx.textBaseline = 'middle';
  ctx.fillText(label, lx + padX + 10 / zoom, ly + th / 2 + 0.5 / zoom);
  ctx.restore();
}

/* Background noise tile used when exporting PNGs */
let noiseTile: HTMLCanvasElement | null = null;
export function boardNoiseTile() {
  if (noiseTile) return noiseTile;
  const S = 160;
  noiseTile = document.createElement('canvas');
  noiseTile.width = noiseTile.height = S;
  const g = noiseTile.getContext('2d')!;
  const img = g.createImageData(S, S);
  const rnd = mulberry32(1234);
  for (let i = 0; i < img.data.length; i += 4) {
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
    img.data[i + 3] = rnd() * 16;
  }
  g.putImageData(img, 0, 0);
  return noiseTile;
}
