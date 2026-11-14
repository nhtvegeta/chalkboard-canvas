import type { Settings } from './types';

export const ACCENT = '#f7e58f';

export const CHALK_COLORS = [
  { name: 'Trắng phấn', value: '#f4f1ea' },
  { name: 'Vàng nhạt', value: '#f7e58f' },
  { name: 'Hồng phấn', value: '#f5a9c4' },
  { name: 'Xanh bạc hà', value: '#a8e6cf' },
  { name: 'Cam đào', value: '#ffbe98' },
  { name: 'Xanh da trời', value: '#9fd3f5' },
  { name: 'Tím oải hương', value: '#c9b6f2' },
];

export const HIGHLIGHT_COLORS = [
  { name: 'Vàng neon', value: '#fff176' },
  { name: 'Xanh lá neon', value: '#69f0ae' },
  { name: 'Hồng neon', value: '#ff80ab' },
  { name: 'Xanh dương neon', value: '#80d8ff' },
  { name: 'Cam neon', value: '#ffab40' },
];

export const STICKY_COLORS = [
  { name: 'Vàng', value: '#fff4a3' },
  { name: 'Hồng', value: '#ffc6d9' },
  { name: 'Bạc hà', value: '#c3f0d6' },
  { name: 'Xanh', value: '#c9e4ff' },
  { name: 'Đào', value: '#ffd8b0' },
  { name: 'Oải hương', value: '#e3d4ff' },
];

export const REGION_COLORS = ['#f7e58f', '#a8e6cf', '#f5a9c4', '#9fd3f5', '#ffbe98', '#c9b6f2'];

export const BOARD_COLORS = { green: '#18221e', black: '#1a1d20' } as const;

export const MIN_ZOOM = 0.02;
export const MAX_ZOOM = 40;
export const STICKY_PAD = 18;

export const DEFAULT_SETTINGS: Settings = {
  chalkColor: '#f4f1ea',
  chalkSize: 5,
  hlColor: '#fff176',
  hlSize: 26,
  eraserMode: 'object',
  eraserSize: 36,
  font: 'hand',
  fontSize: 34,
  stickyColor: '#fff4a3',
  grid: 'dots',
  board: 'green',
  showRegions: true,
};
