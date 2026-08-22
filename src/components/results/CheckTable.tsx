import React from 'react';
import { CheckItem, CheckStatus } from '../../lib/calc/types';
import { CheckCircle2, XCircle, AlertCircle, MinusCircle, HelpCircle } from 'lucide-react';

interface CheckTableProps {
  checks: CheckItem[];
}

const STATUS = {
  PASS: { cls: 'badge-pass', icon: CheckCircle2, text: 'ĐẠT' },
  FAIL: { cls: 'badge-fail', icon: XCircle, text: 'KHÔNG ĐẠT' },
  NA: { cls: 'badge-na', icon: AlertCircle, text: 'KHÔNG TÍNH ĐƯỢC' },
  SKIP: { cls: 'badge-skip', icon: MinusCircle, text: 'KHÔNG ÁP DỤNG' }
} as const;

const StatusBadge: React.FC<{ status: CheckStatus }> = ({ status }) => {
  const s = STATUS[status] ?? STATUS.NA;
  const Icon = s.icon;
  return (
    <span className={`badge ${s.cls}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      {s.text}
    </span>
  );
};

function formatMargin(margin: number | null): { text: string; cls: string } {
  if (margin === null || !Number.isFinite(margin)) return { text: '—', cls: 'text-slate-400' };
  const pct = margin * 100;
  const cls = margin >= 0 ? 'text-emerald-700' : 'text-rose-700';
  if (Math.abs(pct) >= 1000) return { text: pct > 0 ? '> +1000%' : '< −1000%', cls };
  return { text: `${pct >= 0 ? '+' : '−'}${Math.abs(pct).toFixed(1)}%`, cls };
}

export const CheckTable: React.FC<CheckTableProps> = ({ checks }) => {
  const counts = checks.reduce<Record<string, number>>((acc, c) => {
    acc[c.status] = (acc[c.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <section className="card card-pad">
      <header className="card-header">
        <div>
          <h3 className="card-title">Bảng kiểm tra &amp; đánh giá an toàn</h3>
          <p className="card-subtitle">
            Bền cáp / xích, ổn định mỏ neo và sức chịu lực của cọc neo — theo từng điều kiện thiết kế
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 shrink-0">
          {counts.PASS > 0 && <span className="badge badge-pass">{counts.PASS} ĐẠT</span>}
          {counts.FAIL > 0 && <span className="badge badge-fail">{counts.FAIL} KHÔNG ĐẠT</span>}
          {counts.NA > 0 && <span className="badge badge-na">{counts.NA} N/A</span>}
          {counts.SKIP > 0 && <span className="badge badge-skip">{counts.SKIP} K.A.D</span>}
        </div>
      </header>

      <div className="table-wrap">
        <table className="data-table">
          <caption className="sr-only">
            Bảng kiểm tra điều kiện an toàn hệ neo bè, kết luận ĐẠT hoặc KHÔNG ĐẠT theo từng hạng mục
          </caption>
          <thead>
            <tr>
              <th scope="col" className="w-14">Mã</th>
              <th scope="col">Hạng mục kiểm tra</th>
              <th scope="col">Công thức</th>
              <th scope="col" className="text-right">Giá trị tính</th>
              <th scope="col" className="text-right">Ngưỡng</th>
              <th scope="col" className="text-center">Dư an toàn</th>
              <th scope="col" className="text-center">Kết luận</th>
            </tr>
          </thead>
          <tbody>
            {checks.map((item) => {
              const margin = formatMargin(item.margin);
              const isSkip = item.status === 'SKIP';
              return (
                <tr
                  key={item.id}
                  className={
                    item.status === 'FAIL'
                      ? 'bg-rose-50/60'
                      : item.status === 'NA'
                      ? 'bg-amber-50/50'
                      : isSkip
                      ? 'opacity-60'
                      : undefined
                  }
                >
                  <th scope="row" className="px-4 py-3 font-mono font-bold text-slate-900 align-top border-b border-slate-100">
                    {item.id}
                  </th>
                  <td>
                    <div className="font-medium text-slate-800">
                      {item.label}
                      {!item.isMandatory && (
                        <span className="ml-2 badge badge-muted !py-0 !text-[10px]">cảnh báo</span>
                      )}
                    </div>
                    {item.note && (
                      <div className="text-[11px] text-slate-500 font-mono mt-1 leading-snug">
                        {item.note}
                      </div>
                    )}
                  </td>
                  <td className="font-mono text-[11px] text-slate-600">{item.formula}</td>
                  <td className={`num font-bold ${isSkip ? 'text-slate-400 font-normal' : 'text-slate-900'}`}>
                    {item.displayActual}
                    {item.actual !== null && item.unit !== '-' ? ` ${item.unit}` : ''}
                  </td>
                  <td className="num text-slate-600">{String(item.threshold)}</td>
                  <td className={`num text-center font-semibold ${margin.cls}`}>{margin.text}</td>
                  <td className="text-center">
                    <StatusBadge status={item.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="callout callout-info mt-4 flex items-start gap-2">
        <HelpCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="space-y-1">
          <p>
            <strong>ĐẠT</strong> chỉ đạt được khi <strong>toàn bộ</strong> điều kiện bắt buộc đều thỏa mãn.
          </p>
          <p>
            <strong>KHÔNG TÍNH ĐƯỢC</strong> nghĩa là hạng mục <em>có áp dụng</em> nhưng thiếu dữ liệu —
            kết luận tổng thể không thể là ĐẠT. <strong>KHÔNG ÁP DỤNG</strong> nghĩa là hạng mục không
            thuộc cấu hình neo đang tính (ví dụ: kiểm tra dây võng catenary với hệ neo căng vào cọc).
          </p>
          <p>
            <strong>Dư an toàn</strong> = 1 / (mức huy động) − 1: +25% nghĩa là còn dư 25% khả năng chịu lực.
          </p>
        </div>
      </div>
    </section>
  );
};
