import React, { useEffect, useMemo, useState } from 'react';
import {
  Wind,
  Layers,
  Info,
  Compass,
  Upload,
  Download,
  CheckCircle2,
  FileCode,
  Eye,
  Camera,
  RotateCcw
} from 'lucide-react';
import {
  WindParams,
  LayerVisibility,
  SelectedElement,
  LoadedIfcMetadata
} from './types';
import { generateHuoiVanhSampleIfc } from './sampleIfcGenerator';
import { parseIfcFile } from './ifcLoader';
import {
  MNC_M,
  MNDB_M,
  MNLKT_M,
  SPILL_LEVEL_M,
  RAFT_MODELS,
  raftWaterline,
  buildPileModels,
  RaftMooringState
} from './sceneModel';
import { useProjectStore } from '../../store/useProjectStore';

/** Slider range of the reservoir level, project datum. */
export const WATER_LEVEL_MIN_M = 378.5;
export const WATER_LEVEL_MAX_M = 390.0;

interface SimulationControlsProps {
  windParams: WindParams;
  onWindParamsChange: (params: WindParams) => void;
  layers: LayerVisibility;
  onLayersChange: (layers: LayerVisibility) => void;
  waterLevel_m: number;
  onWaterLevelChange: (val: number) => void;
  selectedElement: SelectedElement | null;
  onClearSelection: () => void;
  ifcData: LoadedIfcMetadata | null;
  onIfcDataLoaded: (data: LoadedIfcMetadata | null) => void;
  onSetCameraPreset: (preset: 'overview' | 'topDown' | 'waterLevel' | 'raftFocus', raftId?: number) => void;
  onResetCamera: () => void;
  onCaptureSnapshot: () => void;
  /** Engine results per raft at the current wind speed. */
  mooringStates: Map<string, RaftMooringState>;
}

