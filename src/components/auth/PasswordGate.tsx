import React, { useState } from 'react';
import { Anchor, Lock, Eye, EyeOff, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';

interface PasswordGateProps {
  onUnlock: () => void;
}

export const PasswordGate: React.FC<PasswordGateProps> = ({ onUnlock }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remember, setRemember] = useState(true);

  // Accepted passwords
  const VALID_PASSWORDS = ['123456', 'huoivanh123', 'neobe2026', 'admin'];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = password.trim();
    if (VALID_PASSWORDS.includes(trimmed)) {
      if (remember) {
        localStorage.setItem('mooring_app_auth', 'true');
      }
      onUnlock();
    } else {
      setError('Mật khẩu không chính xác. Vui lòng thử lại!');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4 relative overflow-hidden font-sans select-none">
      {/* Background blueprint grid decoration */}
      <div className="absolute inset-0 opacity-15 pointer-events-none">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="lock-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#38bdf8" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#lock-grid)" />
        </svg>
      </div>

      {/* Decorative ambient light glows */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-brand-500/20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-sky-500/20 rounded-full blur-3xl pointer-events-none"></div>

      {/* Main Lock Card */}
      <div className="relative z-10 w-full max-w-md bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl p-8 space-y-6 animate-in fade-in zoom-in-95 duration-300">
        {/* Header with Brand Icon */}
        <div className="text-center space-y-3">
          <div className="relative inline-flex">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-600 via-sky-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-brand-500/30 ring-4 ring-slate-800">
              <Anchor className="w-8 h-8 text-white" />
            </div>
            <div className="absolute -bottom-1 -right-1 p-1 bg-amber-500 rounded-full text-slate-950 shadow">
              <Lock className="w-3.5 h-3.5" />
            </div>
          </div>

          <div>
            <span className="text-[11px] font-bold tracking-widest text-brand-400 uppercase bg-brand-950/80 px-3 py-1 rounded-full border border-brand-800/60 inline-block mb-2">
              Hệ Thống Tính Toán Kỹ Thuật
            </span>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Phần Mềm Tính Hệ Neo Bè
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Dự án Điện Mặt Trời Nổi Hồ Huổi Vanh (12 Cụm Bè Pin Nổi)
            </p>
          </div>
        </div>

        {/* Lock Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300">
              Mật khẩu truy cập hệ thống:
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                autoFocus
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Nhập mật khẩu (Mặc định: 123456)"
                className="w-full pl-10 pr-10 py-3 bg-slate-950/80 border border-slate-700 focus:border-brand-400 focus:ring-2 focus:ring-brand-400/30 rounded-xl text-white text-sm outline-none placeholder:text-slate-600 transition-all font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-rose-950/60 border border-rose-800/80 text-rose-300 rounded-xl text-xs flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Remember check */}
          <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
            <label className="flex items-center gap-2 cursor-pointer hover:text-slate-300 transition-colors">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-brand-600 focus:ring-brand-500/30 cursor-pointer"
              />
              <span>Ghi nhớ đăng nhập trên thiết bị này</span>
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full py-3 bg-gradient-to-r from-brand-600 via-sky-600 to-cyan-500 hover:from-brand-500 hover:via-sky-500 hover:to-cyan-400 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-brand-600/30 transition-all transform active:scale-[0.99]"
          >
            <span>Mở Khóa Truy Cập</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Security badge footer */}
        <div className="pt-2 border-t border-slate-800/80 text-center">
          <div className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Bảo mật dữ liệu tính toán & bản vẽ công trình</span>
          </div>
        </div>
      </div>
    </div>
  );
};
