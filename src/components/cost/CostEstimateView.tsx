import React, { useEffect, useMemo } from 'react';
import { Receipt, Printer, FileSpreadsheet, RotateCcw, AlertTriangle } from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';
import { buildPileSchedule } from '../../lib/io/pileSchedule';
import {
  calculateCostEstimate, CostParams, BED_MATERIAL_PRESETS, BORED_PILE_PRICE_LIST, COST_REFERENCE, BedMaterialPreset
} from '../../lib/calc/costEstimate';
import { exportCostToExcel } from '../../lib/io/costExcelExport';

const vnd = (v: number) => Math.round(v).toLocaleString('vi-VN');
const ty = (v: number) => (v / 1e9).toLocaleString('vi-VN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const md = (v: number) => v.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const range = (r: [number, number]) => `${r[0].toLocaleString('vi-VN')} – ${r[1].toLocaleString('vi-VN')}`;

type NumKey = { [K in keyof CostParams]: CostParams[K] extends number ? K : never }[keyof CostParams];

const PriceField: React.FC<{
  label: string; unit: string; value: number; step: number; hint?: string; onChange: (v: number) => void;
}> = ({ label, unit, value, step, hint, onChange }) => (
  <label className="block border border-slate-200 rounded-lg px-3 py-2">
    <span className="block text-slate-600">{label}</span>
    <span className="flex items-center gap-1.5 mt-1">
      <input
        type="number"
        min={0}
        step={step}
        value={value}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v) && v >= 0) onChange(v);
        }}
        className="w-full text-right font-mono border border-slate-300 rounded px-2 py-1"
      />
      <span className="text-slate-400 shrink-0 w-14">{unit}</span>
    </span>
    {hint && <span className="block text-[11px] text-slate-400 mt-1">{hint}</span>}
  </label>
);

