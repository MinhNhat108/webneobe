import React from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { NumberField } from './NumberField';
import anchorTypesData from '../../data/anchorTypes.json';
import soilsData from '../../data/soils.json';
import { Anchor, Building2, Hammer, Gauge } from 'lucide-react';
import { PileShape } from '../../lib/calc/types';

const SHAPE_LABEL: Record<PileShape, string> = {
  square: 'Vuông (BTCT đúc sẵn)',
  circular: 'Tròn đặc',
  pipe: 'Cọc ống (rỗng)'
};

const ShapeSelector: React.FC<{
  value: PileShape;
  onChange: (shape: PileShape) => void;
}> = ({ value, onChange }) => (
  <div className="flex flex-col gap-1 text-sm">
    <label className="field-label">Dạng tiết diện cọc</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as PileShape)}
      className="field-input"
    >
      {(Object.keys(SHAPE_LABEL) as PileShape[]).map((s) => (
        <option key={s} value={s}>{SHAPE_LABEL[s]}</option>
      ))}
    </select>
  </div>
);

export const AnchorForm: React.FC = () => {
  const { currentProject, updateAnchor } = useProjectStore();
  const anchor = currentProject.anchor;

  const handleAnchorTypeSelect = (typeId: string) => {
    const selected = anchorTypesData.find(a => a.id === typeId);
    if (selected) {
      const hc = (selected.hc as any)[anchor.soil] || 8.0;
      updateAnchor({
        anchorType: typeId,
        holdingCoef: hc
      });
    }
  };

  const handleSoilSelect = (soilId: any) => {
    const soil = soilsData.find(s => s.id === soilId);
    const selectedAnchor = anchorTypesData.find(a => a.id === anchor.anchorType);
    const hc = selectedAnchor ? (selectedAnchor.hc as any)[soilId] || 8.0 : 8.0;
    updateAnchor({
      soil: soilId,
      holdingCoef: hc,
      frictionCoef: soil ? soil.frictionDeadweight : 0.35
    });
  };

  return (
    <div className="card p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="form-card-icon bg-indigo-50 text-indigo-600">
            <Anchor className="w-5 h-5" />
          </div>
          <div>
            <h3 className="card-title">
              4. Hệ Mỏ Neo & Cọc Neo Cố Định
            </h3>
            <p className="card-subtitle">
              Cọc bê tông đóng Broms (Neo bờ / Lòng hồ) hoặc Mỏ neo kéo / Khối bê tông
            </p>
          </div>
        </div>

        {/* Mode Selector */}
        <div className="flex rounded-lg bg-slate-100 p-1 border border-slate-200">
          <button
            type="button"
            onClick={() => updateAnchor({ mode: 'pile' })}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              anchor.mode === 'pile'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Hệ Cọc Neo Đóng (Broms)
          </button>
          <button
            type="button"
            onClick={() => updateAnchor({ mode: 'drag' })}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              anchor.mode === 'drag'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Mỏ Neo Kéo (Drag Anchor)
          </button>
          <button
            type="button"
            onClick={() => updateAnchor({ mode: 'deadweight' })}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              anchor.mode === 'deadweight'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Khối Bê Tông (Deadweight)
          </button>
        </div>
      </div>

      {/* PILE MODE (Broms method: cohesive clay/mud OR cohesionless sand) */}
      {anchor.mode === 'pile' && (
        <div className="space-y-6">
          {/* Soil parameters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-indigo-50/50 p-4 rounded-xl border border-indigo-200/70">
            {/* Shore soil */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-indigo-900 text-xs uppercase tracking-wide">Đất nền BỜ</span>
                <div className="flex rounded-lg bg-white p-0.5 border border-indigo-200 text-[11px]">
                  <button
                    type="button"
                    onClick={() => updateAnchor({ soilShore: 'clay' })}
                    className={`px-2 py-1 rounded-md font-semibold transition-colors ${(anchor.soilShore ?? 'clay') !== 'sand' ? 'bg-indigo-600 text-white' : 'text-slate-600'}`}
                  >
                    Đất dính (cu)
                  </button>
                  <button
                    type="button"
                    onClick={() => updateAnchor({ soilShore: 'sand' })}
                    className={`px-2 py-1 rounded-md font-semibold transition-colors ${anchor.soilShore === 'sand' ? 'bg-indigo-600 text-white' : 'text-slate-600'}`}
                  >
                    Đất rời (φ)
                  </button>
                </div>
              </div>
              {anchor.soilShore === 'sand' ? (
                <div className="grid grid-cols-2 gap-3">
                  <NumberField
                    label="Góc ma sát trong (φ)"
                    value={anchor.phiShore_deg}
                    onChange={(val) => updateAnchor({ phiShore_deg: val })}
                    unit="độ"
                    step={1}
                    min={15}
                    max={45}
                    helpText="Cát chặt vừa: 30°"
                  />
                  <NumberField
                    label="Dung trọng đẩy nổi (γ')"
                    value={anchor.gammaSubShore_kNm3}
                    onChange={(val) => updateAnchor({ gammaSubShore_kNm3: val })}
                    unit="kN/m³"
                    step={0.5}
                    min={5}
                    helpText="Cát: ~10 kN/m³"
                  />
                </div>
              ) : (
                <NumberField
                  label="Lực dính đất BỜ (cu)"
                  value={anchor.cuShore_kPa}
                  onChange={(val) => updateAnchor({ cuShore_kPa: val })}
                  unit="kPa"
                  step={5}
                  min={5}
                  helpText="Lực dính không thoát nước của tầng đất bờ (40 kPa)"
                />
              )}
            </div>

            {/* Bed soil */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-indigo-900 text-xs uppercase tracking-wide">Đất nền ĐÁY HỒ</span>
                <div className="flex rounded-lg bg-white p-0.5 border border-indigo-200 text-[11px]">
                  <button
                    type="button"
                    onClick={() => updateAnchor({ soilBed: 'mud' })}
                    className={`px-2 py-1 rounded-md font-semibold transition-colors ${(anchor.soilBed ?? 'mud') !== 'sand' ? 'bg-indigo-600 text-white' : 'text-slate-600'}`}
                  >
                    Đất dính (cu)
                  </button>
                  <button
                    type="button"
                    onClick={() => updateAnchor({ soilBed: 'sand' })}
                    className={`px-2 py-1 rounded-md font-semibold transition-colors ${anchor.soilBed === 'sand' ? 'bg-indigo-600 text-white' : 'text-slate-600'}`}
                  >
                    Đất rời (φ)
                  </button>
                </div>
              </div>
              {anchor.soilBed === 'sand' ? (
                <div className="grid grid-cols-2 gap-3">
                  <NumberField
                    label="Góc ma sát trong (φ)"
                    value={anchor.phiBed_deg}
                    onChange={(val) => updateAnchor({ phiBed_deg: val })}
                    unit="độ"
                    step={1}
                    min={15}
                    max={45}
                    helpText="Cát bồi lắng lòng hồ: 27-30°"
                  />
                  <NumberField
                    label="Dung trọng đẩy nổi (γ')"
                    value={anchor.gammaSubBed_kNm3}
                    onChange={(val) => updateAnchor({ gammaSubBed_kNm3: val })}
                    unit="kN/m³"
                    step={0.5}
                    min={5}
                    helpText="Cát ngậm nước: ~9-10 kN/m³"
                  />
                </div>
              ) : (
                <NumberField
                  label="Lực dính bùn ĐÁY HỒ (cu)"
                  value={anchor.cuBed_kPa}
                  onChange={(val) => updateAnchor({ cuBed_kPa: val })}
                  unit="kPa"
                  step={5}
                  min={5}
                  helpText="Lực dính của lớp bùn lòng hồ (20 kPa)"
                />
              )}
            </div>

            <div className="md:col-span-2">
              <NumberField
                label="Hệ số an toàn cọc (Broms FS)"
                value={anchor.sfPile}
                onChange={(val) => updateAnchor({ sfPile: val })}
                unit="-"
                step={0.1}
                min={1.5}
                helpText="Hệ số an toàn sức chịu tải ngang cọc (2.5) — áp dụng cho cả 2 mô hình đất dính và đất rời"
                className="max-w-xs"
              />
            </div>
          </div>

          {/* Shore Pile Settings */}
          <div className="p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm">
              <Building2 className="w-4 h-4 text-indigo-600" />
              1. Cọc Neo BỜ (Đóng trên sườn bờ hồ, cáp kéo sát mặt đất)
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <ShapeSelector
                value={anchor.shorePileShape ?? 'square'}
                onChange={(shape) => updateAnchor({ shorePileShape: shape })}
              />

              <NumberField
                label={anchor.shorePileShape === 'square' || !anchor.shorePileShape ? 'Cạnh cọc vuông BỜ (D)' : 'Đường kính ngoài BỜ (D)'}
                value={anchor.shoreD_m}
                onChange={(val) => updateAnchor({ shoreD_m: val })}
                unit="m"
                step={0.05}
                min={0.2}
                helpText="Kích thước tiết diện cọc BTCT (0.45m)"
              />

              {anchor.shorePileShape === 'pipe' && (
                <NumberField
                  label="Bề dày thành ống BỜ"
                  value={anchor.shorePileTWall_m}
                  onChange={(val) => updateAnchor({ shorePileTWall_m: val })}
                  unit="m"
                  step={0.005}
                  min={0.01}
                  helpText="Chiều dày thành cọc ống thép/BTCT (0.08m)"
                />
              )}

              <NumberField
                label="Chiều sâu ngàm cọc BỜ (L)"
                value={anchor.shoreL_m}
                onChange={(val) => updateAnchor({ shoreL_m: val })}
                unit="m"
                step={0.5}
                min={2.0}
                helpText="Chiều sâu cọc cắm vào trong đất bờ (6.5m)"
              />

              <NumberField
                label="Tay đòn điểm kéo (e)"
                value={anchor.shoreArm_e_m}
                onChange={(val) => updateAnchor({ shoreArm_e_m: val })}
                unit="m"
                step={0.1}
                min={0}
                helpText="Khoảng cách từ mặt đất tới điểm buộc cáp (0.5m)"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
              <NumberField
                label="Diện tích cốt thép dọc BỜ (As)"
                value={anchor.shoreRebarArea_mm2}
                onChange={(val) => updateAnchor({ shoreRebarArea_mm2: val })}
                unit="mm²"
                step={50}
                min={0}
                helpText="Tổng diện tích thép dọc chịu lực; 0 = bỏ qua cốt thép (chỉ tính bê tông)"
              />
              <NumberField
                label="Cường độ chảy cốt thép BỜ (fy)"
                value={anchor.shoreRebarFy_MPa}
                onChange={(val) => updateAnchor({ shoreRebarFy_MPa: val })}
                unit="MPa"
                step={10}
                min={200}
                helpText="CB300-V: 300 MPa · CB400-V: 400 MPa"
              />
            </div>
          </div>

          {/* Lake Bed Pile Settings */}
          <div className="p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm">
                <Hammer className="w-4 h-4 text-indigo-600" />
                2. Cọc Neo ĐÁY LÒNG HỒ (Dùng chung giữa các bè lân cận)
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <ShapeSelector
                value={anchor.bedPileShape ?? 'square'}
                onChange={(shape) => updateAnchor({ bedPileShape: shape })}
              />

              <NumberField
                label={anchor.bedPileShape === 'square' || !anchor.bedPileShape ? 'Cạnh cọc vuông ĐÁY (D)' : 'Đường kính ngoài ĐÁY (D)'}
                value={anchor.bed1D_m}
                onChange={(val) => updateAnchor({ bed1D_m: val })}
                unit="m"
                step={0.05}
                min={0.2}
                helpText="Tiết diện cọc đóng dưới lòng hồ (0.35m)"
              />

              {anchor.bedPileShape === 'pipe' && (
                <NumberField
                  label="Bề dày thành ống ĐÁY"
                  value={anchor.bedPileTWall_m}
                  onChange={(val) => updateAnchor({ bedPileTWall_m: val })}
                  unit="m"
                  step={0.005}
                  min={0.01}
                  helpText="Chiều dày thành cọc ống (0.08m)"
                />
              )}

              <NumberField
                label="Chiều sâu ngàm cọc ĐÁY (L)"
                value={anchor.bed1L_m}
                onChange={(val) => updateAnchor({ bed1L_m: val })}
                unit="m"
                step={0.5}
                min={3.0}
                helpText="Chiều sâu cắm vào bùn đáy hồ (8.0m)"
              />

              <NumberField
                label="Đoạn nhô trên đáy hồ"
                value={anchor.bed1Stickup_m}
                onChange={(val) => updateAnchor({ bed1Stickup_m: val })}
                unit="m"
                step={0.2}
                min={0.5}
                helpText="Đoạn cọc nhô khỏi bùn để nối cáp (1.0m)"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
              <NumberField
                label="Diện tích cốt thép dọc ĐÁY (As)"
                value={anchor.bedRebarArea_mm2}
                onChange={(val) => updateAnchor({ bedRebarArea_mm2: val })}
                unit="mm²"
                step={50}
                min={0}
                helpText="0 = bỏ qua cốt thép"
              />
              <NumberField
                label="Cường độ chảy cốt thép ĐÁY (fy)"
                value={anchor.bedRebarFy_MPa}
                onChange={(val) => updateAnchor({ bedRebarFy_MPa: val })}
                unit="MPa"
                step={10}
                min={200}
                helpText="CB300-V: 300 MPa"
              />
              <NumberField
                label="Cường độ bê tông cọc (Rb)"
                value={anchor.concreteRb_MPa}
                onChange={(val) => updateAnchor({ concreteRb_MPa: val })}
                unit="MPa"
                step={1}
                min={5}
                helpText="Bê tông B25: Rb = 14.5 MPa"
              />
            </div>

            {/* P_max & tối ưu hóa chiều sâu đóng cọc ---------------------- */}
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-4">
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-amber-600" />
                <h4 className="text-sm font-bold text-slate-800">
                  Sức chịu tải cho phép của cọc (P_max) & Tối ưu chiều sâu đóng cọc
                </h4>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Chương trình giải ngược bài toán Broms để tìm chiều sâu ngàm tối thiểu <strong>L_opt</strong> thỏa
                mãn đồng thời sức chịu tải ngang, sức chịu nhổ và bền uốn tiết diện, rồi làm tròn lên theo bước thi
                công. <strong>P_max</strong> là lực căng dây lớn nhất cọc chịu được tại chiều sâu đó; nhập giá trị
                định mức theo catalog hoặc thí nghiệm nén–kéo cọc để bật kiểm tra nhanh <strong>T_dây ≤ P_max</strong>{' '}
                (tiêu chí C10/C11). Để trống = chỉ dùng giá trị tính toán theo Broms.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <NumberField
                  label="P_max định mức — cọc BỜ"
                  value={anchor.pileRatedPmaxShore_kN}
                  onChange={(val) => updateAnchor({ pileRatedPmaxShore_kN: val })}
                  unit="kN"
                  step={10}
                  min={0}
                  placeholder="Để trống nếu chưa có"
                  helpText="Theo catalog cọc đúc sẵn / thí nghiệm kéo cọc"
                />
                <NumberField
                  label="P_max định mức — cọc LÒNG HỒ"
                  value={anchor.pileRatedPmaxBed_kN}
                  onChange={(val) => updateAnchor({ pileRatedPmaxBed_kN: val })}
                  unit="kN"
                  step={10}
                  min={0}
                  placeholder="Để trống nếu chưa có"
                  helpText="Theo catalog cọc đúc sẵn / thí nghiệm kéo cọc"
                />
                <NumberField
                  label="Hệ số an toàn tính P_req"
                  value={anchor.sfPileCapacity ?? 1.0}
                  onChange={(val) => updateAnchor({ sfPileCapacity: val })}
                  unit="-"
                  step={0.1}
                  min={1}
                  helpText="P_req = T_max × SF (mặc định 1.0)"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <NumberField
                  label="Bước làm tròn chiều sâu thi công"
                  value={anchor.pileDepthStep_m ?? 0.25}
                  onChange={(val) => updateAnchor({ pileDepthStep_m: val })}
                  unit="m"
                  step={0.25}
                  min={0.05}
                  helpText="Thường 0.25 m hoặc 0.5 m"
                />
                <NumberField
                  label="Chiều sâu ngàm tối thiểu tìm kiếm"
                  value={anchor.pileMinL_m ?? 2.0}
                  onChange={(val) => updateAnchor({ pileMinL_m: val })}
                  unit="m"
                  step={0.5}
                  min={0.5}
                  helpText="Cận dưới của thuật toán tối ưu"
                />
                <NumberField
                  label="Chiều sâu ngàm tối đa tìm kiếm"
                  value={anchor.pileMaxL_m ?? 20.0}
                  onChange={(val) => updateAnchor({ pileMaxL_m: val })}
                  unit="m"
                  step={0.5}
                  min={1}
                  helpText="Cận trên (giới hạn chiều dài cọc thi công được)"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DRAG / DEADWEIGHT ANCHOR MODE */}
      {(anchor.mode === 'drag' || anchor.mode === 'deadweight') && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
            <div className="flex flex-col gap-1 text-sm">
              <label className="font-medium text-slate-700">Loại chất đất đáy biển / hồ</label>
              <select
                value={anchor.soil}
                onChange={(e) => handleSoilSelect(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:border-brand-500 outline-none"
              >
                {soilsData.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {anchor.mode === 'drag' && (
              <div className="flex flex-col gap-1 text-sm">
                <label className="font-medium text-slate-700">Kiểu mỏ neo kéo</label>
                <select
                  value={anchor.anchorType}
                  onChange={(e) => handleAnchorTypeSelect(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:border-brand-500 outline-none"
                >
                  {anchorTypesData.filter(a => a.id !== 'deadweight').map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <NumberField
              label="Trọng lượng 1 mỏ neo (không khí)"
              value={anchor.weight_t}
              onChange={(val) => updateAnchor({ weight_t: val })}
              unit="tấn"
              step={0.1}
              min={0.1}
              helpText="Khối lượng mỏ neo hoặc khối bê tông"
            />

            {anchor.mode === 'drag' ? (
              <NumberField
                label="Hệ số bám neo (Holding Coef HC)"
                value={anchor.holdingCoef}
                onChange={(val) => updateAnchor({ holdingCoef: val })}
                unit="-"
                step={0.5}
                min={1}
                helpText="R_anchor = HC * W * g (Tra theo loại neo và đất)"
              />
            ) : (
              <NumberField
                label="Hệ số ma sát trượt đáy (μ)"
                value={anchor.frictionCoef}
                onChange={(val) => updateAnchor({ frictionCoef: val })}
                unit="-"
                step={0.05}
                min={0.1}
                helpText="R_anchor = μ * W_chìm * g"
              />
            )}

            {anchor.mode === 'deadweight' && (
              <NumberField
                label="Khối lượng riêng bê tông (ρ_concrete)"
                value={anchor.concreteDensity}
                onChange={(val) => updateAnchor({ concreteDensity: val })}
                unit="kg/m³"
                step={50}
                min={1500}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
