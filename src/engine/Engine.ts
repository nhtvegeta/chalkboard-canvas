import type { Box, Camera, Doc, El, ImageEl, Region, Settings, ShapeEl, StickyEl, StrokeEl, TextEl, Tool } from './types';
import { ACCENT, BOARD_COLORS, DEFAULT_SETTINGS, MAX_ZOOM, MIN_ZOOM, STICKY_PAD } from './constants';
import { boxContains, clamp, lerp, normBox, randomSeed, rotatePoint, slugify, uid } from './utils';
import { drawElement, drawElements, drawGrid, drawRegion, ImageCache, RenderCtx } from './render';
import { elementCorners, getBaseBox, getBounds, getElementCenter, getSelectBounds, hitTest, imageCorners, rawStrokeBox, translateEl } from './geometry';
import { hitCheckbox, layoutText, LINE_HEIGHT, toggleCheckLine } from './text';
import { storageGet, storageSet } from './storage';
import { contentBounds, downloadBlob, downloadCanvas, renderBox, saveBlobWithPicker, timestamp } from './exporter';
import { createWelcomeDoc } from './welcome';

type Mode = 'none' | 'draw' | 'shape' | 'pan' | 'move' | 'resize' | 'rotate' | 'marquee' | 'erase' | 'region' | 'pinch';
type HandleKind = 'nw' | 'ne' | 'sw' | 'se' | 'e' | 'rot' | 'p1' | 'p2';
interface Handle {
  kind: HandleKind;
  x: number;
  y: number;
}
interface Pt {
  x: number;
  y: number;
}

const STORAGE_KEY = 'board-v1';
const HISTORY_LIMIT = 200;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const TOOL_CURSORS: Record<Tool, string> = {
  select: 'default',
  hand: 'grab',
  chalk: 'crosshair',
  highlighter: 'crosshair',
  eraser: 'none',
  text: 'text',
  sticky: 'copy',
  rect: 'crosshair',
  ellipse: 'crosshair',
  line: 'crosshair',
  arrow: 'crosshair',
  region: 'crosshair',
};

const HANDLE_CURSORS: Record<HandleKind, string> = {
  nw: 'nwse-resize',
  se: 'nwse-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  e: 'ew-resize',
  rot: 'grab',
  p1: 'move',
  p2: 'move',
};

function sanitizeDoc(d: any): Doc {
  const types = new Set(['stroke', 'shape', 'text', 'sticky', 'image']);
  const elements: El[] = Array.isArray(d?.elements) ? d.elements.filter((e: any) => e && types.has(e.type) && e.id) : [];
  const regions: Region[] = Array.isArray(d?.regions)
    ? d.regions.filter((r: any) => r && r.id && [r.x, r.y, r.w, r.h].every(Number.isFinite))
    : [];
  return { elements, regions };
}

/** Resize a (possibly rotated) box by dragging one corner; opposite corner stays fixed. */
function resizeBox(b: Box, rot: number, handle: HandleKind, p: Pt, keepAspect: boolean, min = 10): Box {
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const lp = rotatePoint(p.x, p.y, cx, cy, -rot);
  const sx = handle === 'ne' || handle === 'se' ? 1 : -1;
  const sy = handle === 'sw' || handle === 'se' ? 1 : -1;
  const fx = cx - (sx * b.w) / 2;
  const fy = cy - (sy * b.h) / 2;
  let w = Math.max(min, (lp.x - fx) * sx);
  let h = Math.max(min, (lp.y - fy) * sy);
  if (keepAspect) {
    const r = b.w / b.h;
    if (w / h > r) h = w / r;
    else w = h * r;
  }
  const c = rotatePoint(fx + (sx * w) / 2, fy + (sy * h) / 2, cx, cy, rot);
  return { x: c.x - w / 2, y: c.y - h / 2, w, h };
}

export class Engine {
  doc: Doc = { elements: [], regions: [] };
  cam: Camera = { x: 0, y: 0, z: 1 };
  settings: Settings = { ...DEFAULT_SETTINGS };
  tool: Tool = 'chalk';
  selection: string[] = [];
  editingId: string | null = null;
  editDraft = '';
  pendingRegion: Box | null = null;
  thumbs = new Map<string, string>();
  saveState: 'idle' | 'saving' | 'saved' | 'error' = 'idle';
  loaded = false;
  W = 0;
  H = 0;
  dpr = 1;
  insetRight = 0;
  onToast: ((msg: string) => void) | null = null;

  private undoStack: Doc[] = [];
  private redoStack: Doc[] = [];
  private coalesceKey: string | null = null;
  private coalesceAt = 0;
  private editBase: Doc | null = null;

  private container: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private gridCanvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private gctx: CanvasRenderingContext2D | null = null;
  private scene = document.createElement('canvas');
  private sctx = this.scene.getContext('2d')!;
  readonly images = new ImageCache(() => {
    this.sceneDirty = true;
    this.requestRender();
    this.scheduleThumbs();
  });

  private version = 0;
  private listeners = new Set<() => void>();
  private raf = 0;
  private sceneDirty = true;
  private gridDirty = true;
  private camKey = '';

  private mode: Mode = 'none';
  private active: StrokeEl | ShapeEl | null = null;
  private beginDoc: Doc | null = null;
  private beginEl: El | null = null;
  private handle: HandleKind | null = null;
  private startWorld: Pt = { x: 0, y: 0 };
  private lastWorld: Pt = { x: 0, y: 0 };
  private lastScreen: Pt = { x: 0, y: 0 };
  private dragBox: Box | null = null;
  private pointers = new Map<number, Pt>();
  private pinch: { dist: number; mid: Pt; worldMid: Pt; cam: Camera } | null = null;
  private hover: Pt | null = null;
  private anim: { from: Camera; to: Camera; t0: number; dur: number } | null = null;
  private wheelZoom: { target: number; sx: number; sy: number } | null = null;
  private highlight: { id: string; until: number } | null = null;
  private spaceDown = false;
  private cleanup: Array<() => void> = [];
  private saveTimer = 0;
  private thumbTimer = 0;

