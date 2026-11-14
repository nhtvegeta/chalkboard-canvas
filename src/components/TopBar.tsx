import React, { useRef, useState } from 'react';
import type { Engine } from '../engine/Engine';
import { useI18n } from '../i18n/I18nContext';
import {
  Maximize2,
  Grid,
  Download,
  FolderOpen,
  Trash2,
  Bookmark,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  Globe,
  Save,
  FilePlus2,
  Menu
} from 'lucide-react';

interface Props {
  engine: Engine;
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
  onOpenSaveModal: () => void;
}

export const TopBar: React.FC<Props> = ({ engine, onToggleSidebar, sidebarOpen, onOpenSaveModal }) => {
  const { t, language, setLanguage, languages } = useI18n();
  const [showMenu, setShowMenu] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const fileImportRef = useRef<HTMLInputElement>(null);

  const zoomPercent = Math.round(engine.cam.z * 100);

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        if (text) engine.importJSON(text);
      };
      reader.readAsText(file);
      e.target.value = '';
    }
  };

  const currentLang = languages.find((l) => l.code === language) || languages[0];

  const handleNewBoard = () => {
    if (confirm('Bắt đầu bảng vẽ mới? Bảng hiện tại sẽ được xóa sạch để bạn vẽ mới hoàn toàn.')) {
      engine.clearBoard();
    }
  };

  return (
    <>
      <header className="fixed top-2 left-2 right-2 z-30 pointer-events-none flex items-center justify-between gap-1 max-w-[calc(100vw-16px)]">
        {/* Bên Trái: Nút Mới, Đèn lưu, % Zoom, Reset View */}
        <div className="pointer-events-auto flex items-center gap-1 bg-[#18211d]/95 backdrop-blur-md border border-[#2e3b33] rounded-2xl px-2 py-1 shadow-xl text-slate-300 shrink-0">
          <button
            title="Tạo bảng mới / Xóa sạch bảng"
            onClick={handleNewBoard}
            className="flex items-center gap-1 p-1 bg-white/5 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 rounded-lg transition-all text-xs font-semibold"
          >
            <FilePlus2 className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden sm:inline">Mới</span>
          </button>

          <div className="h-3.5 w-px bg-white/10 mx-0.5" />

          {/* Đèn báo lưu tự động */}
          <div className="flex items-center px-0.5" title={engine.saveState === 'saved' ? t.saved : engine.saveState}>
            {engine.saveState === 'saving' ? (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            ) : engine.saveState === 'error' ? (
              <span className="w-2 h-2 rounded-full bg-rose-400" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            )}
          </div>

          {/* Zoom % */}
          <button
            title="Bấm để đặt lại 100%"
            onClick={() => engine.setZoom100()}
            className="px-1.5 py-0.5 text-xs font-mono font-medium hover:text-[#f7e58f] transition-colors"
          >
            {zoomPercent}%
          </button>

          <button
            title={t.resetView}
            onClick={() => engine.resetView()}
            className="p-1 rounded-lg hover:text-white hover:bg-white/10 transition-colors"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          <button
            title={`${t.gridMode}: ${engine.settings.grid}`}
            onClick={() => engine.cycleGrid()}
            className={`p-1 rounded-lg transition-colors ${
              engine.settings.grid !== 'none'
                ? 'text-[#f7e58f] bg-white/5'
                : 'hover:text-white hover:bg-white/10'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Bên Phải: Siêu gọn chỉ gồm nút LƯU, VÙNG và MENU 3 GẠCH (chứa Ngôn ngữ, Xuất file, Nhập file, v.v.) */}
        <div className="pointer-events-auto flex items-center gap-1 bg-[#18211d]/95 backdrop-blur-md border border-[#2e3b33] rounded-2xl p-1 shadow-xl shrink-0">
          {/* Nút LƯU FILE trực tiếp */}
          <button
            onClick={onOpenSaveModal}
            title="Lưu thành file (Tùy chọn tên & nơi lưu)"
            className="flex items-center gap-1 bg-[#f7e58f] text-[#161d19] hover:bg-[#fff2a8] rounded-xl px-2.5 py-1 text-xs font-bold shadow-md active:scale-95 transition-all shrink-0"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Lưu</span>
          </button>

          {/* Nút VÙNG (Bookmarks) */}
          <button
            onClick={onToggleSidebar}
            title={t.bookmarkedRegions}
            className={`flex items-center gap-0.5 px-2 py-1 text-xs font-semibold rounded-xl transition-all shrink-0 ${
              sidebarOpen
                ? 'bg-[#222e27] text-[#f7e58f] border border-[#f7e58f]/40'
                : 'text-slate-200 hover:text-white hover:bg-white/10'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5 text-[#f7e58f]" />
            <span className="text-[11px] font-mono">({engine.doc.regions.length})</span>
          </button>

          {/* Menu Mở rộng (Tích hợp Đổi ngôn ngữ, Xuất ảnh, Nhập JSON, Hướng dẫn) */}
          <div className="relative">
            <button
              onClick={() => {
                setShowMenu(!showMenu);
                setShowLangMenu(false);
              }}
              className="p-1.5 text-slate-300 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
              title="Menu mở rộng"
            >
              <Menu className="w-4 h-4" />
            </button>

            {showMenu && (
              <div
                className="absolute right-0 mt-2 w-56 bg-[#1b2420]/95 backdrop-blur-xl border border-[#324036] rounded-2xl p-2 shadow-2xl z-50 text-xs text-slate-200 flex flex-col gap-1 animate-in fade-in zoom-in-95"
                onClick={() => setShowMenu(false)}
              >
                {/* Chọn ngôn ngữ */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowLangMenu(!showLangMenu);
                  }}
                  className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-white/10 text-left transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-[#f7e58f]" />
                    <span>Ngôn ngữ: {currentLang.flag} {currentLang.nativeName}</span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {showLangMenu && (
                  <div className="bg-[#141a17] rounded-xl p-1 my-1 border border-white/5 space-y-0.5 max-h-48 overflow-y-auto scrollbar-thin">
                    {languages.map((l) => (
                      <button
                        key={l.code}
                        onClick={() => {
                          setLanguage(l.code);
                          setShowLangMenu(false);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left ${
                          language === l.code ? 'bg-[#2a372f] text-[#f7e58f] font-semibold' : 'hover:bg-white/5'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span>{l.flag}</span>
                          <span>{l.nativeName}</span>
                        </span>
                        {language === l.code && <span className="text-[10px] text-[#f7e58f]">✓</span>}
                      </button>
                    ))}
                  </div>
                )}

                <div className="h-px bg-white/10 my-0.5" />

                {/* Xuất ảnh PNG */}
                <button
                  onClick={() => engine.exportPNG()}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-white/10 text-left transition-colors"
                >
                  <Download className="w-4 h-4 text-emerald-400" />
                  <div>
                    <div className="font-semibold text-white">{t.exportPNG}</div>
                    <div className="text-[10px] text-slate-400">{t.exportPNGDesc}</div>
                  </div>
                </button>

                {/* Nhập file JSON */}
                <input
                  ref={fileImportRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleImportJSON}
                />
                <button
                  onClick={() => fileImportRef.current?.click()}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-white/10 text-left transition-colors"
                >
                  <FolderOpen className="w-4 h-4 text-sky-400" />
                  <div>
                    <div className="font-semibold text-white">{t.importJSON}</div>
                    <div className="text-[10px] text-slate-400">{t.importJSONDesc}</div>
                  </div>
                </button>

                {/* Hướng dẫn & Phím tắt */}
                <button
                  onClick={() => setShowHelp(true)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-white/10 text-left transition-colors"
                >
                  <HelpCircle className="w-4 h-4 text-amber-300" />
                  <div>
                    <div className="font-semibold text-white">{t.helpTitle}</div>
                    <div className="text-[10px] text-slate-400">Cách sử dụng & cử chỉ</div>
                  </div>
                </button>

                <div className="h-px bg-white/10 my-0.5" />

                {/* Xóa trắng bảng */}
                <button
                  onClick={() => {
                    if (confirm('Xóa tất cả nội dung trên bảng để vẽ mới?')) {
                      engine.clearBoard();
                    }
                  }}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-rose-500/20 text-rose-400 text-left transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <div>
                    <div className="font-semibold">Xóa sạch bảng</div>
                    <div className="text-[10px] text-rose-300/70">Bắt đầu trang mới</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Help Modal */}
      {showHelp && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setShowHelp(false)}
        >
          <div
            className="w-full max-w-md bg-[#19211d] border border-[#324036] rounded-2xl p-6 shadow-2xl text-slate-200 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-bold text-white text-base">{t.helpTitle}</h3>
              <button
                onClick={() => setShowHelp(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="text-xs space-y-2.5 text-slate-300 leading-relaxed">
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Kéo di chuyển (Pan)</span>
                <span className="font-mono text-[#f7e58f]">Chạm 2 ngón kéo / Space + Kéo</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Phóng to / Thu nhỏ (Zoom)</span>
                <span className="font-mono text-[#f7e58f]">Pinch 2 ngón / Lăn chuột</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">{t.toolsShortcut}</span>
                <span className="font-mono text-[#f7e58f]">{t.toolsShortcutDesc}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">{t.textStickyShortcut}</span>
                <span className="font-mono text-[#f7e58f]">{t.textStickyShortcutDesc}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">{t.pinShortcut}</span>
                <span className="font-mono text-[#f7e58f]">{t.pinShortcutDesc}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">{t.historyShortcut}</span>
                <span className="font-mono text-[#f7e58f]">{t.historyShortcutDesc}</span>
              </div>
            </div>

            <button
              onClick={() => setShowHelp(false)}
              className="w-full py-2 bg-[#f7e58f] text-[#18211d] font-bold text-xs rounded-xl hover:bg-[#fff2a8] transition-colors"
            >
              {t.helpUnderstand}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
