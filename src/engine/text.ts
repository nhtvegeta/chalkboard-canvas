import type { FontKind } from './types';
import { roundRectPath } from './utils';

export const FONT_FAMILIES: Record<FontKind, string> = {
  hand: '"Caveat", "Patrick Hand", cursive',
  print: '"Patrick Hand", "Caveat", cursive',
  sans: '"Inter", "Segoe UI", system-ui, sans-serif',
};

export const FONT_LABELS: Record<FontKind, string> = {
  hand: 'Viết tay',
  print: 'Chữ in tay',
  sans: 'Sans-serif',
};

export const LINE_HEIGHT: Record<FontKind, number> = { hand: 1.2, print: 1.3, sans: 1.45 };

export function fontWeight(kind: FontKind, bold: boolean) {
  if (bold) return 700;
  return kind === 'hand' ? 500 : 400;
}

export function fontString(kind: FontKind, size: number, bold: boolean) {
  return `${fontWeight(kind, bold)} ${size}px ${FONT_FAMILIES[kind]}`;
}

let mctx: CanvasRenderingContext2D | null = null;
function measureCtx() {
  if (!mctx) mctx = document.createElement('canvas').getContext('2d')!;
  return mctx;
}

export type LineKind = 'text' | 'bullet' | 'check';
export interface Seg {
  text: string;
  bold: boolean;
  x: number;
}
export interface Line {
  segs: Seg[];
  kind: LineKind;
  checked: boolean;
  src: number;
  y: number;
  first: boolean;
  width: number;
}
export interface TextLayout {
  lines: Line[];
  lineHeight: number;
  indent: number;
  height: number;
  width: number;
}

export const CHECK_RE = /^\s*\[( |x|X)\]\s?/;
export const BULLET_RE = /^\s*[-*•]\s+/;

const cache = new Map<string, TextLayout>();
export function clearTextCache() {
  cache.clear();
}

export function parseLine(raw: string): { kind: LineKind; checked: boolean; body: string } {
  let m = raw.match(CHECK_RE);
  if (m) return { kind: 'check', checked: m[1] !== ' ', body: raw.slice(m[0].length) };
  m = raw.match(BULLET_RE);
  if (m) return { kind: 'bullet', checked: false, body: raw.slice(m[0].length) };
  return { kind: 'text', checked: false, body: raw };
}

/**
 * Lightweight rich-text layout: supports **bold**, "- " bullets and "[ ] / [x]" checklists,
 * with word wrapping to maxWidth. Results are memoised.
 */
export function layoutText(text: string, font: FontKind, size: number, maxWidth: number): TextLayout {
  const key = `${font}|${size}|${Math.round(maxWidth)}|${text}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const ctx = measureCtx();
  const lh = size * LINE_HEIGHT[font];
  const indent = size * 1.15;
  const lines: Line[] = [];
  let maxW = 0;

  text.split('\n').forEach((raw, src) => {
    const { kind, checked, body } = parseLine(raw);
    const offset = kind === 'text' ? 0 : indent;
    const avail = Math.max(size, maxWidth - offset);
    let cur: Line = { segs: [], kind, checked, src, y: 0, first: true, width: 0 };
    let x = 0;
    const pushLine = () => {
      cur.width = x + offset;
      maxW = Math.max(maxW, cur.width);
      lines.push(cur);
      cur = { segs: [], kind, checked, src, y: 0, first: false, width: 0 };
      x = 0;
    };
    body.split('**').forEach((part, pi) => {
      const bold = pi % 2 === 1;
      ctx.font = fontString(font, size, bold);
      for (const tok of part.split(/(\s+)/)) {
        if (!tok) continue;
        const isSpace = /^\s+$/.test(tok);
        if (isSpace && x === 0 && !cur.first) continue;
        const w = ctx.measureText(tok).width;
        if (isSpace && x + w > avail) continue;
        if (!isSpace && x > 0 && x + w > avail) pushLine();
        cur.segs.push({ text: tok, bold, x });
        x += w;
      }
    });
    pushLine();
  });

  lines.forEach((l, i) => (l.y = i * lh));
  const layout: TextLayout = { lines, lineHeight: lh, indent, height: lines.length * lh, width: maxW };
  if (cache.size > 3000) cache.clear();
  cache.set(key, layout);
  return layout;
}

export function drawTextLayout(
  ctx: CanvasRenderingContext2D,
  L: TextLayout,
  x: number,
  y: number,
  font: FontKind,
  size: number,
  fill: string | CanvasPattern,
  color: string,
) {
  const baseAlpha = ctx.globalAlpha;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  for (const line of L.lines) {
    const cy = y + line.y + L.lineHeight / 2;
    const offset = line.kind === 'text' ? 0 : L.indent;
    const done = line.kind === 'check' && line.checked;
    ctx.globalAlpha = baseAlpha * (done ? 0.55 : 1);
    if (line.first && line.kind === 'bullet') {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x + L.indent * 0.42, cy, Math.max(1.5, size * 0.09), 0, Math.PI * 2);
      ctx.fill();
    }
    if (line.first && line.kind === 'check') {
      const s = size * 0.58;
      const bx = x + L.indent * 0.1;
      const by = cy - s / 2;
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, size * 0.065);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      roundRectPath(ctx, bx, by, s, s, s * 0.2);
      ctx.stroke();
      if (line.checked) {
        ctx.beginPath();
        ctx.moveTo(bx + s * 0.2, by + s * 0.52);
        ctx.lineTo(bx + s * 0.42, by + s * 0.76);
        ctx.lineTo(bx + s * 0.84, by + s * 0.22);
        ctx.lineWidth = Math.max(1.2, size * 0.09);
        ctx.stroke();
      }
    }
    ctx.fillStyle = fill;
    for (const seg of line.segs) {
      ctx.font = fontString(font, size, seg.bold);
      ctx.fillText(seg.text, x + offset + seg.x, cy);
    }
    if (done && line.segs.length) {
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, size * 0.05);
      ctx.beginPath();
      ctx.moveTo(x + offset, cy + size * 0.04);
      ctx.lineTo(x + line.width, cy + size * 0.04);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = baseAlpha;
}

/** Returns source-line index of the checkbox at local coords, or -1. */
export function hitCheckbox(L: TextLayout, lx: number, ly: number) {
  for (const line of L.lines) {
    if (!line.first || line.kind !== 'check') continue;
    if (ly >= line.y && ly <= line.y + L.lineHeight && lx >= -4 && lx <= L.indent) return line.src;
  }
  return -1;
}

export function toggleCheckLine(text: string, src: number) {
  const lines = text.split('\n');
  const l = lines[src];
  if (l === undefined) return text;
  lines[src] = l.replace(CHECK_RE, (m) => (m.includes('[ ]') ? m.replace('[ ]', '[x]') : m.replace(/\[(x|X)\]/, '[ ]')));
  return lines.join('\n');
}

/** Plain text preview (strips markup) used by search results. */
export function plainText(text: string) {
  return text
    .split('\n')
    .map((l) => parseLine(l).body.replace(/\*\*/g, ''))
    .join(' · ');
}
