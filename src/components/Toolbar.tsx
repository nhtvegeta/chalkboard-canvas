import React, { useRef, useState } from 'react';
import type { Engine } from '../engine/Engine';
import type { Tool } from '../engine/types';
import {
  CHALK_COLORS,
  HIGHLIGHT_COLORS,
  STICKY_COLORS
} from '../engine/constants';
import { useI18n } from '../i18n/I18nContext';
import {
  MousePointer,
  Hand,
  PenTool,
  Highlighter,
  Eraser,
  Type,
  StickyNote,
  Square,
  Circle,
  ArrowRight,
  Minus,
  Bookmark,
  Image as ImageIcon,
  RotateCcw,
  RotateCw,
  Palette
} from 'lucide-react';

interface Props {
  engine: Engine;
}

export const Toolbar: React.FC<Props> = ({ engine }) => {
  const { t } = useI18n();
  const currentTool = engine.tool;
  const settings = engine.settings;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showPalette, setShowPalette] = useState(false);

  const handleToolSelect = (tool: Tool) => {
    engine.setTool(tool);
    if (tool === 'chalk' || tool === 'highlighter' || tool === 'sticky') {
      setShowPalette(true);
    } else {
      setShowPalette(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      engine.addImageFile(file);
      e.target.value = '';
    }
  };

  const primaryTools: Array<{ id: Tool; label: string; icon: React.ReactNode; shortcut: string }> = [
    { id: 'select', label: t.toolSelect, icon: <MousePointer className="w-3.5 h-3.5 sm:w-4 sm:h-4" />, shortcut: 'V' },
    { id: 'hand', label: t.toolHand, icon: <Hand className="w-3.5 h-3.5 sm:w-4 sm:h-4" />, shortcut: 'H' },
    { id: 'chalk', label: t.toolChalk, icon: <PenTool className="w-3.5 h-3.5 sm:w-4 sm:h-4" />, shortcut: 'P' },
    { id: 'highlighter', label: t.toolHighlighter, icon: <Highlighter className="w-3.5 h-3.5 sm:w-4 sm:h-4" />, shortcut: 'D' },
    { id: 'eraser', label: t.toolEraser, icon: <Eraser className="w-3.5 h-3.5 sm:w-4 sm:h-4" />, shortcut: 'E' },
    { id: 'text', label: t.toolText, icon: <Type className="w-3.5 h-3.5 sm:w-4 sm:h-4" />, shortcut: 'T' },
  ];

  const secondaryTools: Array<{ id: Tool; label: string; icon: React.ReactNode; shortcut: string }> = [
    { id: 'sticky', label: t.toolSticky, icon: <StickyNote className="w-3.5 h-3.5 sm:w-4 sm:h-4" />, shortcut: 'S' },
    { id: 'rect', label: t.toolRect, icon: <Square className="w-3.5 h-3.5 sm:w-4 sm:h-4" />, shortcut: 'R' },
    { id: 'ellipse', label: t.toolEllipse, icon: <Circle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />, shortcut: 'O' },
    { id: 'arrow', label: t.toolArrow, icon: <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />, shortcut: 'A' },
    { id: 'line', label: t.toolLine, icon: <Minus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />, shortcut: 'L' },
    { id: 'region', label: t.toolRegion, icon: <Bookmark className="w-3.5 h-3.5 sm:w-4 sm:h-4" />, shortcut: 'B' },
  ];

  const allTools = [...primaryTools, ...secondaryTools];

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageUpload}
      />

      {/* Popover sub-menu for color/size options */}
      {showPalette && (
        <div className="fixed bottom-14 landscape:bottom-2 left-1/2 -translate-x-1/2 z-40 bg-[#1b231f]/95 backdrop-blur-md border border-[#324036] rounded-2xl px-2.5 py-1.5 sm:px-4 sm:py-2 shadow-2xl flex items-center gap-2 sm:gap-4 animate-in fade-in slide-in-from-bottom-2 duration-150 text-slate-200 overflow-x-auto max-w-[94vw] scrollbar-none">
          {/* Colors */}
          <div className="flex items-center gap-1.5 shrink-0">
            {currentTool === 'chalk' || currentTool === 'rect' || currentTool === 'ellipse' || currentTool === 'arrow' || currentTool === 'line' || currentTool === 'text' ? (
              CHALK_COLORS.map((c) => (
                <button
                  key={c.value}
                  title={c.name}
                  onClick={() => engine.setSettings({ chalkColor: c.value })}
                  className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 transition-transform ${
                    settings.chalkColor === c.value
                      ? 'scale-110 border-white shadow-md'
                      : 'border-transparent hover:scale-105 opacity-80'
                  }`}
                  style={{ backgroundColor: c.value }}
                />
              ))
            ) : currentTool === 'highlighter' ? (
              HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c.value}
                  title={c.name}
                  onClick={() => engine.setSettings({ hlColor: c.value })}
                  className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 transition-transform ${
                    settings.hlColor === c.value
                      ? 'scale-110 border-white shadow-md'
                      : 'border-transparent hover:scale-105 opacity-80'
                  }`}
                  style={{ backgroundColor: c.value }}
                />
              ))
            ) : currentTool === 'sticky' ? (
              STICKY_COLORS.map((c) => (
                <button
                  key={c.value}
                  title={c.name}
                  onClick={() => engine.setSettings({ stickyColor: c.value })}
                  className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 transition-transform ${
                    settings.stickyColor === c.value
                      ? 'scale-110 border-white shadow-md'
                      : 'border-transparent hover:scale-105 opacity-80'
                  }`}
                  style={{ backgroundColor: c.value }}
                />
              ))
            ) : null}
          </div>

          <div className="h-4 sm:h-5 w-px bg-white/10 shrink-0" />

          {/* Stroke Size slider */}
          {currentTool === 'chalk' && (
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium">{t.strokeWidth}</span>
              <input
                type="range"
                min="2"
                max="24"
                value={settings.chalkSize}
                onChange={(e) => engine.setSettings({ chalkSize: Number(e.target.value) })}
                className="w-14 sm:w-20 accent-[#f7e58f] h-1.5 bg-black/40 rounded-lg cursor-pointer"
              />
              <span className="text-xs font-mono text-[#f7e58f] w-4">{settings.chalkSize}</span>
            </div>
          )}

          {currentTool === 'highlighter' && (
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium">{t.highlighterWidth}</span>
              <input
                type="range"
                min="12"
                max="60"
                value={settings.hlSize}
                onChange={(e) => engine.setSettings({ hlSize: Number(e.target.value) })}
                className="w-14 sm:w-20 accent-[#f7e58f] h-1.5 bg-black/40 rounded-lg cursor-pointer"
              />
              <span className="text-xs font-mono text-[#f7e58f] w-4">{settings.hlSize}</span>
            </div>
          )}

          {currentTool === 'eraser' && (
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1 bg-black/30 p-0.5 rounded-lg text-xs">
                <button
                  onClick={() => engine.setSettings({ eraserMode: 'object' })}
                  className={`px-1.5 py-0.5 rounded text-[10px] sm:text-xs ${
                    settings.eraserMode === 'object' ? 'bg-[#2a382f] text-[#f7e58f]' : 'text-slate-400'
                  }`}
                >
                  {t.eraseObject}
                </button>
                <button
                  onClick={() => engine.setSettings({ eraserMode: 'pixel' })}
                  className={`px-1.5 py-0.5 rounded text-[10px] sm:text-xs ${
                    settings.eraserMode === 'pixel' ? 'bg-[#2a382f] text-[#f7e58f]' : 'text-slate-400'
                  }`}
                >
                  {t.erasePixel}
                </button>
              </div>

              <div className="flex items-center gap-1">
                <input
                  type="range"
                  min="16"
                  max="100"
                  value={settings.eraserSize}
                  onChange={(e) => engine.setSettings({ eraserSize: Number(e.target.value) })}
                  className="w-14 sm:w-16 accent-[#f7e58f] h-1.5 bg-black/40 rounded-lg cursor-pointer"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. CHẾ ĐỘ DỌC (PORTRAIT):                                                 */}
      {/* Cố định 2 nút Tới/Lui bên trái, 2 nút Ảnh/Màu bên phải.                   */}
      {/* PHẦN GIỮA LÀ THANH CUỘN (SCROLL) TỰ NHIÊN, CÁC ICON CÓ KÍCH THƯỚC RÕ RÀNG */}
      {/* TUYỆT ĐỐI KHÔNG BỊ CO LẠI HAY DÍNH NHAU!                                 */}
      {/* ========================================================================= */}
      <div className="landscape:hidden fixed bottom-1.5 left-1/2 -translate-x-1/2 z-30 w-[96vw] max-w-lg">
        <div className="bg-[#18201c]/95 backdrop-blur-xl border border-[#2e3b33] rounded-2xl p-1 shadow-2xl flex items-center justify-between text-slate-300">
          {/* Cố định 2 nút Tới / Lui */}
          <div className="flex items-center gap-0.5 pr-1.5 border-r border-white/10 shrink-0">
            <button
              title={t.undo}
              disabled={!engine.canUndo}
              onClick={() => engine.undo()}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              title={t.redo}
              disabled={!engine.canRedo}
              onClick={() => engine.redo()}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>

          {/* Phần giữa: Thanh cuộn ngang cảm ứng siêu mượt (overflow-x-auto) */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none px-2 min-w-0 flex-1 touch-pan-x">
            {allTools.map((tItem) => {
              const active = currentTool === tItem.id;
              return (
                <button
                  key={tItem.id}
                  title={`${tItem.label} (${tItem.shortcut})`}
                  onClick={() => handleToolSelect(tItem.id)}
                  className={`relative p-2 rounded-xl transition-all shrink-0 w-8 h-8 flex items-center justify-center ${
                    active
                      ? 'bg-[#f7e58f] text-[#161d19] shadow-md font-medium scale-105'
                      : 'text-slate-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {tItem.icon}
                  {active && (
                    <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-sm" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Cố định 2 nút: Thêm ảnh & Đổi màu/Cỡ nét */}
          <div className="flex items-center gap-0.5 pl-1.5 border-l border-white/10 shrink-0">
            <button
              title={t.uploadImage}
              onClick={() => fileInputRef.current?.click()}
              className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            >
              <ImageIcon className="w-4 h-4" />
            </button>
            <button
              title={t.palette}
              onClick={() => setShowPalette(!showPalette)}
              className={`p-2 rounded-xl transition-colors ${
                showPalette ? 'bg-[#2a382f] text-[#f7e58f]' : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <Palette className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. CHẾ ĐỘ NGANG (LANDSCAPE): ĐẶT DƯỚI TOPBAR (top-14), TÁCH RỜI HOÀN TOÀN */}
      {/* ========================================================================= */}

      {/* Thanh bên Trái: Đặt từ top-14 xuống, cách xa thanh menu trên cùng */}
      <div className="hidden landscape:flex fixed left-1.5 top-14 z-30 flex-col items-center gap-1 bg-[#18201c]/95 backdrop-blur-xl border border-[#2e3b33] rounded-2xl p-1 shadow-2xl text-slate-300">
        <button
          title={t.undo}
          disabled={!engine.canUndo}
          onClick={() => engine.undo()}
          className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>
        <button
          title={t.redo}
          disabled={!engine.canRedo}
          onClick={() => engine.redo()}
          className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        >
          <RotateCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>

        <div className="w-5 h-px bg-white/10 my-0.5" />

        {primaryTools.map((tItem) => {
          const active = currentTool === tItem.id;
          return (
            <button
              key={tItem.id}
              title={`${tItem.label} (${tItem.shortcut})`}
              onClick={() => handleToolSelect(tItem.id)}
              className={`relative p-1.5 rounded-xl transition-all ${
                active
                  ? 'bg-[#f7e58f] text-[#161d19] shadow-md font-medium scale-105'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              {tItem.icon}
              {active && (
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-sm" />
              )}
            </button>
          );
        })}
      </div>

      {/* Thanh bên Phải: Đặt từ top-14 xuống, cách xa thanh menu trên cùng */}
      <div className="hidden landscape:flex fixed right-1.5 top-14 z-30 flex-col items-center gap-1 bg-[#18201c]/95 backdrop-blur-xl border border-[#2e3b33] rounded-2xl p-1 shadow-2xl text-slate-300">
        {secondaryTools.map((tItem) => {
          const active = currentTool === tItem.id;
          return (
            <button
              key={tItem.id}
              title={`${tItem.label} (${tItem.shortcut})`}
              onClick={() => handleToolSelect(tItem.id)}
              className={`relative p-1.5 rounded-xl transition-all ${
                active
                  ? 'bg-[#f7e58f] text-[#161d19] shadow-md font-medium scale-105'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              {tItem.icon}
              {active && (
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-sm" />
              )}
            </button>
          );
        })}

        <div className="w-5 h-px bg-white/10 my-0.5" />

        <button
          title={t.uploadImage}
          onClick={() => fileInputRef.current?.click()}
          className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
        >
          <ImageIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>

        <button
          title={t.palette}
          onClick={() => setShowPalette(!showPalette)}
          className={`p-1.5 rounded-xl transition-colors ${
            showPalette ? 'bg-[#2a382f] text-[#f7e58f]' : 'text-slate-300 hover:text-white hover:bg-white/10'
          }`}
        >
          <Palette className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>
      </div>
    </>
  );
};