  /* ================================================================ */
  /* Subscription (React bridge)                                       */
  /* ================================================================ */
  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  };
  getVersion = () => this.version;
  private emit() {
    this.version++;
    this.listeners.forEach((l) => l());
  }
  private toast(msg: string) {
    this.onToast?.(msg);
  }

  /* ================================================================ */
  /* Lifecycle                                                         */
  /* ================================================================ */
  mount(container: HTMLElement, gridCanvas: HTMLCanvasElement, canvas: HTMLCanvasElement) {
    this.unmount();
    this.container = container;
    this.gridCanvas = gridCanvas;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.gctx = gridCanvas.getContext('2d');
    const on = (t: EventTarget, type: string, fn: (e: any) => void, opts?: AddEventListenerOptions) => {
      t.addEventListener(type, fn, opts);
      this.cleanup.push(() => t.removeEventListener(type, fn, opts));
    };
    on(canvas, 'pointerdown', this.onPointerDown);
    on(canvas, 'pointermove', this.onPointerMove);
    on(canvas, 'pointerup', this.onPointerUp);
    on(canvas, 'pointercancel', this.onPointerUp);
    on(canvas, 'pointerleave', this.onPointerLeave);
    on(canvas, 'wheel', this.onWheel, { passive: false });
    on(canvas, 'dblclick', this.onDblClick);
    on(canvas, 'contextmenu', (e: Event) => e.preventDefault());
    const ro = new ResizeObserver(() => this.resize());
    ro.observe(container);
    this.cleanup.push(() => ro.disconnect());
    this.resize();
    this.cam = { x: this.W / 2, y: this.H / 2, z: 1 };
    this.updateCursor();
  }

  unmount() {
    this.cleanup.forEach((f) => f());
    this.cleanup = [];
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  resize() {
    if (!this.container || !this.canvas || !this.gridCanvas) return;
    const r = this.container.getBoundingClientRect();
    this.W = Math.max(1, r.width);
    this.H = Math.max(1, r.height);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    for (const c of [this.canvas, this.gridCanvas, this.scene]) {
      c.width = Math.round(this.W * this.dpr);
      c.height = Math.round(this.H * this.dpr);
    }
    this.sceneDirty = this.gridDirty = true;
    this.camKey = '';
    this.requestRender();
    this.emit();
  }

  async load() {
    let data: any;
    try {
      data = await storageGet<any>(STORAGE_KEY);
    } catch {
      data = undefined;
    }
    if (data?.doc) {
      this.doc = sanitizeDoc(data.doc);
      const c = data.cam;
      if (c && [c.x, c.y, c.z].every(Number.isFinite)) this.cam = { x: c.x, y: c.y, z: clamp(c.z, MIN_ZOOM, MAX_ZOOM) };
      this.settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
      if (data.tool) this.tool = data.tool;
    } else {
      this.doc = createWelcomeDoc();
      const b = contentBounds(this.doc);
      if (b) this.cam = this.camForBox(b, 1, 0.08);
    }
    this.loaded = true;
    this.sceneDirty = this.gridDirty = true;
    this.updateCursor();
    this.scheduleThumbs(50);
    this.scheduleSave(300);
    this.emit();
    this.requestRender();
  }

  /** Force a full redraw (e.g. after web fonts finished loading). */
  invalidate() {
    this.sceneDirty = true;
    this.requestRender();
    this.scheduleThumbs();
    this.emit();
  }

  setInsetRight(px: number) {
    this.insetRight = px;
  }

  /* ================================================================ */
  /* Coordinates                                                       */
  /* ================================================================ */
  screenToWorld(sx: number, sy: number): Pt {
    return { x: (sx - this.cam.x) / this.cam.z, y: (sy - this.cam.y) / this.cam.z };
  }
  worldToScreen(wx: number, wy: number): Pt {
    return { x: wx * this.cam.z + this.cam.x, y: wy * this.cam.z + this.cam.y };
  }
  private local(e: { clientX: number; clientY: number }): Pt {
    const r = this.canvas!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  private viewBox(): Box {
    const { cam, W, H } = this;
    return { x: -cam.x / cam.z, y: -cam.y / cam.z, w: W / cam.z, h: H / cam.z };
  }
  private viewCenter(): Pt {
    return { x: (this.W - this.insetRight) / 2, y: this.H / 2 };
  }

  /* ================================================================ */
  /* History                                                           */
  /* ================================================================ */
  private pushUndo(prev: Doc) {
    this.undoStack.push(prev);
    if (this.undoStack.length > HISTORY_LIMIT) this.undoStack.shift();
    this.redoStack = [];
    this.coalesceKey = null;
  }
  private pushUndoCoalesced(key: string) {
    const now = performance.now();
    if (this.coalesceKey === key && now - this.coalesceAt < 1000) {
      this.coalesceAt = now;
      return;
    }
    this.pushUndo(this.doc);
    this.coalesceKey = key;
    this.coalesceAt = now;
  }
  get canUndo() {
    return this.undoStack.length > 0;
  }
  get canRedo() {
    return this.redoStack.length > 0;
  }
  undo() {
    this.commitEdit();
    const prev = this.undoStack.pop();
    if (!prev) return;
    this.redoStack.push(this.doc);
    this.doc = prev;
    this.coalesceKey = null;
    this.afterHistory();
  }
  redo() {
    this.commitEdit();
    const next = this.redoStack.pop();
    if (!next) return;
    this.undoStack.push(this.doc);
    this.doc = next;
    this.coalesceKey = null;
    this.afterHistory();
  }
  private afterHistory() {
    const ids = new Set(this.doc.elements.map((e) => e.id));
    this.selection = this.selection.filter((id) => ids.has(id));
    this.docChanged();
  }

  setDoc(next: Doc, history = true) {
    if (history) this.pushUndo(this.doc);
    this.doc = next;
    const ids = new Set(next.elements.map((e) => e.id));
    this.selection = this.selection.filter((id) => ids.has(id));
    this.docChanged();
  }

  private docChanged() {
    this.sceneDirty = true;
    this.scheduleSave();
    this.scheduleThumbs();
    this.emit();
    this.requestRender();
  }

  getEl(id: string) {
    return this.doc.elements.find((e) => e.id === id);
  }
  private replaceEl(el: El) {
    this.doc = { ...this.doc, elements: this.doc.elements.map((e) => (e.id === el.id ? el : e)) };
    this.sceneDirty = true;
  }

  /* ================================================================ */
  /* Tools & settings                                                  */
  /* ================================================================ */
  setTool(t: Tool) {
    this.commitEdit();
    if (this.pendingRegion) this.pendingRegion = null;
    this.tool = t;
    if (t !== 'select') this.selection = [];
    this.updateCursor();
    this.scheduleSave(800);
    this.emit();
    this.requestRender();
  }

  setSettings(partial: Partial<Settings>) {
    this.settings = { ...this.settings, ...partial };
    if ('grid' in partial) this.gridDirty = true;
    if ('board' in partial) this.scheduleThumbs(100);
    this.applyStyleToSelection(partial);
    this.scheduleSave(600);
    this.emit();
    this.requestRender();
  }

  cycleGrid() {
    const order = ['dots', 'squares', 'lines', 'none'] as const;
    const i = order.indexOf(this.settings.grid);
    this.setSettings({ grid: order[(i + 1) % order.length] });
  }

  private applyStyleToSelection(p: Partial<Settings>) {
    const ids = new Set(this.editingId ? [this.editingId] : this.tool === 'select' ? this.selection : []);
    if (!ids.size) return;
    let changed = false;
    const elements = this.doc.elements.map((el) => {
      if (!ids.has(el.id)) return el;
      let n: El = el;
      const chalkish = (el.type === 'stroke' && el.kind === 'chalk') || el.type === 'shape';
      if (p.chalkColor && (chalkish || el.type === 'text')) n = { ...n, color: p.chalkColor } as El;
      if (p.chalkSize != null && chalkish) n = { ...n, size: p.chalkSize } as El;
      if (el.type === 'stroke' && el.kind === 'highlighter') {
        if (p.hlColor) n = { ...n, color: p.hlColor } as El;
        if (p.hlSize != null) n = { ...n, size: p.hlSize } as El;
      }
      if (p.font && (el.type === 'text' || el.type === 'sticky')) n = { ...n, font: p.font } as El;
      if (p.fontSize != null && el.type === 'text') n = { ...n, fontSize: p.fontSize } as El;
      if (p.stickyColor && el.type === 'sticky') n = { ...n, color: p.stickyColor } as El;
      if (n !== el) changed = true;
      return n;
    });
    if (!changed) return;
    if (!this.editingId) this.pushUndoCoalesced('style');
    this.doc = { ...this.doc, elements };
    this.docChanged();
  }

  setSpace(down: boolean) {
    if (this.spaceDown === down) return;
    this.spaceDown = down;
    this.updateCursor();
  }

  private updateCursor(hoverCursor?: string) {
    if (!this.canvas) return;
    let c = TOOL_CURSORS[this.tool];
    if (this.mode === 'pan') c = 'grabbing';
    else if (this.spaceDown) c = 'grab';
    else if (this.mode === 'move') c = 'move';
    else if (this.mode === 'rotate') c = 'grabbing';
    else if (hoverCursor) c = hoverCursor;
    this.canvas.style.cursor = c;
  }

  /* ================================================================ */
  /* Selection operations                                              */
  /* ================================================================ */
  selectAll() {
    this.setTool('select');
    this.selection = this.doc.elements.filter((e) => !(e.type === 'stroke' && e.kind === 'erase')).map((e) => e.id);
    this.emit();
    this.requestRender();
  }
  deleteSelected() {
    if (!this.selection.length) return;
    const ids = new Set(this.selection);
    this.selection = [];
    this.setDoc({ ...this.doc, elements: this.doc.elements.filter((e) => !ids.has(e.id)) });
  }
  duplicateSelected() {
    if (!this.selection.length) return;
    const ids = new Set(this.selection);
    const d = 24 / this.cam.z;
    const copies = this.doc.elements.filter((e) => ids.has(e.id)).map((e) => ({ ...translateEl(e, d, d), id: uid() }) as El);
    this.setDoc({ ...this.doc, elements: [...this.doc.elements, ...copies] });
    this.selection = copies.map((c) => c.id);
    this.emit();
  }
  reorderSelected(dir: 'front' | 'back') {
    if (!this.selection.length) return;
    const ids = new Set(this.selection);
    const sel = this.doc.elements.filter((e) => ids.has(e.id));
    const rest = this.doc.elements.filter((e) => !ids.has(e.id));
    this.setDoc({ ...this.doc, elements: dir === 'front' ? [...rest, ...sel] : [...sel, ...rest] });
  }
  escape() {
    if (this.editingId) return this.commitEdit();
    if (this.pendingRegion) return this.cancelRegion();
    this.selection = [];
    this.emit();
    this.requestRender();
  }
  clearBoard() {
    this.commitEdit();
    this.selection = [];
    this.setDoc({ elements: [], regions: [] });
    this.thumbs.clear();
  }

  /* ================================================================ */
  /* Text editing                                                      */
  /* ================================================================ */
  getEditingEl(): TextEl | StickyEl | null {
    if (!this.editingId) return null;
    const el = this.getEl(this.editingId);
    return el && (el.type === 'text' || el.type === 'sticky') ? el : null;
  }

  startEdit(id: string, base?: Doc) {
    const el = this.getEl(id);
    if (!el || (el.type !== 'text' && el.type !== 'sticky')) return;
    this.editingId = id;
    this.editDraft = el.text;
    this.editBase = base ?? this.doc;
    this.selection = [id];
    this.sceneDirty = true;
    this.emit();
    this.requestRender();
  }

  commitEdit() {
    const id = this.editingId;
    if (!id) return;
    const base = this.editBase ?? this.doc;
    this.editingId = null;
    this.editBase = null;
    const el = this.getEl(id) as TextEl | StickyEl | undefined;
    if (!el) {
      this.sceneDirty = true;
      this.emit();
      return;
    }
    const text = this.editDraft.replace(/\s+$/, '');
    const before = base.elements.find((e) => e.id === id) as TextEl | StickyEl | undefined;
    const isNew = !before;
    if (el.type === 'text' && !text.trim()) {
      this.selection = [];
      this.doc = { ...this.doc, elements: this.doc.elements.filter((e) => e.id !== id) };
      if (!isNew) this.pushUndo(base);
      return this.docChanged();
    }
    this.doc = { ...this.doc, elements: this.doc.elements.map((e) => (e.id === id ? ({ ...e, text } as El) : e)) };
    if (isNew || text !== before!.text || this.doc !== base) {
      // compare relevant content to avoid empty history entries
      const now = this.getEl(id) as TextEl | StickyEl;
      const same = before && JSON.stringify(before) === JSON.stringify(now);
      if (!same) this.pushUndo(base);
    }
    this.docChanged();
  }

  updateElement(id: string, patch: Partial<TextEl> | Partial<StickyEl>) {
    const el = this.getEl(id);
    if (!el) return;
    if (!this.editingId) this.pushUndoCoalesced('patch-' + id);
    this.replaceEl({ ...el, ...patch } as El);
    this.docChanged();
  }

  private createText(w: Pt) {
    const s = this.settings;
    const el: TextEl = {
      id: uid(),
      type: 'text',
      x: w.x,
      y: w.y - (s.fontSize * LINE_HEIGHT[s.font]) / 2,
      w: Math.max(200, s.fontSize * 12),
      text: '',
      color: s.chalkColor,
      fontSize: s.fontSize,
      font: s.font,
    };
    const base = this.doc;
    this.doc = { ...this.doc, elements: [...this.doc.elements, el] };
    this.startEdit(el.id, base);
  }

  private createSticky(w: Pt) {
    const el: StickyEl = {
      id: uid(),
      type: 'sticky',
      x: w.x - 110,
      y: w.y - 110,
      w: 220,
      h: 220,
      text: '',
      color: this.settings.stickyColor,
      font: this.settings.font === 'sans' ? 'sans' : 'hand',
      fontSize: 26,
    };
    const base = this.doc;
    this.doc = { ...this.doc, elements: [...this.doc.elements, el] };
    this.startEdit(el.id, base);
  }

  private checkboxAt(el: El, w: Pt) {
    let pt = w;
    if (el.rotation) {
      const { cx, cy } = getElementCenter(el);
      pt = rotatePoint(w.x, w.y, cx, cy, -el.rotation);
    }
    if (el.type === 'text') {
      return hitCheckbox(layoutText(el.text, el.font, el.fontSize, el.w), pt.x - el.x, pt.y - el.y);
    }
    if (el.type === 'sticky') {
      const L = layoutText(el.text, el.font, el.fontSize, el.w - STICKY_PAD * 2);
      return hitCheckbox(L, pt.x - el.x - STICKY_PAD, pt.y - el.y - STICKY_PAD);
    }
    return -1;
  }

  /* ================================================================ */
  /* Regions (spatial bookmarks)                                       */
  /* ================================================================ */
  confirmRegion(name: string, color: string) {
    const b = this.pendingRegion;
    if (!b) return;
    const r: Region = { id: uid(), name: name.trim() || 'Vùng không tên', color, ...b, createdAt: Date.now() };
    this.pendingRegion = null;
    this.setDoc({ ...this.doc, regions: [...this.doc.regions, r] });
    this.scheduleThumbs(30);
    this.toast(`Đã lưu vùng “${r.name}”`);
  }
  cancelRegion() {
    this.pendingRegion = null;
    this.emit();
    this.requestRender();
  }
  updateRegion(id: string, patch: Partial<Region>) {
    this.pushUndoCoalesced('region-' + id);
    this.doc = { ...this.doc, regions: this.doc.regions.map((r) => (r.id === id ? { ...r, ...patch } : r)) };
    this.docChanged();
  }
  deleteRegion(id: string) {
    this.setDoc({ ...this.doc, regions: this.doc.regions.filter((r) => r.id !== id) });
    this.thumbs.delete(id);
  }
  flyToRegion(id: string) {
    const r = this.doc.regions.find((x) => x.id === id);
    if (!r) return;
    this.flyToBox({ x: r.x, y: r.y - 34, w: r.w, h: r.h + 34 }, 6, 0.1);
    this.highlight = { id, until: performance.now() + 2200 };
  }
  flyToElement(id: string) {
    const el = this.getEl(id);
    if (!el) return;
    this.setTool('select');
    this.selection = [id];
    this.flyToBox(getBounds(el), 1.6, 0.25);
    this.emit();
  }

  /* ================================================================ */
  /* Camera                                                            */
  /* ================================================================ */
  private camChanged() {
    this.scheduleSave(900);
    this.emit();
    this.requestRender();
  }

  private zoomAt(sx: number, sy: number, newZ: number) {
    const z = clamp(newZ, MIN_ZOOM, MAX_ZOOM);
    const k = z / this.cam.z;
    this.cam = { x: sx - (sx - this.cam.x) * k, y: sy - (sy - this.cam.y) * k, z };
    this.camChanged();
  }

  zoomBy(factor: number) {
    const c = this.viewCenter();
    this.anim = null;
    const base = this.wheelZoom ? this.wheelZoom.target : Math.log(this.cam.z);
    this.wheelZoom = { target: clamp(base + Math.log(factor), Math.log(MIN_ZOOM), Math.log(MAX_ZOOM)), sx: c.x, sy: c.y };
    this.requestRender();
  }

  setZoom100() {
    const c = this.viewCenter();
    const w = this.screenToWorld(c.x, c.y);
    this.animateCamera({ x: c.x - w.x, y: c.y - w.y, z: 1 });
  }

  resetView() {
    const c = this.viewCenter();
    this.animateCamera({ x: c.x, y: c.y, z: 1 });
  }

  zoomToFit() {
    const b = contentBounds(this.doc);
    if (!b) return this.resetView();
    this.flyToBox(b, 2, 0.08);
  }

  private camForBox(b: Box, maxZoom: number, pad: number): Camera {
    const vw = this.W - this.insetRight;
    const vh = this.H;
    const z = clamp(Math.min((vw * (1 - 2 * pad)) / Math.max(b.w, 1), (vh * (1 - 2 * pad)) / Math.max(b.h, 1)), MIN_ZOOM, maxZoom);
    return { x: vw / 2 - (b.x + b.w / 2) * z, y: vh / 2 - (b.y + b.h / 2) * z, z };
  }

  flyToBox(b: Box, maxZoom = 4, pad = 0.12) {
    this.animateCamera(this.camForBox(b, maxZoom, pad));
  }

  animateCamera(to: Camera, dur = 750) {
    this.wheelZoom = null;
    this.anim = { from: { ...this.cam }, to, t0: performance.now(), dur };
    this.requestRender();
  }

  private stepAnim(now: number): boolean {
    const a = this.anim;
    if (!a) return false;
    const t = clamp((now - a.t0) / a.dur, 0, 1);
    const e = easeInOut(t);
    const vc = this.viewCenter();
    const c0 = { x: (vc.x - a.from.x) / a.from.z, y: (vc.y - a.from.y) / a.from.z };
    const c1 = { x: (vc.x - a.to.x) / a.to.z, y: (vc.y - a.to.y) / a.to.z };
    let z = Math.exp(lerp(Math.log(a.from.z), Math.log(a.to.z), e));
    // gentle "zoom out → fly → zoom in" when travelling far
    const dist = Math.hypot(c1.x - c0.x, c1.y - c0.y);
    const viewSpan = Math.max(this.W, this.H) / Math.sqrt(a.from.z * a.to.z);
    const dip = clamp((dist / viewSpan) * 0.35, 0, 0.55);
    z *= 1 - dip * Math.sin(Math.PI * e);
    const cx = lerp(c0.x, c1.x, e);
    const cy = lerp(c0.y, c1.y, e);
    this.cam = t >= 1 ? { ...a.to } : { x: vc.x - cx * z, y: vc.y - cy * z, z };
    if (t >= 1) this.anim = null;
    this.camChanged();
    return t < 1;
  }

  private stepWheel(): boolean {
    const wz = this.wheelZoom;
    if (!wz) return false;
    const cur = Math.log(this.cam.z);
    let next = cur + (wz.target - cur) * 0.28;
    if (Math.abs(wz.target - next) < 0.002) {
      next = wz.target;
      this.wheelZoom = null;
    }
    this.zoomAt(wz.sx, wz.sy, Math.exp(next));
    return !!this.wheelZoom;
  }

  /* ================================================================ */
  /* Pointer input                                                     */
  /* ================================================================ */
  private hitTop(w: Pt, tol: number, filter?: (el: El) => boolean): El | null {
    const els = this.doc.elements;
    for (let i = els.length - 1; i >= 0; i--) {
      const el = els[i];
      if (el.type === 'stroke' && el.kind === 'erase') continue;
      if (filter && !filter(el)) continue;
      if (hitTest(el, w.x, w.y, tol)) return el;
    }
    return null;
  }

  private getHandles(el: El): Handle[] {
    const z = this.cam.z;
    const boxWithRot = (b: Box, rot: number): Handle[] => {
      const cx = b.x + b.w / 2;
      const cy = b.y + b.h / 2;
      return [
        { kind: 'nw', ...rotatePoint(b.x, b.y, cx, cy, rot) },
        { kind: 'ne', ...rotatePoint(b.x + b.w, b.y, cx, cy, rot) },
        { kind: 'sw', ...rotatePoint(b.x, b.y + b.h, cx, cy, rot) },
        { kind: 'se', ...rotatePoint(b.x + b.w, b.y + b.h, cx, cy, rot) },
        { kind: 'rot', ...rotatePoint(cx, b.y - 30 / z, cx, cy, rot) },
      ];
    };

    switch (el.type) {
      case 'image':
        return boxWithRot(el, el.rotation);
      case 'sticky':
        return boxWithRot(el, el.rotation || 0);
      case 'text': {
        const b = getBaseBox(el);
        const cx = b.x + b.w / 2;
        const cy = b.y + b.h / 2;
        const r = el.rotation || 0;
        return [
          { kind: 'e', ...rotatePoint(b.x + b.w, b.y + b.h / 2, cx, cy, r) },
          { kind: 'se', ...rotatePoint(b.x + b.w, b.y + b.h, cx, cy, r) },
          { kind: 'rot', ...rotatePoint(cx, b.y - 30 / z, cx, cy, r) },
        ];
      }
      case 'shape':
        if (el.shape === 'line' || el.shape === 'arrow') {
          const cx = (el.x1 + el.x2) / 2;
          const cy = (el.y1 + el.y2) / 2;
          const r = el.rotation || 0;
          const minY = Math.min(el.y1, el.y2);
          return [
            { kind: 'p1', ...rotatePoint(el.x1, el.y1, cx, cy, r) },
            { kind: 'p2', ...rotatePoint(el.x2, el.y2, cx, cy, r) },
            { kind: 'rot', ...rotatePoint(cx, minY - 30 / z, cx, cy, r) },
          ];
        }
        return boxWithRot(normBox(el.x1, el.y1, el.x2, el.y2), el.rotation || 0);
      case 'stroke':
        return el.kind === 'erase' ? [] : boxWithRot(rawStrokeBox(el), el.rotation || 0);
    }
  }

  private hitHandle(el: El, w: Pt): Handle | null {
    const r = 9 / this.cam.z;
    return this.getHandles(el).find((h) => Math.hypot(h.x - w.x, h.y - w.y) <= r) ?? null;
  }

  private onPointerDown = (e: PointerEvent) => {
    const s = this.local(e);
    this.pointers.set(e.pointerId, s);
    try {
      this.canvas!.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    this.anim = null;
    this.wheelZoom = null;
    if (this.pointers.size === 2) return this.beginPinch();
    if (this.pointers.size > 2) return;
    if (this.editingId) {
      this.commitEdit();
      return;
    }
    if (this.pendingRegion) this.cancelRegion();
    const w = this.screenToWorld(s.x, s.y);
    this.startWorld = w;
    this.lastWorld = w;
    this.lastScreen = s;

    if (e.button === 1 || this.spaceDown || this.tool === 'hand' || (e.button === 2 && this.tool !== 'select')) {
      this.mode = 'pan';
      this.updateCursor();
      return;
    }
    if (e.button !== 0) return;
    const tol = 6 / this.cam.z;
    const st = this.settings;

    switch (this.tool) {
      case 'chalk':
        this.startStroke(w, 'chalk', st.chalkColor, st.chalkSize);
        break;
      case 'highlighter':
        this.startStroke(w, 'highlighter', st.hlColor, st.hlSize);
        break;
      case 'eraser':
        if (st.eraserMode === 'pixel') this.startStroke(w, 'erase', '#000', st.eraserSize);
        else {
          this.mode = 'erase';
          this.beginDoc = this.doc;
          this.eraseSegment(w, w);
        }
        break;
      case 'rect':
      case 'ellipse':
      case 'line':
      case 'arrow':
        this.active = {
          id: uid(), type: 'shape', shape: this.tool,
          x1: w.x, y1: w.y, x2: w.x, y2: w.y,
          color: st.chalkColor, size: st.chalkSize, seed: randomSeed(),
        };
        this.mode = 'shape';
        break;
      case 'text': {
        const hit = this.hitTop(w, tol, (el) => el.type === 'text' || el.type === 'sticky');
        if (hit) {
          const idx = this.checkboxAt(hit, w);
          if (idx >= 0) this.toggleCheck(hit, idx);
          else this.startEdit(hit.id);
        } else this.createText(w);
        break;
      }
      case 'sticky':
        this.createSticky(w);
        break;
      case 'region':
        this.mode = 'region';
        this.dragBox = { x: w.x, y: w.y, w: 0, h: 0 };
        break;
      case 'select':
        this.selectDown(e, w, tol);
        break;
    }
    this.requestRender();
  };

  private startStroke(w: Pt, kind: StrokeEl['kind'], color: string, size: number) {
    this.active = { id: uid(), type: 'stroke', kind, points: [w.x, w.y], color, size, seed: randomSeed() };
    this.mode = 'draw';
  }

  private toggleCheck(el: El, idx: number) {
    if (el.type !== 'text' && el.type !== 'sticky') return;
    this.setDoc({
      ...this.doc,
      elements: this.doc.elements.map((x) => (x.id === el.id ? ({ ...el, text: toggleCheckLine(el.text, idx) } as El) : x)),
    });
  }

  private selectDown(e: PointerEvent, w: Pt, tol: number) {
    if (this.selection.length === 1) {
      const el = this.getEl(this.selection[0]);
      const h = el && this.hitHandle(el, w);
      if (el && h) {
        this.mode = h.kind === 'rot' ? 'rotate' : 'resize';
        this.handle = h.kind;
        this.beginEl = el;
        this.beginDoc = this.doc;
        return;
      }
    }
    const hit = this.hitTop(w, tol);
    if (hit) {
      const idx = this.checkboxAt(hit, w);
      if (idx >= 0) return this.toggleCheck(hit, idx);
      if (e.shiftKey) {
        this.selection = this.selection.includes(hit.id)
          ? this.selection.filter((id) => id !== hit.id)
          : [...this.selection, hit.id];
      } else if (!this.selection.includes(hit.id)) this.selection = [hit.id];
      this.mode = 'move';
      this.beginDoc = this.doc;
      this.updateCursor();
    } else {
      if (!e.shiftKey) this.selection = [];
      this.mode = 'marquee';
      this.dragBox = { x: w.x, y: w.y, w: 0, h: 0 };
    }
    this.emit();
  }

  private onPointerMove = (e: PointerEvent) => {
    const s = this.local(e);
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, s);
    const w = this.screenToWorld(s.x, s.y);
    this.hover = w;
    if (this.mode === 'pinch') return this.updatePinch();

    switch (this.mode) {
      case 'pan':
        this.cam = { ...this.cam, x: this.cam.x + s.x - this.lastScreen.x, y: this.cam.y + s.y - this.lastScreen.y };
        this.camChanged();
        break;
      case 'draw': {
        const pts = (this.active as StrokeEl).points;
        const minD = 1.1 / this.cam.z;
        const evs = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
        const samples = evs.length > 1 ? evs.map((ce) => { const cs = this.local(ce); return this.screenToWorld(cs.x, cs.y); }) : [w];
        for (const p of samples) {
          const lx = pts[pts.length - 2];
          const ly = pts[pts.length - 1];
          if (Math.hypot(p.x - lx, p.y - ly) >= minD) pts.push(p.x, p.y);
        }
        break;
      }
      case 'shape': {
        const a = this.active as ShapeEl;
        let x2 = w.x;
        let y2 = w.y;
        if (e.shiftKey) {
          const dx = w.x - a.x1;
          const dy = w.y - a.y1;
          if (a.shape === 'rect' || a.shape === 'ellipse') {
            const m = Math.max(Math.abs(dx), Math.abs(dy));
            x2 = a.x1 + Math.sign(dx || 1) * m;
            y2 = a.y1 + Math.sign(dy || 1) * m;
          } else {
            const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
            const len = Math.hypot(dx, dy);
            x2 = a.x1 + Math.cos(ang) * len;
            y2 = a.y1 + Math.sin(ang) * len;
          }
        }
        a.x2 = x2;
        a.y2 = y2;
        break;
      }
      case 'erase':
        this.eraseSegment(this.lastWorld, w);
        break;
      case 'move': {
        const dx = w.x - this.startWorld.x;
        const dy = w.y - this.startWorld.y;
        const ids = new Set(this.selection);
        const base = this.beginDoc!;
        this.doc = { ...base, elements: base.elements.map((el) => (ids.has(el.id) ? translateEl(el, dx, dy) : el)) };
        this.sceneDirty = true;
        break;
      }
      case 'resize':
        this.doResize(w, e.shiftKey);
        break;
      case 'rotate': {
        const b = this.beginEl!;
        const { cx, cy } = getElementCenter(b);
        let ang = Math.atan2(w.y - cy, w.x - cx) + Math.PI / 2;
        if (e.shiftKey) ang = Math.round(ang / (Math.PI / 12)) * (Math.PI / 12);
        this.replaceEl({ ...b, rotation: ang });
        break;
      }
      case 'marquee':
      case 'region':
        this.dragBox = normBox(this.startWorld.x, this.startWorld.y, w.x, w.y);
        break;
      case 'none':
        if (this.tool === 'select' && !this.spaceDown) this.updateHoverCursor(w);
        break;
    }
    this.lastScreen = s;
    this.lastWorld = w;
    if (this.mode !== 'none' || this.tool === 'eraser' || this.tool === 'chalk' || this.tool === 'highlighter') this.requestRender();
  };

  private updateHoverCursor(w: Pt) {
    if (this.selection.length === 1) {
      const el = this.getEl(this.selection[0]);
      const h = el && this.hitHandle(el, w);
      if (h) return this.updateCursor(HANDLE_CURSORS[h.kind]);
    }
    const hit = this.hitTop(w, 6 / this.cam.z);
    if (hit && this.checkboxAt(hit, w) >= 0) return this.updateCursor('pointer');
    this.updateCursor(hit ? 'move' : undefined);
  }

  private doResize(w: Pt, shift: boolean) {
    const b = this.beginEl!;
    const h = this.handle!;
    let next: El = b;
    switch (b.type) {
      case 'image':
        next = { ...b, ...resizeBox(b, b.rotation, h, w, !shift, 16) };
        break;
      case 'sticky':
        next = { ...b, ...resizeBox(b, b.rotation || 0, h, w, shift, 80) };
        break;
      case 'shape':
        if (h === 'p1') {
          if (b.rotation) {
            const { cx, cy } = getElementCenter(b);
            const lp = rotatePoint(w.x, w.y, cx, cy, -b.rotation);
            next = { ...b, x1: lp.x, y1: lp.y };
          } else {
            next = { ...b, x1: w.x, y1: w.y };
          }
        } else if (h === 'p2') {
          if (b.rotation) {
            const { cx, cy } = getElementCenter(b);
            const lp = rotatePoint(w.x, w.y, cx, cy, -b.rotation);
            next = { ...b, x2: lp.x, y2: lp.y };
          } else {
            next = { ...b, x2: w.x, y2: w.y };
          }
        } else {
          const nb = resizeBox(normBox(b.x1, b.y1, b.x2, b.y2), b.rotation || 0, h, w, shift, 4);
          next = { ...b, x1: nb.x, y1: nb.y, x2: nb.x + nb.w, y2: nb.y + nb.h };
        }
        break;
      case 'stroke': {
        const rb = rawStrokeBox(b);
        const nb = resizeBox(rb, b.rotation || 0, h, w, !shift, 4);
        const sx = nb.w / rb.w;
        const sy = nb.h / rb.h;
        next = { ...b, points: b.points.map((v, i) => (i % 2 ? nb.y + (v - rb.y) * sy : nb.x + (v - rb.x) * sx)) };
        break;
      }
      case 'text': {
        const rot = b.rotation || 0;
        let pt = w;
        if (rot) {
          const { cx, cy } = getElementCenter(b);
          pt = rotatePoint(w.x, w.y, cx, cy, -rot);
        }
        if (h === 'e') next = { ...b, w: Math.max(b.fontSize * 2, pt.x - b.x) };
        else {
          const bb = getBaseBox(b);
          const k = clamp((pt.x - b.x) / bb.w, 0.1, 20);
          next = { ...b, fontSize: clamp(b.fontSize * k, 6, 1200), w: b.w * k };
        }
        break;
      }
    }
    this.replaceEl(next);
  }

  private eraseSegment(a: Pt, b: Pt) {
    const r = this.settings.eraserSize / 2;
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(1, Math.ceil(d / (r * 0.5)));
    const kill = new Set<string>();
    for (let i = 0; i <= steps; i++) {
      const px = lerp(a.x, b.x, i / steps);
      const py = lerp(a.y, b.y, i / steps);
      for (const el of this.doc.elements) {
        if (kill.has(el.id) || (el.type === 'stroke' && el.kind === 'erase')) continue;
        if (hitTest(el, px, py, r, true)) kill.add(el.id);
      }
    }
    if (kill.size) {
      this.doc = { ...this.doc, elements: this.doc.elements.filter((e) => !kill.has(e.id)) };
      this.sceneDirty = true;
    }
  }

  private onPointerUp = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId);
    if (this.mode === 'pinch') {
      if (this.pointers.size < 2) {
        this.pinch = null;
        this.mode = 'none';
      }
      return;
    }
    switch (this.mode) {
      case 'draw':
        if (this.active) this.setDoc({ ...this.doc, elements: [...this.doc.elements, this.active] });
        break;
      case 'shape': {
        const a = this.active as ShapeEl;
        if (a && Math.hypot(a.x2 - a.x1, a.y2 - a.y1) * this.cam.z > 4) this.setDoc({ ...this.doc, elements: [...this.doc.elements, a] });
        break;
      }
      case 'erase':
      case 'move':
      case 'resize':
      case 'rotate':
        if (this.beginDoc && this.doc !== this.beginDoc) {
          this.pushUndo(this.beginDoc);
          this.docChanged();
        }
        break;
      case 'marquee': {
        const box = this.dragBox;
        if (box && box.w * this.cam.z > 3 && box.h * this.cam.z > 3) {
          const ids = this.doc.elements
            .filter((el) => !(el.type === 'stroke' && el.kind === 'erase') && boxContains(box, getSelectBounds(el)))
            .map((el) => el.id);
          this.selection = e.shiftKey ? Array.from(new Set([...this.selection, ...ids])) : ids;
        }
        this.emit();
        break;
      }
      case 'region': {
        const box = this.dragBox;
        if (box && box.w * this.cam.z > 14 && box.h * this.cam.z > 14) {
          this.pendingRegion = box;
          this.emit();
        }
        break;
      }
    }
    this.active = null;
    this.beginDoc = null;
    this.beginEl = null;
    this.handle = null;
    this.dragBox = null;
    this.mode = 'none';
    this.updateCursor();
    this.requestRender();
  };

  private onPointerLeave = () => {
    if (this.mode === 'none') {
      this.hover = null;
      this.requestRender();
    }
  };

  private beginPinch() {
    if (this.mode === 'draw' || this.mode === 'shape') this.active = null;
    if (this.beginDoc) {
      this.doc = this.beginDoc;
      this.beginDoc = null;
      this.sceneDirty = true;
    }
    this.dragBox = null;
    const [a, b] = Array.from(this.pointers.values());
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const worldMid = this.screenToWorld(mid.x, mid.y);
    this.pinch = {
      dist: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)),
      mid,
      worldMid,
      cam: { ...this.cam },
    };
    this.mode = 'pinch';
    this.requestRender();
  }

  private updatePinch() {
    const p = this.pinch;
    if (!p || this.pointers.size < 2) return;
    const [a, b] = Array.from(this.pointers.values());
    const curDist = Math.hypot(b.x - a.x, b.y - a.y);
    const curMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };

    // Zoom scale from initial pinch distance
    const z = clamp((p.cam.z * curDist) / p.dist, MIN_ZOOM, MAX_ZOOM);

    // Pan camera so initial world center stays anchored under current finger midpoint
    this.cam = {
      x: curMid.x - p.worldMid.x * z,
      y: curMid.y - p.worldMid.y * z,
      z,
    };
    this.camChanged();
  }

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const s = this.local(e);
    let dy = e.deltaY;
    let dx = e.deltaX;
    if (e.deltaMode === 1) {
      dy *= 32;
      dx *= 32;
    } else if (e.deltaMode === 2) {
      dy *= this.H;
      dx *= this.W;
    }
    this.anim = null;
    if (e.shiftKey || (!e.ctrlKey && Math.abs(dx) > Math.abs(dy))) {
      this.cam = { ...this.cam, x: this.cam.x - (dx || dy), y: this.cam.y - (e.shiftKey ? 0 : 0) };
      return this.camChanged();
    }
    const speed = e.ctrlKey ? 0.012 : 0.0016;
    const base = this.wheelZoom ? this.wheelZoom.target : Math.log(this.cam.z);
    this.wheelZoom = { target: clamp(base - dy * speed, Math.log(MIN_ZOOM), Math.log(MAX_ZOOM)), sx: s.x, sy: s.y };
    this.requestRender();
  };

  private onDblClick = (e: MouseEvent) => {
    if (this.tool !== 'select') return;
    const s = this.local(e);
    const w = this.screenToWorld(s.x, s.y);
    const hit = this.hitTop(w, 6 / this.cam.z, (el) => el.type === 'text' || el.type === 'sticky');
    if (hit) this.startEdit(hit.id);
    else if (!this.hitTop(w, 6 / this.cam.z)) this.createText(w);
  };

  /* ================================================================ */
  /* Images                                                            */
  /* ================================================================ */
  async addImageFile(file: File, screen?: Pt) {
    if (!file.type.startsWith('image/')) return;
    try {
      const src = await new Promise<string>((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result as string);
        fr.onerror = () => rej(fr.error);
        fr.readAsDataURL(file);
      });
      const img = await new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = rej;
        i.src = src;
      });
      let nw = img.naturalWidth || 400;
      let nh = img.naturalHeight || 300;
      let finalSrc = src;
      const MAX = 2000;
      if (Math.max(nw, nh) > MAX && file.type !== 'image/gif') {
        const k = MAX / Math.max(nw, nh);
        nw = Math.round(nw * k);
        nh = Math.round(nh * k);
        const c = document.createElement('canvas');
        c.width = nw;
        c.height = nh;
        c.getContext('2d')!.drawImage(img, 0, 0, nw, nh);
        finalSrc = file.type === 'image/jpeg' ? c.toDataURL('image/jpeg', 0.9) : c.toDataURL('image/png');
      }
      const sc = screen ?? this.viewCenter();
      const c = this.screenToWorld(sc.x, sc.y);
      const maxW = (Math.min(this.W, this.H) * 0.55) / this.cam.z;
      const k = Math.min(1 / this.cam.z, maxW / Math.max(nw, nh));
      const w = nw * k;
      const h = nh * k;
      const el: ImageEl = { id: uid(), type: 'image', x: c.x - w / 2, y: c.y - h / 2, w, h, rotation: 0, src: finalSrc };
      this.commitEdit();
      this.tool = 'select';
      this.updateCursor();
      this.setDoc({ ...this.doc, elements: [...this.doc.elements, el] });
      this.selection = [el.id];
      this.emit();
    } catch {
      this.toast('Không thể đọc ảnh này');
    }
  }

  /* ================================================================ */
  /* Persistence & export                                              */
  /* ================================================================ */
  private scheduleSave(delay = 500) {
    if (!this.loaded) return;
    clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => this.save(), delay);
  }

  async save() {
    if (!this.loaded) return;
    this.saveState = 'saving';
    this.emit();
    try {
      await storageSet(STORAGE_KEY, { version: 1, doc: this.doc, cam: this.cam, settings: this.settings, tool: this.tool, savedAt: Date.now() });
      this.saveState = 'saved';
    } catch {
      this.saveState = 'error';
      this.toast('Lưu thất bại — bộ nhớ trình duyệt có thể đã đầy');
    }
    this.emit();
  }

  private scheduleThumbs(delay = 700) {
    clearTimeout(this.thumbTimer);
    this.thumbTimer = window.setTimeout(() => this.generateThumbs(), delay);
  }

  private generateThumbs() {
    const bg = BOARD_COLORS[this.settings.board];
    for (const r of this.doc.regions) {
      const scale = Math.min(260 / r.w, 160 / r.h);
      try {
        const c = renderBox(this.doc, r, scale, this.images, bg);
        this.thumbs.set(r.id, c.toDataURL('image/jpeg', 0.82));
      } catch {
        /* ignore */
      }
    }
    this.emit();
  }

  async exportPNG(customName?: string) {
    this.commitEdit();
    const b = contentBounds(this.doc, false);
    if (!b) return this.toast('Bảng đang trống — chưa có gì để xuất');
    await this.images.ensureAll(this.doc.elements);
    const pad = 64;
    const box = { x: b.x - pad, y: b.y - pad, w: b.w + pad * 2, h: b.h + pad * 2 };
    const canvas = renderBox(this.doc, box, 2, this.images, BOARD_COLORS[this.settings.board]);
    const filename = (customName?.trim() || `chalkboard-${timestamp()}`).replace(/\.png$/i, '') + '.png';
    const saved = await downloadCanvas(canvas, filename);
    if (saved) this.toast(`Đã lưu ảnh: ${filename}`);
  }

  async exportRegionPNG(id: string, customName?: string) {
    const r = this.doc.regions.find((x) => x.id === id);
    if (!r) return;
    await this.images.ensureAll(this.doc.elements);
    const scale = clamp(2400 / Math.max(r.w, r.h), 2, 4);
    const canvas = renderBox(this.doc, r, scale, this.images, BOARD_COLORS[this.settings.board]);
    const filename = (customName?.trim() || `${slugify(r.name)}-${timestamp()}`).replace(/\.png$/i, '') + '.png';
    const saved = await downloadCanvas(canvas, filename);
    if (saved) this.toast(`Đã lưu vùng: ${filename}`);
  }

  async exportJSON(customName?: string) {
    this.commitEdit();
    const data = { app: 'chalkboard-canvas', version: 1, exportedAt: new Date().toISOString(), doc: this.doc, cam: this.cam, settings: this.settings };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const filename = (customName?.trim() || `chalkboard-${timestamp()}`).replace(/\.json$/i, '') + '.json';
    const saved = await saveBlobWithPicker(blob, filename, 'application/json', 'json');
    if (saved) this.toast(`Đã lưu file: ${filename}`);
  }

  importJSON(text: string) {
    try {
      const data = JSON.parse(text);
      const raw = data.doc ?? data;
      if (!Array.isArray(raw?.elements)) throw new Error('invalid');
      this.commitEdit();
      this.selection = [];
      this.thumbs.clear();
      this.setDoc(sanitizeDoc(raw));
      this.zoomToFit();
      this.toast(`Đã nhập ${this.doc.elements.length} đối tượng, ${this.doc.regions.length} vùng`);
    } catch {
      this.toast('File JSON không hợp lệ');
    }
  }

  /* ================================================================ */
  /* Render loop                                                       */
  /* ================================================================ */
  requestRender() {
    if (!this.raf) this.raf = requestAnimationFrame(this.frame);
  }

  private frame = (now: number) => {
    this.raf = 0;
    let keep = false;
    if (this.stepAnim(now)) keep = true;
    if (this.stepWheel()) keep = true;
    if (this.highlight) {
      if (now < this.highlight.until) keep = true;
      else this.highlight = null;
    }
    this.render(now);
    if (keep) this.requestRender();
  };

  private render(now: number) {
    const { ctx, gctx, cam, W, H, dpr } = this;
    if (!ctx || !gctx) return;
    const key = `${cam.x}|${cam.y}|${cam.z}|${W}|${H}|${dpr}`;
    if (key !== this.camKey) {
      this.camKey = key;
      this.sceneDirty = this.gridDirty = true;
    }
    if (this.gridDirty) {
      gctx.setTransform(1, 0, 0, 1, 0, 0);
      gctx.clearRect(0, 0, this.gridCanvas!.width, this.gridCanvas!.height);
      drawGrid(gctx, cam, W, H, dpr, this.settings.grid);
      this.gridDirty = false;
    }
    const k = dpr * cam.z;
    const baseRc = { zoom: cam.z, px: k, editingId: this.editingId, images: this.images };
    if (this.sceneDirty) {
      const s = this.sctx;
      s.setTransform(1, 0, 0, 1, 0, 0);
      s.clearRect(0, 0, this.scene.width, this.scene.height);
      s.setTransform(k, 0, 0, k, dpr * cam.x, dpr * cam.y);
      drawElements({ ...baseRc, ctx: s, view: this.viewBox() }, this.doc.elements);
      this.sceneDirty = false;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas!.width, this.canvas!.height);
    ctx.drawImage(this.scene, 0, 0);
    ctx.setTransform(k, 0, 0, k, dpr * cam.x, dpr * cam.y);
    const rc: RenderCtx = { ...baseRc, ctx };
    if (this.active) drawElement(rc, this.active);

    if (this.settings.showRegions) {
      for (const r of this.doc.regions) {
        let glow = 0;
        if (this.highlight?.id === r.id) {
          const t = 1 - (this.highlight.until - now) / 2200;
          glow = Math.max(0, Math.sin(t * Math.PI * 3)) * (1 - t * 0.6);
        }
        drawRegion(ctx, r, cam.z, glow);
      }
    }
    this.drawOverlays(ctx);
  }

  private drawOverlays(ctx: CanvasRenderingContext2D) {
    const z = this.cam.z;
    // selection
    if (this.selection.length && !this.editingId) {
      ctx.save();
      ctx.strokeStyle = ACCENT;
      ctx.lineWidth = 1.5 / z;
      ctx.setLineDash([6 / z, 4 / z]);
      for (const id of this.selection) {
        const el = this.getEl(id);
        if (!el) continue;
        if (el.type === 'shape' && (el.shape === 'line' || el.shape === 'arrow')) {
          const { cx, cy } = getElementCenter(el);
          const r = el.rotation || 0;
          const p1 = rotatePoint(el.x1, el.y1, cx, cy, r);
          const p2 = rotatePoint(el.x2, el.y2, cx, cy, r);
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        } else {
          const pts = elementCorners(el);
          ctx.beginPath();
          pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
          ctx.closePath();
          ctx.stroke();
        }
      }
      ctx.setLineDash([]);
      if (this.selection.length === 1) {
        const el = this.getEl(this.selection[0]);
        if (el) {
          const hs = this.getHandles(el);
          const rot = hs.find((h) => h.kind === 'rot');
          if (rot) {
            const { cx, cy } = getElementCenter(el);
            const b = getBaseBox(el);
            const r = el.rotation || 0;
            const topY = el.type === 'shape' && (el.shape === 'line' || el.shape === 'arrow')
              ? Math.min(el.y1, el.y2)
              : b.y;
            const top = rotatePoint(cx, topY, cx, cy, r);
            ctx.beginPath();
            ctx.moveTo(top.x, top.y);
            ctx.lineTo(rot.x, rot.y);
            ctx.stroke();
          }
          const sz = 9 / z;
          for (const h of hs) {
            ctx.fillStyle = '#1b2420';
            ctx.beginPath();
            if (h.kind === 'rot' || h.kind === 'p1' || h.kind === 'p2') ctx.arc(h.x, h.y, sz / 1.6, 0, Math.PI * 2);
            else ctx.rect(h.x - sz / 2, h.y - sz / 2, sz, sz);
            ctx.fill();
            ctx.stroke();
          }
        }
      }
      ctx.restore();
    }
    // marquee / region draft / pending region
    const box = this.dragBox ?? this.pendingRegion;
    if (box) {
      const isRegion = this.mode === 'region' || (!!this.pendingRegion && !this.dragBox);
      ctx.save();
      ctx.fillStyle = isRegion ? 'rgba(247,229,143,0.07)' : 'rgba(159,211,245,0.08)';
      ctx.strokeStyle = isRegion ? ACCENT : '#9fd3f5';
      ctx.lineWidth = (isRegion ? 2 : 1.2) / z;
      ctx.setLineDash(isRegion ? [10 / z, 7 / z] : [5 / z, 4 / z]);
      ctx.fillRect(box.x, box.y, box.w, box.h);
      ctx.strokeRect(box.x, box.y, box.w, box.h);
      if (isRegion && this.mode === 'region') {
        ctx.setLineDash([]);
        ctx.font = `600 ${12 / z}px Inter, sans-serif`;
        ctx.fillStyle = ACCENT;
        ctx.textBaseline = 'bottom';
        ctx.fillText(`${Math.round(box.w)} × ${Math.round(box.h)}`, box.x, box.y - 6 / z);
      }
      ctx.restore();
    }
    // brush / eraser cursor
    if (this.hover && this.mode !== 'pan' && this.mode !== 'pinch' && !this.spaceDown) {
      const t = this.tool;
      const st = this.settings;
      if (t === 'eraser') {
        ctx.save();
        ctx.beginPath();
        ctx.arc(this.hover.x, this.hover.y, st.eraserSize / 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        ctx.fill();
        ctx.lineWidth = 1.5 / z;
        ctx.strokeStyle = 'rgba(255,255,255,0.75)';
        ctx.setLineDash(st.eraserMode === 'object' ? [4 / z, 3 / z] : []);
        ctx.stroke();
        ctx.restore();
      } else if ((t === 'chalk' || t === 'highlighter') && this.mode === 'none') {
        const size = t === 'chalk' ? st.chalkSize : st.hlSize;
        if (size * z > 6) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(this.hover.x, this.hover.y, size / 2, 0, Math.PI * 2);
          ctx.lineWidth = 1 / z;
          ctx.strokeStyle = t === 'chalk' ? st.chalkColor : st.hlColor;
          ctx.globalAlpha = 0.6;
          ctx.stroke();
          ctx.restore();
        }
      }
    }
  }
}
