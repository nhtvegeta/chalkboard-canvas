import type { Doc, El, FontKind } from './types';
import { uid } from './utils';

const text = (x: number, y: number, w: number, t: string, color: string, fontSize: number, font: FontKind = 'hand'): El => ({
  id: uid(), type: 'text', x, y, w, text: t, color, fontSize, font,
});

const shape = (shape: 'rect' | 'ellipse' | 'line' | 'arrow', x1: number, y1: number, x2: number, y2: number, color: string, size = 4): El => ({
  id: uid(), type: 'shape', shape, x1, y1, x2, y2, color, size, seed: Math.floor(Math.random() * 1e9),
});

/** Starter board shown on first launch, entirely in English for international readiness. */
export function createWelcomeDoc(): Doc {
  const els: El[] = [];
  els.push(text(-520, -340, 900, 'Infinite Chalkboard ✨', '#f4f1ea', 76));
  const pts: number[] = [];
  for (let i = 0; i <= 64; i++) pts.push(-512 + i * 7, -238 + Math.sin(i / 3.5) * 4);
  els.push({ id: uid(), type: 'stroke', kind: 'chalk', points: pts, color: '#f7e58f', size: 5, seed: 42 });
  els.push(text(-520, -215, 760, 'Draw, take notes, pin spatial regions & glide across ideas.', '#f7e58f', 30));
  els.push({
    id: uid(), type: 'sticky', x: -520, y: -130, w: 270, h: 260, color: '#fff4a3', font: 'hand', fontSize: 27,
    text: '**Quick Tips**\n- Space + Drag: Pan\n- Mouse wheel: Zoom\n- B: Pin region\n- Ctrl+Z / Ctrl+Y',
  });
  els.push(text(-200, -130, 380, '**Today\'s Checklist**\n[x] Open chalkboard\n[ ] Draw mindmap\n[ ] Pin & name region\n[ ] Export high-res PNG', '#a8e6cf', 32));
  els.push({ id: uid(), type: 'stroke', kind: 'highlighter', points: [-196, 110, 60, 112], color: '#fff176', size: 22, seed: 7 });
  els.push(text(-196, 88, 360, 'Click checkbox to toggle ✓', '#f4f1ea', 26, 'print'));

  // mind map
  els.push(shape('ellipse', 300, -80, 540, 40, '#f5a9c4', 4));
  els.push(text(346, -42, 200, 'App Concept', '#f5a9c4', 36));
  els.push(shape('rect', 250, 170, 420, 250, '#a8e6cf', 4));
  els.push(text(282, 189, 160, 'UI / UX', '#a8e6cf', 32));
  els.push(shape('rect', 480, 170, 660, 250, '#ffbe98', 4));
  els.push(text(510, 189, 160, 'Features', '#ffbe98', 32));
  els.push(shape('arrow', 380, 48, 340, 160, '#f4f1ea', 3.5));
  els.push(shape('arrow', 470, 48, 560, 160, '#f4f1ea', 3.5));
  els.push({
    id: uid(), type: 'sticky', x: 650, y: -150, w: 210, h: 190, color: '#ffc6d9', font: 'hand', fontSize: 25,
    text: '**Try It Now**\nOpen "Regions" on the top right and click any card to fly!',
  });

  return {
    elements: els,
    regions: [
      { id: uid(), name: 'Quick Guide', color: '#f7e58f', x: -560, y: -370, w: 790, h: 540, createdAt: Date.now() },
      { id: uid(), name: 'App Concept Mindmap', color: '#f5a9c4', x: 220, y: -180, w: 670, h: 460, createdAt: Date.now() },
    ],
  };
}
