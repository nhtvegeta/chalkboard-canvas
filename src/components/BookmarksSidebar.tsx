import React, { useState } from 'react';
import type { Engine } from '../engine/Engine';
import { normalizeText } from '../engine/utils';
import { plainText } from '../engine/text';
import { useI18n } from '../i18n/I18nContext';
import {
  Bookmark,
  Search,
  X,
  Compass,
  Download,
  Trash2,
  FileText,
  ChevronRight,
  MapPin
} from 'lucide-react';

interface Props {
  engine: Engine;
  isOpen: boolean;
  onClose: () => void;
}

export const BookmarksSidebar: React.FC<Props> = ({ engine, isOpen, onClose }) => {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'regions' | 'notes'>('regions');

  if (!isOpen) return null;

  const q = normalizeText(query.trim());

  const filteredRegions = engine.doc.regions.filter((r) => {
    if (!q) return true;
    return normalizeText(r.name).includes(q);
  });

  const filteredNotes = engine.doc.elements
    .filter((el) => (el.type === 'text' || el.type === 'sticky') && (el as any).text?.trim())
    .filter((el: any) => {
      if (!q) return true;
      return normalizeText(el.text).includes(q);
    });

  return (
    <aside
      className="fixed top-0 right-0 h-full w-80 bg-[#161d19]/95 backdrop-blur-xl border-l border-[#2e3a32] shadow-2xl z-40 flex flex-col transition-all duration-300 text-slate-200"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="p-4 border-b border-[#2a362f] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bookmark className="w-5 h-5 text-[#f7e58f]" />
          <h2 className="font-semibold text-white tracking-wide text-sm uppercase">{t.bookmarkedRegions}</h2>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Search Input */}
      <div className="p-3 border-b border-[#242e28]">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="w-full pl-9 pr-3 py-1.5 bg-[#101513] border border-[#2e3b33] rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#f7e58f] transition-colors"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Tab switch */}
        <div className="flex mt-2.5 bg-[#0f1412] p-0.5 rounded-lg border border-[#253029] text-xs">
          <button
            onClick={() => setTab('regions')}
            className={`flex-1 py-1 rounded-md text-center font-medium transition-all ${
              tab === 'regions'
                ? 'bg-[#26332c] text-[#f7e58f] shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.tabRegions} ({engine.doc.regions.length})
          </button>
          <button
            onClick={() => setTab('notes')}
            className={`flex-1 py-1 rounded-md text-center font-medium transition-all ${
              tab === 'notes'
                ? 'bg-[#26332c] text-[#f7e58f] shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.tabNotes} ({filteredNotes.length})
          </button>
        </div>
      </div>

      {/* Content List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 scrollbar-thin scrollbar-thumb-white/10">
        {tab === 'regions' && (
          <>
            {filteredRegions.length === 0 ? (
              <div className="text-center py-10 px-4 text-slate-500 text-xs">
                {query ? (
                  <p>{t.noRegionsFound} "{query}"</p>
                ) : (
                  <div className="space-y-2">
                    <MapPin className="w-8 h-8 text-slate-600 mx-auto" />
                    <p>{t.noRegionsYet}</p>
                    <p className="text-[11px] text-slate-500">{t.noRegionsTip}</p>
                  </div>
                )}
              </div>
            ) : (
              filteredRegions.map((r) => {
                const thumb = engine.thumbs.get(r.id);
                return (
                  <div
                    key={r.id}
                    onClick={() => engine.flyToRegion(r.id)}
                    className="group relative bg-[#1b231f] hover:bg-[#232d28] border border-[#2c3730] hover:border-[#425247] rounded-xl p-2.5 cursor-pointer transition-all shadow-sm flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                          style={{ backgroundColor: r.color }}
                        />
                        <span className="font-medium text-xs text-slate-100 truncate group-hover:text-[#f7e58f] transition-colors">
                          {r.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          title={t.exportRegionPNG}
                          onClick={(e) => {
                            e.stopPropagation();
                            engine.exportRegionPNG(r.id);
                          }}
                          className="p-1 text-slate-400 hover:text-white rounded hover:bg-white/10"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          title={t.deleteRegion}
                          onClick={(e) => {
                            e.stopPropagation();
                            engine.deleteRegion(r.id);
                          }}
                          className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-white/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Thumbnail preview */}
                    {thumb ? (
                      <div className="w-full h-24 bg-[#111714] rounded-lg overflow-hidden border border-[#232b26] relative">
                        <img
                          src={thumb}
                          alt={r.name}
                          className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-200"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-1.5">
                          <span className="text-[10px] text-white/90 flex items-center gap-1">
                            <Compass className="w-3 h-3 text-[#f7e58f]" /> {t.clickToFly}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-16 bg-[#111714] rounded-lg flex items-center justify-center border border-[#232b26]">
                        <span className="text-[10px] text-slate-500">{t.generatingThumb}</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </>
        )}

        {tab === 'notes' && (
          <>
            {filteredNotes.length === 0 ? (
              <div className="text-center py-10 px-4 text-slate-500 text-xs">
                {t.noNotesFound}
              </div>
            ) : (
              filteredNotes.map((el: any) => {
                const preview = plainText(el.text || '');
                const isSticky = el.type === 'sticky';
                return (
                  <div
                    key={el.id}
                    onClick={() => engine.flyToElement(el.id)}
                    className="group bg-[#1b231f] hover:bg-[#232d28] border border-[#2c3730] hover:border-[#425247] rounded-xl p-2.5 cursor-pointer transition-all shadow-sm flex items-start gap-2.5"
                  >
                    <div
                      className="mt-0.5 p-1 rounded shrink-0"
                      style={{
                        backgroundColor: isSticky ? el.color : 'rgba(255,255,255,0.08)',
                        color: isSticky ? '#1e2420' : '#f7e58f',
                      }}
                    >
                      <FileText className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">
                        {isSticky ? t.stickyType : t.textType}
                      </div>
                      <p className="text-xs text-slate-200 line-clamp-2 leading-relaxed group-hover:text-white">
                        {preview || t.emptyContent}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-[#f7e58f] group-hover:translate-x-0.5 transition-all self-center shrink-0" />
                  </div>
                );
              })
            )}
          </>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-[#242e28] text-center text-[11px] text-slate-500">
        {t.sidebarTip}
      </div>
    </aside>
  );
};
