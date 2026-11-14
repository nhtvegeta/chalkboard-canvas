import type { Box, Doc } from './types';
import { boardNoiseTile, drawElements, ImageCache } from './render';
import { getBounds } from './geometry';
import { unionBox } from './utils';

export function contentBounds(doc: Doc, includeRegions = true): Box | null {
  let b: Box | null = null;
  for (const el of doc.elements) {
    if (el.type === 'stroke' && el.kind === 'erase') continue;
    b = unionBox(b, getBounds(el));
  }
  if (includeRegions) for (const r of doc.regions) b = unionBox(b, { x: r.x, y: r.y - 30, w: r.w, h: r.h + 30 });
  return b;
}

/** Render a world-space box of the document to a new canvas. */
export function renderBox(
  doc: Doc,
  box: Box,
  scale: number,
  images: ImageCache,
  background: string | null,
): HTMLCanvasElement {
  const MAX_DIM = 8192;
  const MAX_AREA = 48e6;
  let s = Math.min(scale, MAX_DIM / box.w, MAX_DIM / box.h);
  if (box.w * box.h * s * s > MAX_AREA) s = Math.sqrt(MAX_AREA / (box.w * box.h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(box.w * s));
  canvas.height = Math.max(1, Math.ceil(box.h * s));
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(s, 0, 0, s, -box.x * s, -box.y * s);
  drawElements({ ctx, zoom: s, px: s, view: box, editingId: null, images }, doc.elements);
  if (background) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'destination-over';
    const pat = ctx.createPattern(boardNoiseTile(), 'repeat');
    if (pat) {
      ctx.fillStyle = pat;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'source-over';
  }
  return canvas;
}

/**
 * Save blob with native "Save As" picker if available (supports choosing destination folder & custom filename),
 * otherwise falls back to standard download.
 */
export async function saveBlobWithPicker(blob: Blob, suggestedName: string, mimeType: string, extension: string): Promise<boolean> {
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName,
        types: [
          {
            description: extension.toUpperCase() + ' File',
            accept: { [mimeType]: ['.' + extension] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    } catch (err: any) {
      if (err.name === 'AbortError') return false; // user cancelled
      // fallback if picker fails
    }
  }

  downloadBlob(blob, suggestedName);
  return true;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function downloadCanvas(canvas: HTMLCanvasElement, filename: string): Promise<boolean> {
  return new Promise((res) =>
    canvas.toBlob(async (blob) => {
      if (!blob) return res(false);
      const saved = await saveBlobWithPicker(blob, filename, 'image/png', 'png');
      res(saved);
    }, 'image/png'),
  );
}

export function timestamp() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}