export const CostEstimateView: React.FC = () => {
  const { currentProject, results, batchResults, calculateAllRafts, costParams, updateCostParams, resetCostParams } = useProjectStore();

  useEffect(() => {
    if (batchResults.length === 0) calculateAllRafts();
  }, [batchResults.length, calculateAllRafts]);

  const schedule = useMemo(
    () => buildPileSchedule(currentProject, results, batchResults.length > 0 ? batchResults : undefined),
    [currentProject, results, batchResults]
  );
  const c = useMemo(() => calculateCostEstimate(costParams, schedule), [costParams, schedule]);
  const set = (key: NumKey) => (v: number) => updateCostParams({ [key]: v });
  const d350 = BORED_PILE_PRICE_LIST.find((p) => p.dia_mm === 350)!;
  const shoreDia = Math.round((currentProject.anchor.shoreD_m ?? 0.35) * 1000);
  const shoreIsBored = (currentProject.anchor.shorePileShape ?? 'square') !== 'square';
  const isPa2 = currentProject.anchor.bedAnchorOption === 'PA2_DEADWEIGHT';

  return (
    <div className="space-y-5 text-xs">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Receipt className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">Báo Giá Thi Công: Cọc Khoan Nhồi Trên Bờ & Cọc Đóng Dưới Lòng Hồ</h2>
              <p className="text-slate-500 mt-0.5">
                Khối lượng lấy từ bảng thống kê cọc của dự án. Đơn giá mặc định là mức giữa của các bảng giá tham khảo do Chủ đầu tư cung
                cấp; mọi đơn giá đều sửa được bên dưới.
              </p>
            </div>
          </div>
          <div className="no-print flex items-center gap-2">
            <button
              type="button"
              onClick={() => exportCostToExcel(currentProject, costParams, c)}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> Xuất Báo Giá Excel
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" /> In / Xuất PDF
            </button>
          </div>
        </div>

        {(isPa2 || !shoreIsBored) && (
          <div className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-rose-900">
            {isPa2 && <div>⚠️ Dự án đang chọn Phương án 2 (khối bê tông neo đáy). Báo giá này chỉ áp dụng cho Phương án 1: cọc đóng dưới lòng hồ.</div>}
            {!shoreIsBored && <div>⚠️ Cọc bờ của dự án đang là cọc vuông, không phải cọc khoan nhồi; đơn giá mục A là giá cọc khoan nhồi.</div>}
          </div>
        )}

        {/* KPI */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 sm:col-span-2 lg:col-span-1">
            <div className="text-slate-600">Tổng dự toán{costParams.includeVat ? ' (gồm VAT)' : ' (chưa VAT)'}</div>
            <div className="font-mono text-lg font-bold text-amber-900">{ty(c.grandTotal_VND)} tỷ</div>
            <div className="font-mono text-slate-600">{vnd(c.grandTotal_VND)} đ</div>
          </div>
          <div className="rounded-xl border border-slate-200 p-3">
            <div className="text-slate-600">Cọc khoan nhồi trên bờ</div>
            <div className="font-mono text-base font-bold text-slate-900">{vnd(c.shoreTotal_VND)} đ</div>
            <div className="text-slate-500">{c.totalShorePiles} cọc · {md(c.totalShoreMeters)} md</div>
          </div>
          <div className="rounded-xl border border-slate-200 p-3">
            <div className="text-slate-600">Cọc đóng dưới lòng hồ</div>
            <div className="font-mono text-base font-bold text-slate-900">{vnd(c.bedTotal_VND)} đ</div>
            <div className="text-slate-500">{c.totalBedPiles} cọc · {md(c.totalBedMeters)} md</div>
          </div>
          <div className="rounded-xl border border-slate-200 p-3">
            <div className="text-slate-600">Trung bình mỗi cụm bè (trực tiếp)</div>
            <div className="font-mono text-base font-bold text-slate-900">
              {vnd(c.raftBreakdowns.length ? c.directTotal_VND / c.raftBreakdowns.length : 0)} đ
            </div>
            <div className="text-slate-500">{c.raftBreakdowns.length} cụm bè · {c.totalPiles} cọc · {md(c.totalMeters)} md</div>
          </div>
        </div>

        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900 flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            Đơn giá tham khảo là giá cọc thương mại thông thường (bảng giá cọc đúc sẵn nêu thép chủ Φ16–Φ20). Cọc của thiết kế này có cốt
            thép nặng hơn: cọc bờ ≈ <strong>{c.shoreMainSteel_kg_m.toFixed(1)} kg</strong> thép chủ mỗi mét, cọc đáy ≈{' '}
            <strong>{c.bedMainSteel_kg_m.toFixed(1)} kg</strong> mỗi mét. Giá nhà thầu thực tế có thể cao hơn; nhập "phụ phí cốt thép" để
            điều chỉnh. Chưa gồm đài / bích neo đầu cọc, cáp neo, khảo sát và thử tải.
          </div>
        </div>
      </div>

      {/* Unit prices */}
      <div className="no-print bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Đơn giá (sửa được)</h3>
          <button type="button" onClick={resetCostParams} className="px-2.5 py-1 rounded border border-slate-300 text-slate-700 hover:bg-slate-50 flex items-center gap-1.5">
            <RotateCcw className="w-3.5 h-3.5" /> Khôi phục đơn giá mặc định (theo bảng giá tham khảo)
          </button>
        </div>

        <div>
          <div className="font-bold text-slate-800 mb-2">A. Cọc khoan nhồi trên bờ (D{shoreDia})</div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-slate-600">Cách tính:</span>
            {(['turnkey', 'detailed'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => updateCostParams({ shoreBoredCostMode: m })}
                className={`px-2.5 py-1 rounded-lg border font-semibold ${costParams.shoreBoredCostMode === m ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-slate-300 text-slate-700'}`}
              >
                {m === 'turnkey' ? 'Trọn gói (vật tư + nhân công)' : 'Tách nhân công và vật tư'}
              </button>
            ))}
            <span className="text-slate-500">Chọn nhanh theo đường kính:</span>
            {BORED_PILE_PRICE_LIST.map((p) => {
              const lab = (p.labor[0] + p.labor[1]) / 2, tk = (p.turnkey[0] + p.turnkey[1]) / 2;
              return (
                <button
                  key={p.dia_mm}
                  type="button"
                  title={`Nhân công ${range(p.labor)} · trọn gói ${range(p.turnkey)} đ/md`}
                  onClick={() => updateCostParams({ shoreTurnkeyRate_VND_m: tk, shoreLaborRate_VND_m: lab, shoreMaterialRate_VND_m: tk - lab })}
                  className={`px-2 py-1 rounded border ${p.dia_mm === shoreDia ? 'border-brand-400 bg-brand-50 font-bold' : 'border-slate-300'} hover:bg-slate-50`}
                >
                  D{p.dia_mm}
                </button>
              );
            })}
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {costParams.shoreBoredCostMode === 'turnkey' ? (
              <PriceField label="Đơn giá trọn gói" unit="đ/md" step={5000} value={costParams.shoreTurnkeyRate_VND_m} onChange={set('shoreTurnkeyRate_VND_m')} hint={`Tham khảo D350: ${range(d350.turnkey)}`} />
            ) : (
              <>
                <PriceField label="Đơn giá nhân công" unit="đ/md" step={5000} value={costParams.shoreLaborRate_VND_m} onChange={set('shoreLaborRate_VND_m')} hint={`Tham khảo D350: ${range(d350.labor)}`} />
                <PriceField label="Đơn giá vật tư" unit="đ/md" step={5000} value={costParams.shoreMaterialRate_VND_m} onChange={set('shoreMaterialRate_VND_m')} hint="Trọn gói trừ nhân công" />
              </>
            )}
            <PriceField label="Phụ phí cốt thép tăng cường" unit="đ/md" step={5000} value={costParams.shoreRebarSurcharge_VND_m} onChange={set('shoreRebarSurcharge_VND_m')} hint={`Thép chủ thiết kế ≈ ${c.shoreMainSteel_kg_m.toFixed(1)} kg/md`} />
          </div>
        </div>

        <div>
          <div className="font-bold text-slate-800 mb-2">B. Cọc vuông đúc sẵn 350×350 đóng dưới lòng hồ</div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-slate-600">Loại cọc:</span>
            {(Object.keys(BED_MATERIAL_PRESETS) as Array<Exclude<BedMaterialPreset, 'custom'>>).map((k) => (
              <button
                key={k}
                type="button"
                title={`${range(BED_MATERIAL_PRESETS[k].range)} đ/md`}
                onClick={() => updateCostParams({ bedMaterialPreset: k, bedMaterialRate_VND_m: BED_MATERIAL_PRESETS[k].rate })}
                className={`px-2.5 py-1 rounded-lg border ${costParams.bedMaterialPreset === k ? 'bg-brand-600 border-brand-600 text-white font-semibold' : 'bg-white border-slate-300 text-slate-700'}`}
              >
                {BED_MATERIAL_PRESETS[k].label} — {BED_MATERIAL_PRESETS[k].rate.toLocaleString('vi-VN')}
              </button>
            ))}
            {costParams.bedMaterialPreset === 'custom' && <span className="text-slate-500">(đang dùng giá tự nhập)</span>}
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <PriceField label="Giá cọc tại xưởng" unit="đ/md" step={5000} value={costParams.bedMaterialRate_VND_m} onChange={(v) => updateCostParams({ bedMaterialRate_VND_m: v, bedMaterialPreset: 'custom' })} />
            <PriceField label="Đóng cọc dưới nước" unit="đ/md" step={5000} value={costParams.bedDrivingRate_VND_m} onChange={set('bedDrivingRate_VND_m')} hint={`Tham khảo: ${range(COST_REFERENCE.bedDriving)}`} />
            <PriceField label="Sàn đạo nổi / sà lan (cả chiến dịch)" unit="đ" step={1000000} value={costParams.bedBargeSetup_VND} onChange={set('bedBargeSetup_VND')} hint={`Tham khảo: ${range(COST_REFERENCE.bedBargeSetup)}`} />
            <PriceField label="Vận chuyển, cẩu bốc xếp" unit="% B.1" step={0.5} value={costParams.bedLogisticsPercent} onChange={set('bedLogisticsPercent')} hint="Tham khảo: 5 – 10%" />
            <PriceField label="Phụ phí cốt thép tăng cường" unit="đ/md" step={5000} value={costParams.bedRebarSurcharge_VND_m} onChange={set('bedRebarSurcharge_VND_m')} hint={`Thép chủ thiết kế ≈ ${c.bedMainSteel_kg_m.toFixed(1)} kg/md`} />
          </div>
        </div>

        <div>
          <div className="font-bold text-slate-800 mb-2">Dự phòng và thuế</div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 items-end">
            <PriceField label="Dự phòng phí" unit="%" step={0.5} value={costParams.contingencyPercent} onChange={set('contingencyPercent')} />
            <PriceField label="Thuế VAT" unit="%" step={1} value={costParams.vatPercent} onChange={set('vatPercent')} />
            <label className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2">
              <input type="checkbox" checked={costParams.includeVat} onChange={(e) => updateCostParams({ includeVat: e.target.checked })} />
              <span className="text-slate-700">Tính VAT vào tổng</span>
            </label>
          </div>
        </div>
      </div>

      {/* Quotation table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
        <h3 className="text-sm font-bold text-slate-900">Bảng báo giá chi tiết</h3>
        <div className="overflow-x-auto">
          <table className="w-full border border-slate-200">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="px-2 py-2 text-left">STT</th>
                <th className="px-2 py-2 text-left">Hạng mục công việc</th>
                <th className="px-2 py-2 text-center">Đơn vị</th>
                <th className="px-2 py-2 text-right">Khối lượng</th>
                <th className="px-2 py-2 text-right">Đơn giá (VNĐ)</th>
                <th className="px-2 py-2 text-right">Thành tiền (VNĐ)</th>
                <th className="px-2 py-2 text-left">Căn cứ & ghi chú</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {c.lines.map((l) => (
                <tr key={l.no}>
                  <td className="px-2 py-1.5 font-bold">{l.no}</td>
                  <td className="px-2 py-1.5">{l.item}</td>
                  <td className="px-2 py-1.5 text-center">{l.unit}</td>
                  <td className="px-2 py-1.5 text-right font-mono">{l.unit === 'md' ? md(l.quantity) : l.quantity.toLocaleString('vi-VN')}</td>
                  <td className="px-2 py-1.5 text-right font-mono">{vnd(l.rate)}</td>
                  <td className="px-2 py-1.5 text-right font-mono font-bold">{vnd(l.amount_VND)}</td>
                  <td className="px-2 py-1.5 text-slate-500">{l.note}</td>
                </tr>
              ))}
              {[
                ['Cộng cọc lòng hồ (B.1 → B.4)', c.bedTotal_VND, false],
                ['CỘNG CHI PHÍ TRỰC TIẾP (A + B)', c.directTotal_VND, true],
                [`Dự phòng phí ${costParams.contingencyPercent}%`, c.contingency_VND, false],
                ['CỘNG TRƯỚC THUẾ', c.beforeVat_VND, true],
                [costParams.includeVat ? `Thuế VAT ${costParams.vatPercent}%` : 'Thuế VAT (không tính)', c.vat_VND, false],
                ['TỔNG CỘNG', c.grandTotal_VND, true]
              ].map(([label, value, strong]) => (
                <tr key={label as string} className={strong ? 'bg-slate-50 font-bold' : ''}>
                  <td />
                  <td className="px-2 py-1.5" colSpan={4}>{label as string}</td>
                  <td className="px-2 py-1.5 text-right font-mono">{vnd(value as number)}</td>
                  <td />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Per raft */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
        <h3 className="text-sm font-bold text-slate-900">Phân bổ chi phí trực tiếp theo cụm bè</h3>
        <div className="overflow-x-auto">
          <table className="w-full border border-slate-200">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="px-2 py-2 text-left">Cụm bè</th>
                <th className="px-2 py-2 text-right">Cọc bờ</th>
                <th className="px-2 py-2 text-right">Cọc bờ (md)</th>
                <th className="px-2 py-2 text-right">Tiền cọc bờ (VNĐ)</th>
                <th className="px-2 py-2 text-right">Cọc đáy</th>
                <th className="px-2 py-2 text-right">Cọc đáy (md)</th>
                <th className="px-2 py-2 text-right">Tiền cọc đáy (VNĐ)</th>
                <th className="px-2 py-2 text-right">Cộng (VNĐ)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {c.raftBreakdowns.map((b) => (
                <tr key={b.raftName}>
                  <td className="px-2 py-1.5 font-sans font-bold">{b.raftName}</td>
                  <td className="px-2 py-1.5 text-right">{b.shorePiles}</td>
                  <td className="px-2 py-1.5 text-right">{md(b.shoreMeters)}</td>
                  <td className="px-2 py-1.5 text-right">{vnd(b.shoreCost_VND)}</td>
                  <td className="px-2 py-1.5 text-right">{b.bedPiles}</td>
                  <td className="px-2 py-1.5 text-right">{md(b.bedMeters)}</td>
                  <td className="px-2 py-1.5 text-right">{vnd(b.bedCost_VND)}</td>
                  <td className="px-2 py-1.5 text-right font-bold">{vnd(b.totalCost_VND)}</td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-bold">
                <td className="px-2 py-1.5 font-sans">TỔNG</td>
                <td className="px-2 py-1.5 text-right">{c.totalShorePiles}</td>
                <td className="px-2 py-1.5 text-right">{md(c.totalShoreMeters)}</td>
                <td className="px-2 py-1.5 text-right">{vnd(c.shoreTotal_VND)}</td>
                <td className="px-2 py-1.5 text-right">{c.totalBedPiles}</td>
                <td className="px-2 py-1.5 text-right">{md(c.totalBedMeters)}</td>
                <td className="px-2 py-1.5 text-right">{vnd(c.bedTotal_VND)}</td>
                <td className="px-2 py-1.5 text-right">{vnd(c.directTotal_VND)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-slate-500">
          Chiều dài mỗi cọc = L_tk + đoạn nhô; điểm neo cọc đôi (BÈ 5) tính 2 cọc. Tiền sàn đạo nổi / sà lan phân bổ theo số mét cọc lòng
          hồ của từng bè. Dự phòng phí và VAT tính trên tổng, không phân bổ.
        </p>
      </div>
    </div>
  );
};
