import React, { useEffect, useMemo } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { buildPileSchedule } from '../../lib/io/pileSchedule';
import { buildShorePileHead } from '../../lib/io/shorePileHeadDetail';

/**
 * Section drawing of the bored shore-pile head and its cable connection, to
 * scale (1 unit = 1 mm), from the same data as the DXF detail.
 */
export const ShorePileHeadDetail: React.FC = () => {
  const { currentProject, results, batchResults, calculateAllRafts } = useProjectStore();
  useEffect(() => {
    if (batchResults.length === 0) calculateAllRafts();
  }, [batchResults.length, calculateAllRafts]);
  const hd = useMemo(() => {
    const batch = batchResults.length > 0 ? batchResults : undefined;
    return buildShorePileHead(currentProject, buildPileSchedule(currentProject, results, batch), batch);
  }, [currentProject, results, batchResults]);

  if (!hd) return null;
  const top = hd.pileTopAboveGround_mm, half = hd.collarSide_mm / 2, r = hd.pileDia_mm / 2;
  const plateTop = top + hd.plateThk_mm, pin = plateTop + hd.holeAbovePlate_mm;
  const Y = (y: number) => -y; // SVG y grows downwards
  const label = 'fill-slate-700 text-[26px]';

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3 text-xs">
      <div>
        <h3 className="text-sm font-bold text-slate-900">Chi tiết đầu cọc khoan nhồi bờ D{hd.pileDia_mm} và tai neo cáp</h3>
        <p className="text-slate-500 mt-0.5">
          Chi tiết đề xuất, vẽ đúng tỷ lệ, kiểm tra sơ bộ với lực kéo thiết kế {hd.designPull_kN.toFixed(1)} kN (cọc bờ chịu lực lớn nhất ×
          hệ số tải trọng). Bản vẽ gia công phải do kỹ sư kết cấu phát hành. Có trong file CAD (layer 08_CHI_TIET_COC).
        </p>
      </div>

      <div className="grid lg:grid-cols-5 gap-4">
        <svg viewBox="-900 -520 2300 1500" className="lg:col-span-3 w-full border border-slate-200 rounded-lg bg-slate-50">
          {/* soil */}
          <rect x={-900} y={Y(0)} width={2300} height={980} className="fill-amber-100" />
          <line x1={-900} y1={Y(0)} x2={1400} y2={Y(0)} className="stroke-amber-700" strokeWidth={4} />
          {/* pile shaft + cast collar */}
          <rect x={-r} y={Y(top - hd.collarDepth_mm)} width={2 * r} height={900 - hd.collarDepth_mm + top} className="fill-slate-300 stroke-slate-600" strokeWidth={3} />
          <rect x={-half} y={Y(top)} width={2 * half} height={hd.collarDepth_mm} className="fill-slate-300 stroke-slate-600" strokeWidth={3} />
          {/* anchor bars */}
          {[-1, 1].map((s) => (
            <line key={s} x1={(s * hd.anchorBarSpacing_mm) / 2} y1={Y(top)} x2={(s * hd.anchorBarSpacing_mm) / 2} y2={Y(top - hd.anchorBarLength_mm)} className="stroke-rose-600" strokeWidth={hd.anchorBarDia_mm} strokeLinecap="round" opacity={0.75} />
          ))}
          {/* cap plate + padeye */}
          <rect x={-half} y={Y(plateTop)} width={2 * half} height={hd.plateThk_mm} className="fill-slate-700" />
          <rect x={-hd.padeyeWidth_mm / 2} y={Y(plateTop + hd.padeyeHeight_mm)} width={hd.padeyeWidth_mm} height={hd.padeyeHeight_mm} className="fill-slate-500 stroke-slate-800" strokeWidth={3} />
          <circle cx={0} cy={Y(pin)} r={hd.holeDia_mm / 2} className="fill-white stroke-slate-800" strokeWidth={3} />
          {/* shackle + cable */}
          <circle cx={70} cy={Y(pin)} r={55} className="fill-none stroke-sky-700" strokeWidth={14} />
          <line x1={125} y1={Y(pin)} x2={1350} y2={Y(pin - 190)} className="stroke-sky-600" strokeWidth={12} />
          {/* e dimension */}
          <line x1={-half - 140} y1={Y(0)} x2={-half - 140} y2={Y(pin)} className="stroke-rose-600" strokeWidth={4} />
          <line x1={-half - 190} y1={Y(pin)} x2={-half - 60} y2={Y(pin)} className="stroke-rose-600" strokeWidth={3} strokeDasharray="10 8" />
          <text x={-half - 170} y={Y(pin + 40)} textAnchor="end" className="fill-rose-700 text-[30px] font-bold">e = {hd.pinAboveGround_mm} mm</text>
          {/* labels */}
          <text x={half + 30} y={Y(pin + 150)} className={label}>Ma-ní WLL {hd.shackleWll_t} T, chốt Φ{hd.shacklePin_mm}</text>
          <text x={520} y={Y(pin - 20)} className={label}>Cáp neo về phía bè</text>
          <text x={half + 30} y={Y(plateTop + 20)} className={label}>Tai neo t={hd.padeyeThk_mm}, lỗ Φ{hd.holeDia_mm}, hàn h_f={hd.weldLeg_mm}</text>
          <text x={half + 30} y={Y(-40)} className={label}>Bản mã {hd.plateSide_mm}×{hd.plateSide_mm}×{hd.plateThk_mm}</text>
          <text x={half + 30} y={Y(-170)} className={label}>Mũ cọc {hd.collarSide_mm}×{hd.collarSide_mm}, sâu {hd.collarDepth_mm}</text>
          <text x={half + 30} y={Y(-420)} className={label}>{hd.anchorBarCount}Φ{hd.anchorBarDia_mm} neo {hd.anchorBarLength_mm} mm</text>
          <text x={r + 30} y={Y(-820)} className={label}>Cọc khoan nhồi D{hd.pileDia_mm}, B25</text>
          <text x={-880} y={Y(-60)} className="fill-amber-800 text-[26px]">Mặt đất</text>
        </svg>

        <div className="lg:col-span-2 space-y-2">
          <table className="w-full border border-slate-200">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="px-2 py-1.5 text-left">Kiểm tra sơ bộ</th>
                <th className="px-2 py-1.5 text-right">Yêu cầu / Khả năng</th>
                <th className="px-2 py-1.5 text-right">η</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {hd.checks.map((c) => (
                <tr key={c.id}>
                  <td className="px-2 py-1.5">{c.id} {c.label}</td>
                  <td className="px-2 py-1.5 text-right font-mono whitespace-nowrap">
                    {c.demand.toFixed(c.unit === '-' ? 2 : 1)} / {c.capacity.toFixed(c.unit === '-' ? 2 : 1)} {c.unit === '-' ? '' : c.unit}
                  </td>
                  <td className={`px-2 py-1.5 text-right font-mono font-bold ${c.ok ? 'text-emerald-700' : 'text-rose-600'}`}>{c.utilization.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-rose-700 font-semibold">
            Yêu cầu: tim chốt cáp cách mặt đất ≤ {hd.pinAboveGround_mm} mm. Đây là điều kiện của thiết kế cốt thép cọc bờ; nâng cao tai neo
            làm tăng mômen uốn cọc.
          </p>
          <p className="text-slate-500">
            Thép tấm SS400, thép neo CB400-V, bê tông B25. Chưa thiết kế: chống gỉ (sơn / mạ kẽm), khuyên lót và đầu cáp, bê tông mũ cọc cục bộ.
          </p>
        </div>
      </div>
    </div>
  );
};
