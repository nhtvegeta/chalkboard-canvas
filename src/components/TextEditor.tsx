import React, { useEffect, useRef } from 'react';
import type { Engine } from '../engine/Engine';
import { FONT_FAMILIES } from '../engine/text';
import { STICKY_PAD } from '../engine/constants';
import { useI18n } from '../i18n/I18nContext';
import { Check, X } from 'lucide-react';

interface Props {
  engine: Engine;
}

export const TextEditor: React.FC<Props> = ({ engine }) => {
  const { t } = useI18n();
  const editingId = engine.editingId;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const el = engine.getEditingEl();

  useEffect(() => {
    if (editingId && textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [editingId]);

  if (!editingId || !el) return null;

  const cam = engine.cam;
  const isSticky = el.type === 'sticky';

  const screenPos = engine.worldToScreen(el.x, el.y);
  const zoom = cam.z;

  const fontFam = FONT_FAMILIES[el.font] || 'sans-serif';
  const fontSize = Math.max(12, el.fontSize * zoom);

  let left = screenPos.x;
  let top = screenPos.y;
  let width = Math.max(220, (isSticky ? el.w : el.w) * zoom);
  let height = isSticky ? el.h * zoom : undefined;

  let pad = isSticky ? STICKY_PAD * zoom : 8 * zoom;

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    engine.editDraft = e.target.value;
    engine.updateElement(el.id, { text: e.target.value });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      engine.commitEdit();
    }
    // Ctrl + Enter to submit
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      engine.commitEdit();
    }
  };

  const handleDone = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    engine.commitEdit();
  };

  return (
    <div
      className="fixed z-40 pointer-events-auto flex flex-col items-start animate-in fade-in zoom-in-95 duration-100"
      style={{
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        height: height ? `${height}px` : 'auto',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="relative w-full h-full">
        <textarea
          ref={textareaRef}
          value={engine.editDraft}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={isSticky ? t.stickyPlaceholder : t.textPlaceholder}
          className="w-full h-full resize-none outline-none border-2 border-[#f7e58f] rounded-xl shadow-2xl transition-all"
          style={{
            fontFamily: fontFam,
            fontSize: `${fontSize}px`,
            lineHeight: isSticky ? 1.25 : 1.35,
            color: isSticky ? '#2d2a26' : el.color,
            backgroundColor: isSticky ? 'rgba(255, 255, 255, 0.18)' : 'rgba(20, 26, 23, 0.88)',
            padding: `${pad}px`,
            paddingBottom: `${pad + 28}px`, // chừa chỗ cho thanh nút dưới
            backdropFilter: isSticky ? 'none' : 'blur(8px)',
            minHeight: `${Math.max(54, fontSize * 1.6)}px`,
          }}
        />

        {/* Floating Action Bar: Nút Xong (OK) và Hủy ngay góc dưới ô gõ */}
        <div className="absolute right-1.5 bottom-1.5 z-10 flex items-center gap-1 bg-[#141b17]/95 border border-[#344138] rounded-xl p-0.5 shadow-xl backdrop-blur-md">
          <button
            type="button"
            onPointerDown={handleDone}
            title="Xong (Hoàn tất nhập chữ)"
            className="flex items-center gap-1 px-2.5 py-1 bg-[#f7e58f] text-[#161d19] rounded-lg text-xs font-bold hover:bg-[#fff2a8] active:scale-95 transition-all shadow-sm"
          >
            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Xong</span>
          </button>
        </div>
      </div>
    </div>
  );
};
