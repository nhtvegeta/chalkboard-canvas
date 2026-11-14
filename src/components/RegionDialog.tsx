import React, { useEffect, useRef, useState } from 'react';
import type { Engine } from '../engine/Engine';
import { REGION_COLORS } from '../engine/constants';
import { useI18n } from '../i18n/I18nContext';
import { Tag, Check, X } from 'lucide-react';

interface Props {
  engine: Engine;
}

export const RegionDialog: React.FC<Props> = ({ engine }) => {
  const { t } = useI18n();
  const pending = engine.pendingRegion;
  const [name, setName] = useState('');
  const [color, setColor] = useState(REGION_COLORS[0]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (pending) {
      setName(`${t.defaultRegionName} ${engine.doc.regions.length + 1}`);
      setColor(REGION_COLORS[engine.doc.regions.length % REGION_COLORS.length]);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [pending, engine, t]);

  if (!pending) return null;

  const screenPos = engine.worldToScreen(pending.x, pending.y);
  const left = Math.max(16, Math.min(window.innerWidth - 320, screenPos.x));
  const top = Math.max(70, Math.min(window.innerHeight - 200, screenPos.y - 120));

  const handleConfirm = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!name.trim()) return;
    engine.confirmRegion(name.trim(), color);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleConfirm();
    if (e.key === 'Escape') engine.cancelRegion();
  };

  return (
    <div
      className="fixed z-50 animate-in fade-in zoom-in-95 duration-150"
      style={{ left: `${left}px`, top: `${top}px` }}
      onClick={(e) => e.stopPropagation()}
    >
      <form
        onSubmit={handleConfirm}
        className="w-72 bg-[#202724]/95 backdrop-blur-md border border-[#3e4a42] rounded-xl shadow-2xl p-3.5 text-slate-100 flex flex-col gap-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#f7e58f] tracking-wide uppercase">
            <Tag className="w-3.5 h-3.5" />
            <span>{t.bookmarkRegion}</span>
          </div>
          <button
            type="button"
            onClick={() => engine.cancelRegion()}
            className="p-1 text-slate-400 hover:text-white rounded-md hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t.regionPlaceholder}
          className="w-full bg-[#141a17] border border-[#36423b] rounded-lg px-2.5 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#f7e58f] transition-colors"
        />

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5">
            {REGION_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-6 h-6 rounded-full border-2 transition-transform ${
                  color === c ? 'scale-110 border-white shadow-sm' : 'border-transparent hover:scale-105 opacity-80'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          <button
            type="submit"
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#f7e58f] text-[#1b2420] text-xs font-semibold rounded-lg hover:bg-[#fff2a8] active:scale-95 transition-all shadow-md"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{t.save}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
