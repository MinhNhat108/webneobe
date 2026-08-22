import React from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { NumberField } from './NumberField';
import anchorTypesData from '../../data/anchorTypes.json';
import soilsData from '../../data/soils.json';
import { Anchor, Building2, Hammer } from 'lucide-react';

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

      {/* PILE MODE (Broms method for Cohesive Soils) */}
      {anchor.mode === 'pile' && (
        <div className="space-y-6">
          {/* Soil parameters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-indigo-50/50 p-4 rounded-xl border border-indigo-200/70">
            <NumberField
              label="Lực dính đất BỜ (cu Đất bờ)"
              value={anchor.cuShore_kPa}
              onChange={(val) => updateAnchor({ cuShore_kPa: val })}
              unit="kPa"
              step={5}
              min={5}
              helpText="Lực dính không thoát nước của tầng đất bờ (40 kPa)"
            />

            <NumberField
              label="Lực dính bùn ĐÁY HỒ (cu Đáy hồ)"
              value={anchor.cuBed_kPa}
              onChange={(val) => updateAnchor({ cuBed_kPa: val })}
              unit="kPa"
              step={5}
              min={5}
              helpText="Lực dính của lớp bùn lòng hồ (20 kPa)"
            />

            <NumberField
              label="Hệ số an toàn cọc (Broms FS)"
              value={anchor.sfPile}
              onChange={(val) => updateAnchor({ sfPile: val })}
              unit="-"
              step={0.1}
              min={1.5}
              helpText="Hệ số an toàn sức chịu tải ngang cọc (2.5)"
            />
          </div>

          {/* Shore Pile Settings */}
          <div className="p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm">
              <Building2 className="w-4 h-4 text-indigo-600" />
              1. Cọc Neo BỜ (Đóng trên sườn bờ hồ, cáp kéo sát mặt đất)
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <NumberField
                label="Cạnh cọc vuông BỜ (D)"
                value={anchor.shoreD_m}
                onChange={(val) => updateAnchor({ shoreD_m: val })}
                unit="m"
                step={0.05}
                min={0.2}
                helpText="Kích thước tiết diện cọc BTCT vuông (0.45m)"
              />

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
              <NumberField
                label="Cạnh cọc vuông ĐÁY (D)"
                value={anchor.bed1D_m}
                onChange={(val) => updateAnchor({ bed1D_m: val })}
                unit="m"
                step={0.05}
                min={0.2}
                helpText="Tiết diện cọc đóng dưới lòng hồ (0.35m)"
              />

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
