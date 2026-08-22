import React from 'react';
import { CheckStatus, CheckItem } from '../../lib/calc/types';
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

interface VerdictBadgeProps {
  status: CheckStatus;
  governingCheck: CheckItem | null;
}

const THEME = {
  PASS: {
    wrap: 'bg-emerald-600 border-emerald-700',
    soft: 'text-emerald-100',
    icon: CheckCircle2,
    kicker: 'Kết luận tổng thể hệ thống',
    title: 'ĐẠT YÊU CẦU THIẾT KẾ'
  },
  FAIL: {
    wrap: 'bg-rose-600 border-rose-700',
    soft: 'text-rose-100',
    icon: XCircle,
    kicker: 'Kết luận tổng thể hệ thống',
    title: 'KHÔNG ĐẠT YÊU CẦU'
  },
  OTHER: {
    wrap: 'bg-amber-500 border-amber-600',
    soft: 'text-amber-50',
    icon: AlertTriangle,
    kicker: 'Kết luận tổng thể hệ thống',
    title: 'KHÔNG ĐỦ DỮ LIỆU TÍNH TOÁN'
  }
} as const;

/** Reserve as a percentage. Never prints "+-31240%" the way the old code did. */
function formatMargin(margin: number | null): string | null {
  if (margin === null || !Number.isFinite(margin)) return null;
  const pct = margin * 100;
  if (Math.abs(pct) >= 1000) return `${pct > 0 ? '>' : '<'} ${pct > 0 ? '+' : '-'}1000%`;
  return `${pct >= 0 ? '+' : '−'}${Math.abs(pct).toFixed(1)}%`;
}

export const VerdictBadge: React.FC<VerdictBadgeProps> = ({ status, governingCheck }) => {
  const theme = status === 'PASS' ? THEME.PASS : status === 'FAIL' ? THEME.FAIL : THEME.OTHER;
  const Icon = theme.icon;
  const margin = formatMargin(governingCheck?.margin ?? null);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`${theme.wrap} text-white rounded-xl border p-4 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <Icon className={`w-8 h-8 ${theme.soft} shrink-0`} aria-hidden="true" />
        <div className="min-w-0">
          <div className={`text-xs font-semibold uppercase tracking-wider ${theme.soft}`}>
            {theme.kicker}
          </div>
          <div className="text-xl font-bold tracking-tight">{theme.title}</div>
        </div>
      </div>

      {governingCheck && (
        <div className={`text-xs ${theme.soft} sm:text-right shrink-0 border-t sm:border-t-0 border-white/20 pt-3 sm:pt-0`}>
          <div>
            {status === 'FAIL' ? 'Hạng mục vi phạm nặng nhất: ' : 'Hạng mục giới hạn: '}
            <strong className="text-white">
              {governingCheck.id} — {governingCheck.label}
            </strong>
          </div>
          <div className="font-mono mt-0.5">
            Giá trị: <strong className="text-white">{governingCheck.displayActual}</strong>
            {' · '}Yêu cầu: <strong className="text-white">{String(governingCheck.threshold)}</strong>
            {margin && (
              <>
                {' · '}Dư: <strong className="text-white">{margin}</strong>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
