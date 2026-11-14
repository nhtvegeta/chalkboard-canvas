import React, { useState } from 'react';
import type { Engine } from '../engine/Engine';
import { useI18n } from '../i18n/I18nContext';
import { timestamp } from '../engine/exporter';
import {
  FileText,
  Image,
  FolderOpen,
  Check,
  X
} from 'lucide-react';

interface Props {
  engine: Engine;
  isOpen: boolean;
  onClose: () => void;
}

export const SaveDialog: React.FC<Props> = ({ engine, isOpen, onClose }) => {
  const { t } = useI18n();
  const [fileType, setFileType] = useState<'json' | 'png'>('json');
  const [filename, setFilename] = useState(() => `chalkboard-${timestamp()}`);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = filename.trim() || `chalkboard-${timestamp()}`;
    if (fileType === 'json') {
      await engine.exportJSON(cleanName);
    } else {
      await engine.exportPNG(cleanName);
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-[#1b2420] border border-[#36443a] rounded-2xl p-5 shadow-2xl text-slate-200 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-[#f7e58f]" />
            <h3 className="font-bold text-white text-sm uppercase tracking-wide">
              Lưu thành file
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          {/* Format selection */}
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400 font-medium">Định dạng file lưu:</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFileType('json')}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                  fileType === 'json'
                    ? 'bg-[#2a382f] border-[#f7e58f] text-[#f7e58f] shadow-md'
                    : 'border-[#2e3b33] text-slate-400 hover:bg-white/5'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>File JSON (.json)</span>
              </button>

              <button
                type="button"
                onClick={() => setFileType('png')}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                  fileType === 'png'
                    ? 'bg-[#2a382f] border-[#f7e58f] text-[#f7e58f] shadow-md'
                    : 'border-[#2e3b33] text-slate-400 hover:bg-white/5'
                }`}
              >
                <Image className="w-4 h-4" />
                <span>Ảnh PNG (.png)</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400 italic">
              {fileType === 'json'
                ? 'Lưu đầy đủ dữ liệu ghi chú để có thể mở lại sửa đổi sau.'
                : 'Xuất toàn bộ bảng thành ảnh chất lượng cao để chia sẻ.'}
            </p>
          </div>

          {/* Filename input */}
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400 font-medium">Tên file:</label>
            <div className="flex items-center bg-[#131916] border border-[#2e3b33] focus-within:border-[#f7e58f] rounded-xl px-3 py-2 text-xs transition-colors">
              <input
                type="text"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                placeholder="Nhập tên file..."
                className="w-full bg-transparent text-white focus:outline-none"
                autoFocus
              />
              <span className="text-slate-500 font-mono pl-1 shrink-0">
                .{fileType}
              </span>
            </div>
          </div>

          <p className="text-[11px] text-amber-300/80 bg-amber-400/10 border border-amber-400/20 p-2.5 rounded-xl">
            💡 Khi bấm Lưu, trình duyệt sẽ mở cửa sổ để bạn <b>chọn thư mục lưu</b> và <b>đổi tên file</b> tùy ý.
          </p>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 bg-[#f7e58f] text-[#161d19] text-xs font-bold rounded-xl hover:bg-[#fff2a8] active:scale-95 transition-all shadow-md"
            >
              <Check className="w-4 h-4" />
              <span>Lưu file</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