export const SimulationControls: React.FC<SimulationControlsProps> = ({
  windParams,
  onWindParamsChange,
  layers,
  onLayersChange,
  waterLevel_m,
  onWaterLevelChange,
  selectedElement,
  onClearSelection,
  ifcData,
  onIfcDataLoaded,
  onSetCameraPreset,
  onResetCamera,
  onCaptureSnapshot,
  mooringStates
}) => {
  const [activeTab, setActiveTab] = useState<'wind' | 'layers' | 'inspector'>('wind');
  const [isParsingIfc, setIsParsingIfc] = useState(false);
  const [ifcProgressText, setIfcProgressText] = useState('');
  const [selectedFocusRaft, setSelectedFocusRaft] = useState<number>(1);

  // Speed presets
  const speedPresets = [
    { label: 'Gió nhẹ', speed: 8 },
    { label: 'Thường nhật', speed: 15 },
    { label: 'Thiết kế Huổi Vanh', speed: 29.7 },
    { label: 'Bão cực đoan', speed: 38 }
  ];

  // Wind direction compass directions
  const directions = [
    { label: 'B (0°)', deg: 0 },
    { label: 'ĐB (45°)', deg: 45 },
    { label: 'Đ (90°)', deg: 90 },
    { label: 'ĐN (135°)', deg: 135 },
    { label: 'N (180°)', deg: 180 },
    { label: 'TN (225°)', deg: 225 },
    { label: 'T (270°)', deg: 270 },
    { label: 'TB (315°)', deg: 315 }
  ];

  // Engine results for the 12 rafts at the current wind (replaces the old
  // made-up estimates: "T = 22 + (V/29.7)² × 98 kN, SF = 140 / T", which
  // showed SF 1.17 at the design wind while the engine gives 3.2–4.0).
  const sfCriterion = useProjectStore((s) => s.currentProject.criteria.sfLineIntact) ?? 3.0;
  const states = [...mooringStates.values()];
  const envTotal_kN = states.reduce((sum, st) => sum + st.envForce_kN, 0);
  const worstTension = states.reduce<RaftMooringState | null>((w, st) => (!w || st.tension_kN > w.tension_kN ? st : w), null);
  const worstSf = states.reduce<RaftMooringState | null>((w, st) => (!w || st.safetyFactor < w.safetyFactor ? st : w), null);
  const worstUtil = states.reduce<RaftMooringState | null>((w, st) => (!w || st.cableUtil > w.cableUtil ? st : w), null);
  const passCount = states.filter((st) => st.verdict === 'PASS').length;
  // The cards describe the raft picked in the "Cụm" selector; the 12-raft
  // extremes stay as a secondary line so the governing raft is not lost.
  const focusName = `BÈ ${selectedFocusRaft}`;
  const focusState = mooringStates.get(focusName) ?? null;
  // The raft being edited in Tab 2, when its inputs depart from the frozen design.
  const trialState = states.find((st) => st.isActive && st.deviations.length > 0) ?? null;

  // Clicking a raft, cable or pile in the 3D view selects its raft here too
  // (without moving the camera, which would fight the user's own navigation).
  useEffect(() => {
    if (!selectedElement) return;
    const raftName = selectedElement.type === 'raft' ? selectedElement.id : selectedElement.data['Thuộc cụm bè'];
    const m = typeof raftName === 'string' ? /^BÈ (\d+)$/.exec(raftName) : null;
    if (m) setSelectedFocusRaft(Number(m[1]));
  }, [selectedElement]);

  // What the chosen reservoir level does to the mooring system.
  const shoreArm = useProjectStore((s) => s.currentProject.anchor.shoreArm_e_m);
  const bedStickup = useProjectStore((s) => s.currentProject.anchor.bed1Stickup_m);
  const piles = useMemo(() => buildPileModels({ shoreArm_e_m: shoreArm, bed1Stickup_m: bedStickup }), [shoreArm, bedStickup]);
  const isPa2 = useProjectStore((s) => s.currentProject.anchor.bedAnchorOption) === 'PA2_DEADWEIGHT';
  const floodedShoreHeads = piles.filter((p) => p.type === 'SHORE' && p.head_m < waterLevel_m).length;
  const dryBedPiles = piles.filter((p) => p.type === 'BED' && p.ground_m >= waterLevel_m).map((p) => p.code);
  const agroundRafts = RAFT_MODELS.filter((r) => raftWaterline(r, waterLevel_m).aground).map((r) => r.name);

  // Handle IFC File Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsParsingIfc(true);
      setIfcProgressText('Bắt đầu tải file...');
      const metadata = await parseIfcFile(file, (percent, step) => {
        setIfcProgressText(`${step} (${percent}%)`);
      });
      onIfcDataLoaded(metadata);
      // Ensure IFC layer is turned on
      onLayersChange({ ...layers, ifcModel: true });
    } catch (err: any) {
      alert(`Lỗi khi nạp file IFC: ${err?.message || err}`);
    } finally {
      setIsParsingIfc(false);
      setIfcProgressText('');
    }
  };

  // Download Sample Huổi Vanh IFC File
  const handleDownloadSampleIfc = () => {
    const ifcContent = generateHuoiVanhSampleIfc();
    const blob = new Blob([ifcContent], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Huoi_Vanh_FPV_Mooring_Model.ifc';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-md flex flex-col overflow-hidden">
      {/* Top Tab Bar */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-3 pt-2">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('wind')}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-t-xl text-xs font-bold transition-all border-b-2 ${
              activeTab === 'wind'
                ? 'bg-white text-brand-700 border-brand-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 border-transparent'
            }`}
          >
            <Wind className="w-4 h-4 text-brand-600" />
            1. Gió & Khí Động Lực
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('layers')}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-t-xl text-xs font-bold transition-all border-b-2 ${
              activeTab === 'layers'
                ? 'bg-white text-brand-700 border-brand-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 border-transparent'
            }`}
          >
            <Layers className="w-4 h-4 text-emerald-600" />
            2. Lớp 3D & File IFC
            {ifcData && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('inspector')}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-t-xl text-xs font-bold transition-all border-b-2 ${
              activeTab === 'inspector'
                ? 'bg-white text-brand-700 border-brand-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 border-transparent'
            }`}
          >
            <Info className="w-4 h-4 text-cyan-600" />
            3. Chi Tiết Đối Tượng
            {selectedElement && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            )}
          </button>
        </div>

        {/* Quick Toolbar */}
        <div className="flex items-center gap-1.5 pb-1">
          <button
            type="button"
            onClick={onCaptureSnapshot}
            title="Chụp ảnh 3D độ phân giải cao"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-sm transition"
          >
            <Camera className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Chụp Ảnh</span>
          </button>
          <button
            type="button"
            onClick={onResetCamera}
            title="Đặt lại camera về góc nhìn toàn cảnh"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-sm transition"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Reset Góc</span>
          </button>
        </div>
      </div>

      {/* Design basis strip (single, final layout — the V1 comparison was retired) */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-slate-500 font-bold uppercase text-[11px] tracking-wider">Mặt bằng thiết kế:</span>
        <span className="px-3 py-1 rounded-lg text-xs font-bold bg-brand-600 text-white shadow-sm">
          {isPa2
            ? '12 cụm bè · 90.724 m² · PA2: 129 cọc bờ + 175 khối bê tông neo đáy'
            : '12 cụm bè · 90.724 m² · 304 cọc (129 bờ + 175 đáy)'}
        </span>
      </div>

      {/* Camera View Switcher Strip */}
      <div className="bg-slate-100/70 border-b border-slate-200 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-slate-500 font-medium">Góc quan sát:</span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onSetCameraPreset('overview')}
            className="px-2.5 py-1 rounded bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-medium transition"
          >
            🌐 Toàn Cảnh
          </button>
          <button
            type="button"
            onClick={() => onSetCameraPreset('topDown')}
            className="px-2.5 py-1 rounded bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-medium transition"
          >
            🗺️ Mặt Bằng 2D
          </button>
          <button
            type="button"
            onClick={() => onSetCameraPreset('waterLevel')}
            className="px-2.5 py-1 rounded bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-medium transition"
          >
            🌊 Mặt Nước Catenary
          </button>
          <div className="flex items-center gap-1 pl-2 border-l border-slate-300">
            <span className="text-slate-500">Cụm:</span>
            <select
              value={selectedFocusRaft}
              onChange={(e) => {
                const val = Number(e.target.value);
                setSelectedFocusRaft(val);
                onSetCameraPreset('raftFocus', val);
              }}
              className="px-2 py-0.5 rounded bg-white text-slate-800 border border-slate-200 font-bold"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((num) => (
                <option key={num} value={num}>
                  BÈ {num}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tab 1 Content: Wind Aerodynamics */}
      {activeTab === 'wind' && (
        <div className="p-4 space-y-5 animate-fade-in">
          {trialState && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <div className="font-bold">
                ⚠️ {trialState.name} đang thử nghiệm – khác thiết kế chốt (theo thông số nhập ở Tab 2)
              </div>
              <ul className="mt-1 space-y-0.5 text-[11px]">
                {trialState.deviations.map((d) => (
                  <li key={d.label}>
                    {d.label}: <span className="line-through text-amber-700">{String(d.design)}</span> →{' '}
                    <strong>{String(d.current)}</strong>
                  </li>
                ))}
              </ul>
              <div className="mt-1 text-[11px] text-amber-800">
                11 bè còn lại theo thiết kế chốt. Vị trí 304 cọc / tuyến cáp giữ nguyên theo mặt bằng CAD
                {trialState.deviations.some((d) => d.label.startsWith('Số dây'))
                  ? ': số dây mới chỉ đưa vào tính toán, hình vẽ không thêm / bớt dây'
                  : ''}.
              </div>
            </div>
          )}

          {/* Live Telemetry Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-brand-50/70 border border-brand-200 rounded-xl p-3">
              <div className="text-slate-500">Vận tốc gió Vw</div>
              <div className="font-mono text-base font-bold text-brand-900 mt-0.5">
                {windParams.speed.toFixed(1)} m/s
              </div>
              <div className="text-[11px] text-brand-700 font-mono">
                {((windParams.speed * 3.6)).toFixed(1)} km/h
              </div>
            </div>

            <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3">
              <div className="text-slate-500">Tổng lực môi trường</div>
              <div className="font-mono text-base font-bold text-emerald-900 mt-0.5">
                {focusState ? `${focusState.envForce_kN.toFixed(1)} kN` : '—'}
              </div>
              <div className="text-[11px] text-emerald-700">{focusName}{focusState?.isActive && focusState.deviations.length > 0 ? ' ⚠️ thử nghiệm' : ''} (gió + dòng + sóng)</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Cả 12 cụm: {envTotal_kN.toFixed(0)} kN</div>
            </div>

            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3">
              <div className="text-slate-500">Lực căng cáp thiết kế</div>
              <div className="font-mono text-base font-bold text-amber-900 mt-0.5">
                {focusState ? `${focusState.tension_kN.toFixed(1)} kN` : '—'}
              </div>
              <div className="text-[11px] text-amber-700">
                {focusState ? `${focusName} · ${focusState.cable} · η ${focusState.cableUtil.toFixed(2)}` : ''}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {worstTension ? `Lớn nhất: ${worstTension.tension_kN.toFixed(1)} kN (${worstTension.name}) · η max ${worstUtil?.cableUtil.toFixed(2)} (${worstUtil?.name})` : ''}
              </div>
            </div>

            <div className="bg-cyan-50/70 border border-cyan-200 rounded-xl p-3">
              <div className="text-slate-500">SF cáp</div>
              <div className="font-mono text-base font-bold text-cyan-900 mt-0.5">
                {focusState ? focusState.safetyFactor.toFixed(2) : '—'}
              </div>
              <div className="text-[11px] text-cyan-700 font-medium">
                {focusState ? `${focusName} · ${focusState.safetyFactor >= sfCriterion ? '✅' : '⚠️'} tiêu chí ≥ ${sfCriterion}` : ''}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {worstSf ? `Nhỏ nhất: ${worstSf.safetyFactor.toFixed(2)} (${worstSf.name}) · ${passCount}/12 bè ĐẠT` : ''}
              </div>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed -mt-2">
            Số liệu của cụm bè đang chọn (ô "Cụm" phía trên, hoặc bấm vào bè / cáp / cọc trên mô hình 3D), tính trực tiếp
            bằng bộ tính toán của dự án tại vận tốc gió đang chọn; dòng nhỏ bên dưới là giá trị tổng / bất lợi nhất của cả
            12 cụm. Lực căng là giá trị thiết kế bất lợi nhất của bè (không phụ thuộc hướng gió); màu cáp và cọc trên mô
            hình 3D theo hệ số sử dụng của chính bè đó.
          </p>

          {/* Wind Speed Slider & Presets */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <span className="flex items-center gap-1.5">
                <Wind className="w-4 h-4 text-brand-600" />
                Vận tốc gió (m/s)
              </span>
              <span className="font-mono text-sm text-brand-600 font-bold bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                {windParams.speed.toFixed(1)} m/s
              </span>
            </div>

            <input
              type="range"
              min={0}
              max={45}
              step={0.5}
              value={windParams.speed}
              onChange={(e) =>
                onWindParamsChange({ ...windParams, speed: parseFloat(e.target.value) })
              }
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-600"
            />

            {/* Presets buttons */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {speedPresets.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => onWindParamsChange({ ...windParams, speed: preset.speed })}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                    Math.abs(windParams.speed - preset.speed) < 0.1
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {preset.label} ({preset.speed} m/s)
                </button>
              ))}
            </div>
          </div>

          {/* Wind Direction (Compass Rose) */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <span className="flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-amber-600" />
                Hướng gió thổi (Góc phương vị 0° đến 360°)
              </span>
              <span className="font-mono text-sm text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                {windParams.direction}°
              </span>
            </div>

            <input
              type="range"
              min={0}
              max={360}
              step={5}
              value={windParams.direction}
              onChange={(e) =>
                onWindParamsChange({ ...windParams, direction: parseInt(e.target.value, 10) })
              }
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
            />

            <div className="grid grid-cols-4 sm:grid-cols-8 gap-1 pt-1">
              {directions.map((d) => (
                <button
                  key={d.label}
                  type="button"
                  onClick={() => onWindParamsChange({ ...windParams, direction: d.deg })}
                  className={`py-1 rounded text-center text-xs font-medium transition ${
                    windParams.direction === d.deg
                      ? 'bg-amber-600 text-white font-bold shadow-sm'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Water Level Elevation Slider */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <span>Mực nước hồ (cao độ dự án)</span>
              <span className="font-mono text-sm text-cyan-700 font-bold bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200">
                {waterLevel_m.toFixed(2)} m
              </span>
            </div>

            <input
              type="range"
              min={WATER_LEVEL_MIN_M}
              max={WATER_LEVEL_MAX_M}
              step={0.1}
              value={waterLevel_m}
              onChange={(e) => onWaterLevelChange(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-cyan-600"
            />
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: `MNC ${MNC_M}`, v: MNC_M },
                { label: `MNDB ${MNDB_M}`, v: MNDB_M },
                { label: `MNLKT ${MNLKT_M}`, v: MNLKT_M },
                { label: `Kịch bản ${WATER_LEVEL_MAX_M}`, v: WATER_LEVEL_MAX_M }
              ].map((b) => (
                <button
                  key={b.label}
                  type="button"
                  onClick={() => onWaterLevelChange(b.v)}
                  className={`px-2 py-1 rounded text-[11px] font-medium border transition ${
                    Math.abs(waterLevel_m - b.v) < 0.05
                      ? 'bg-cyan-600 text-white border-cyan-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {b.label} m
                </button>
              ))}
            </div>

            {/* What this level does to the moorings */}
            <div className={`p-2.5 rounded-xl text-xs space-y-1 border ${
              waterLevel_m > SPILL_LEVEL_M || agroundRafts.length > 0
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : waterLevel_m > MNDB_M + 0.05
                ? 'bg-amber-50 border-amber-200 text-amber-800'
                : 'bg-cyan-50 border-cyan-200 text-cyan-800'
            }`}>
              <div className="flex items-center justify-between font-medium">
                <span>
                  {waterLevel_m > SPILL_LEVEL_M
                    ? `Trên cao độ tràn theo địa hình IFC (~${SPILL_LEVEL_M.toFixed(1)} m): kịch bản giả định.`
                    : waterLevel_m > MNLKT_M
                    ? 'Trên mực nước lũ kiểm tra.'
                    : waterLevel_m > MNDB_M + 0.05
                    ? 'Mực nước lũ: bè dâng cao, góc cáp thay đổi.'
                    : waterLevel_m < MNDB_M - 0.05
                    ? 'Mực nước hạ thấp hơn MNDB.'
                    : 'Mực nước dâng bình thường (MNDB).'}
                </span>
                <span className="font-mono font-bold shrink-0 ml-2">
                  ΔZ = {waterLevel_m - MNDB_M >= 0 ? '+' : ''}{(waterLevel_m - MNDB_M).toFixed(2)} m
                </span>
              </div>
              <div className="text-[11px] leading-relaxed">
                Bè mắc cạn: <strong>{agroundRafts.length ? agroundRafts.join(', ') : 'không'}</strong>
                {' · '}Đỉnh cọc bờ bị ngập: <strong>{floodedShoreHeads}/129</strong>
                {' · '}{isPa2 ? 'Khối neo đáy' : 'Cọc đáy'} nằm trên mặt nước: <strong>{dryBedPiles.length}/175</strong>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Địa hình là Toposolid của file IFC, quy đổi về cao độ dự án: mặt nước mô hình IFC 402,0 m ≡ MNDB 384,5 m
              (lệch 17,5 m). Nước chỉ dâng trong lòng hồ, tính từ các cụm bè ra.
            </p>
          </div>
        </div>
      )}

      {/* Tab 2 Content: 3D Layers & IFC Model */}
      {activeTab === 'layers' && (
        <div className="p-4 space-y-5 animate-fade-in">
          {/* IFC Upload Zone */}
          <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl p-4 text-center space-y-3">
            <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-600 mx-auto flex items-center justify-center">
              <Upload className="w-5 h-5" />
            </div>

            <div>
              <div className="text-xs font-bold text-slate-800">
                Nạp Mô Hình BIM / IFC Dự Án (.ifc)
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Kéo thả file IFC địa hình hồ, bè pin, cáp neo hoặc cọc neo
              </div>
            </div>

            <div className="flex items-center justify-center gap-2">
              <label className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white cursor-pointer shadow-sm transition">
                <FileCode className="w-3.5 h-3.5" />
                Chọn File .IFC
                <input
                  type="file"
                  accept=".ifc"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                onClick={handleDownloadSampleIfc}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-sm transition"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                Tải IFC Mẫu Hồ Huổi Vanh
              </button>
            </div>

            {isParsingIfc && (
              <div className="text-xs text-brand-600 font-mono animate-pulse font-medium pt-1">
                ⏳ {ifcProgressText}
              </div>
            )}

            {ifcData && (
              <div className="mt-3 p-3 bg-white rounded-lg border border-emerald-200 text-left text-xs space-y-1">
                <div className="flex items-center justify-between text-emerald-800 font-bold">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Đã tải mô hình: {ifcData.fileName}
                  </span>
                  <button
                    type="button"
                    onClick={() => onIfcDataLoaded(null)}
                    className="text-[11px] text-rose-600 hover:underline"
                  >
                    Gỡ bỏ
                  </button>
                </div>
                <div className="text-[11px] text-slate-500">
                  Dung lượng: {(ifcData.fileSize / 1024).toFixed(1)} KB | Tổng đối tượng hình học: {ifcData.elementCount}
                </div>
                <div className="flex flex-wrap gap-2 text-[10px] text-slate-600 pt-1">
                  <span className="bg-slate-100 px-1.5 py-0.5 rounded">Địa hình: {ifcData.categories.terrain}</span>
                  <span className="bg-slate-100 px-1.5 py-0.5 rounded">Bè pin: {ifcData.categories.rafts}</span>
                  <span className="bg-slate-100 px-1.5 py-0.5 rounded">Cáp neo: {ifcData.categories.cables}</span>
                  <span className="bg-slate-100 px-1.5 py-0.5 rounded">Cọc neo: {ifcData.categories.piles}</span>
                </div>
              </div>
            )}
          </div>

          {/* Layer Visibility Toggles */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Bật / Tắt Lớp Hiển Thị 3D
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <label className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-50 hover:bg-slate-100 cursor-pointer">
                <input
                  type="checkbox"
                  checked={layers.rafts}
                  onChange={(e) => onLayersChange({ ...layers, rafts: e.target.checked })}
                  className="rounded text-brand-600 focus:ring-brand-500"
                />
                <span className="font-medium text-slate-700">☀️ 12 Cụm Bè Pin Nổi</span>
              </label>

              <label className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-50 hover:bg-slate-100 cursor-pointer">
                <input
                  type="checkbox"
                  checked={layers.solarPanels}
                  onChange={(e) => onLayersChange({ ...layers, solarPanels: e.target.checked })}
                  className="rounded text-brand-600 focus:ring-brand-500"
                />
                <span className="font-medium text-slate-700">⚡ Giàn Pin Mặt Trời PV</span>
              </label>

              <label className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-50 hover:bg-slate-100 cursor-pointer">
                <input
                  type="checkbox"
                  checked={layers.mooringLines}
                  onChange={(e) => onLayersChange({ ...layers, mooringLines: e.target.checked })}
                  className="rounded text-brand-600 focus:ring-brand-500"
                />
                <span className="font-medium text-slate-700">⚓ 304 tuyến cáp neo (cáp căng thẳng)</span>
              </label>

              <label className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-50 hover:bg-slate-100 cursor-pointer">
                <input
                  type="checkbox"
                  checked={layers.shorePiles}
                  onChange={(e) => onLayersChange({ ...layers, shorePiles: e.target.checked })}
                  className="rounded text-brand-600 focus:ring-brand-500"
                />
                <span className="font-medium text-slate-700">📍 129 cọc neo bờ (vuông BTCT)</span>
              </label>

              <label className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-50 hover:bg-slate-100 cursor-pointer">
                <input
                  type="checkbox"
                  checked={layers.bedPiles}
                  onChange={(e) => onLayersChange({ ...layers, bedPiles: e.target.checked })}
                  className="rounded text-brand-600 focus:ring-brand-500"
                />
                <span className="font-medium text-slate-700">
                  {isPa2 ? '🧱 175 khối bê tông neo đáy (PA2)' : '📍 175 cọc đáy hồ (vuông BTCT)'}
                </span>
              </label>

              <label className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-50 hover:bg-slate-100 cursor-pointer">
                <input
                  type="checkbox"
                  checked={layers.waterSurface}
                  onChange={(e) => onLayersChange({ ...layers, waterSurface: e.target.checked })}
                  className="rounded text-brand-600 focus:ring-brand-500"
                />
                <span className="font-medium text-slate-700">🌊 Mặt Nước Hồ Thủy Điện</span>
              </label>

              <label className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-50 hover:bg-slate-100 cursor-pointer">
                <input
                  type="checkbox"
                  checked={layers.lakeTerrain}
                  onChange={(e) => onLayersChange({ ...layers, lakeTerrain: e.target.checked })}
                  className="rounded text-brand-600 focus:ring-brand-500"
                />
                <span className="font-medium text-slate-700">⛰️ Địa Hình Lòng Hồ & Sườn Đồi</span>
              </label>

              <label className="flex items-center gap-2.5 p-2 rounded-lg bg-amber-50 hover:bg-amber-100 cursor-pointer border border-amber-200">
                <input
                  type="checkbox"
                  checked={layers.terrainXray}
                  onChange={(e) => onLayersChange({ ...layers, terrainXray: e.target.checked })}
                  className="rounded text-amber-600 focus:ring-amber-500"
                />
                <span className="font-medium text-slate-700">🔍 Xem xuyên nền đất (hiện chiều sâu cọc L_tk)</span>
              </label>

              <label className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-50 hover:bg-slate-100 cursor-pointer">
                <input
                  type="checkbox"
                  checked={layers.windStreamlines}
                  onChange={(e) => onLayersChange({ ...layers, windStreamlines: e.target.checked })}
                  className="rounded text-brand-600 focus:ring-brand-500"
                />
                <span className="font-medium text-slate-700">💨 Luồng Hạt Gió Khí Động 3D</span>
              </label>

              <label className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-50 hover:bg-slate-100 cursor-pointer">
                <input
                  type="checkbox"
                  checked={layers.axesAndGrid}
                  onChange={(e) => onLayersChange({ ...layers, axesAndGrid: e.target.checked })}
                  className="rounded text-brand-600 focus:ring-brand-500"
                />
                <span className="font-medium text-slate-700">📐 Lưới Tọa Độ & La Bàn</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3 Content: Object Inspector */}
      {activeTab === 'inspector' && (
        <div className="p-4 space-y-4 animate-fade-in">
          {selectedElement ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-brand-500" />
                  {selectedElement.title}
                </div>
                <button
                  type="button"
                  onClick={onClearSelection}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  Đóng
                </button>
              </div>

              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-2 text-xs">
                {Object.entries(selectedElement.data).map(([key, val]) => (
                  <div key={key} className="flex items-center justify-between py-1 border-b border-slate-100 last:border-0">
                    <span className="text-slate-500">{key}:</span>
                    <span className="font-mono font-bold text-slate-800">{String(val)}</span>
                  </div>
                ))}
              </div>

              {selectedElement.type === 'line' && (
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-900 text-xs space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Kiểm tra sức bền cáp (bộ tính toán)
                  </div>
                  <div className="text-[11px] text-emerald-800">
                    Lực căng là giá trị thiết kế bất lợi nhất của cả cụm bè do bộ tính toán đưa ra; MBL theo loại cáp PES đã chọn cho bè. Cáp neo cọc được mô hình căng thẳng (không võng), đúng mô hình tính toán.
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400 space-y-2">
              <Eye className="w-8 h-8 mx-auto text-slate-300" />
              <div className="text-xs font-medium">Chưa chọn đối tượng nào</div>
              <div className="text-[11px] text-slate-400 max-w-xs mx-auto">
                Nhấp chuột vào bất kỳ cụm bè hoặc đường cáp neo trên màn hình 3D để tra cứu thông số kỹ thuật chi tiết.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
