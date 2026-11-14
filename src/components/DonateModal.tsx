import React, { useState } from 'react';
import { Heart, Coffee, Copy, Check, ExternalLink, X, QrCode, CreditCard } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const DonateModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { language } = useI18n();
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [tab, setTab] = useState<'vietnam' | 'international'>(language === 'vi' ? 'vietnam' : 'international');

  if (!isOpen) return null;

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const isVi = language === 'vi';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-[#18221d] border border-[#2e3d33] rounded-3xl p-5 sm:p-6 shadow-2xl text-slate-100 flex flex-col gap-4 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Nút đóng */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
          title="Đóng"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Tiêu đề */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-rose-500/20 to-amber-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0 shadow-lg">
            <Heart className="w-6 h-6 fill-rose-500/30 text-rose-400" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              {isVi ? 'Ủng hộ tác giả' : 'Support Chalkboard'}
              <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                Open Source
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              {isVi
                ? 'Đồng hành & tiếp sức phát triển dự án'
                : 'Help keep this project alive & growing'}
            </p>
          </div>
        </div>

        {/* Lời nhắn */}
        <div className="bg-[#121915] border border-white/5 rounded-2xl p-3 text-xs text-slate-300 leading-relaxed">
          {isVi ? (
            <p>
              🌟 <strong>Chalkboard Canvas</strong> là dự án mã nguồn mở hoàn toàn miễn phí. Nếu ứng dụng mang lại giá trị cho học tập, giảng dạy hoặc công việc của bạn, hãy mời tác giả một tách cà phê nhé! Cảm ơn bạn rất nhiều! ☕
            </p>
          ) : (
            <p>
              🌟 <strong>Chalkboard Canvas</strong> is an open-source, free infinite note-taking application. If you enjoy using it for teaching, studying, or brainstorming, consider buying me a coffee! Your support means the world! ☕
            </p>
          )}
        </div>

        {/* Tab chuyển đổi VN / Quốc tế */}
        <div className="flex rounded-xl bg-[#121915] p-1 border border-white/5 text-xs font-medium">
          <button
            onClick={() => setTab('vietnam')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all ${
              tab === 'vietnam'
                ? 'bg-[#223128] text-[#f7e58f] shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>🇻🇳 Ngân hàng / MoMo</span>
          </button>
          <button
            onClick={() => setTab('international')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all ${
              tab === 'international'
                ? 'bg-[#223128] text-[#f7e58f] shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>🌍 International</span>
          </button>
        </div>

        {/* Nội dung Tab Việt Nam */}
        {tab === 'vietnam' && (
          <div className="space-y-3 animate-in fade-in duration-150">
            {/* Chuyển khoản Ngân hàng */}
            <div className="bg-[#141b17] border border-[#2a382f] rounded-2xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#f7e58f] flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5" />
                  Chuyển khoản Ngân hàng (VietQR)
                </span>
                <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                  Khuyên dùng
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-slate-300 pt-1">
                <div className="flex items-center justify-between bg-black/20 p-2 rounded-xl">
                  <span className="text-slate-400">Ngân hàng:</span>
                  <span className="font-semibold text-white">MB Bank (Quân Đội)</span>
                </div>

                <div className="flex items-center justify-between bg-black/20 p-2 rounded-xl">
                  <span className="text-slate-400">Số tài khoản:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-[#f7e58f]">0988888888</span>
                    <button
                      onClick={() => copyToClipboard('0988888888', 'stk')}
                      className="p-1 rounded-md bg-white/10 hover:bg-white/20 text-slate-200 transition-colors flex items-center gap-1 text-[11px]"
                      title="Sao chép số tài khoản"
                    >
                      {copiedField === 'stk' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400 font-semibold">Đã chép</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Chép</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between bg-black/20 p-2 rounded-xl">
                  <span className="text-slate-400">Chủ tài khoản:</span>
                  <span className="font-semibold text-white">CHALKBOARD CREATOR</span>
                </div>

                <div className="flex items-center justify-between bg-black/20 p-2 rounded-xl">
                  <span className="text-slate-400">Nội dung CK:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-slate-200">Donate Chalkboard</span>
                    <button
                      onClick={() => copyToClipboard('Donate Chalkboard', 'memo')}
                      className="p-1 rounded-md bg-white/10 hover:bg-white/20 text-slate-200 transition-colors flex items-center gap-1 text-[11px]"
                    >
                      {copiedField === 'memo' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Ví MoMo */}
            <div className="bg-[#141b17] border border-[#2a382f] rounded-2xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#a50064] flex items-center justify-center text-white font-bold text-xs shadow-md">
                  M
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">Ví điện tử MoMo</div>
                  <div className="text-[11px] font-mono text-[#f7e58f]">0988888888</div>
                </div>
              </div>

              <button
                onClick={() => copyToClipboard('0988888888', 'momo')}
                className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-medium text-slate-200 transition-colors flex items-center gap-1.5"
              >
                {copiedField === 'momo' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Đã chép</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Sao chép</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Nội dung Tab Quốc tế */}
        {tab === 'international' && (
          <div className="space-y-2.5 animate-in fade-in duration-150">
            {/* Buy Me A Coffee */}
            <a
              href="https://www.buymeacoffee.com"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between p-3.5 bg-[#FFDD00] text-[#000000] rounded-2xl font-bold text-xs shadow-lg hover:brightness-105 active:scale-98 transition-all"
            >
              <div className="flex items-center gap-2.5">
                <Coffee className="w-5 h-5 text-black" />
                <span>Buy Me a Coffee</span>
              </div>
              <ExternalLink className="w-4 h-4 opacity-75" />
            </a>

            {/* PayPal */}
            <a
              href="https://paypal.me"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between p-3.5 bg-[#0070BA] text-white rounded-2xl font-bold text-xs shadow-lg hover:brightness-110 active:scale-98 transition-all"
            >
              <div className="flex items-center gap-2.5">
                <span className="font-extrabold italic text-sm">P</span>
                <span>Donate via PayPal</span>
              </div>
              <ExternalLink className="w-4 h-4 opacity-75" />
            </a>

            {/* GitHub Sponsors */}
            <a
              href="https://github.com/sponsors"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between p-3.5 bg-[#24292e] border border-white/10 text-white rounded-2xl font-bold text-xs shadow-lg hover:bg-[#2f363d] active:scale-98 transition-all"
            >
              <div className="flex items-center gap-2.5">
                <Heart className="w-4 h-4 text-rose-400 fill-rose-400" />
                <span>Sponsor on GitHub</span>
              </div>
              <ExternalLink className="w-4 h-4 opacity-75" />
            </a>
          </div>
        )}

        {/* Chân hộp thoại */}
        <div className="pt-1 flex items-center justify-between text-[11px] text-slate-400 border-t border-white/5">
          <span>❤️ Made with love for the community</span>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-white/10 hover:bg-white/15 text-slate-200 rounded-xl transition-colors font-medium"
          >
            {isVi ? 'Đóng' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
