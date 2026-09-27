import React, { useState } from 'react';
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
  designVersion: 'v1' | 'v2';
  onDesignVersionChange: (v: 'v1' | 'v2') => void;
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
  designVersion,
  onDesignVersionChange
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

  // Estimated drag force on 12 rafts based on design layout version
  const totalRaftArea = designVersion === 'v2' ? 90724 : 56214; // m2 (V2: BÈ 5 re-cut on 2026-09-27)
  const dynamicPressure = 0.5 * windParams.airDensity * Math.pow(windParams.speed * windParams.gustFactor, 2);
  const estimatedDragTotalKn = ((dynamicPressure * windParams.dragCoefficient * (totalRaftArea * 0.08)) / 1000).toFixed(1);
  const maxLineTensionEstimate = (22 + Math.pow(windParams.speed / 29.7, 2) * (designVersion === 'v2' ? 98 : 88)).toFixed(1);
  const safetyFactorEstimate = (140 / parseFloat(maxLineTensionEstimate)).toFixed(2);

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

      {/* Design Version Switcher Strip */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-slate-500 font-bold uppercase text-[11px] tracking-wider">Phiên bản mặt bằng:</span>
        <div className="flex items-center gap-1.5 p-0.5 bg-slate-200/80 rounded-xl">
          <button
            type="button"
            onClick={() => onDesignVersionChange('v2')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              designVersion === 'v2'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Bản vẽ V2 Mới (90.724 m² - 304 cọc)
          </button>
          <button
            type="button"
            onClick={() => onDesignVersionChange('v1')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              designVersion === 'v1'
                ? 'bg-slate-700 text-white shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Bản vẽ V1 Gốc (56.214 m² - 298 cọc)
          </button>
        </div>
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
              <div className="text-slate-500">Lực cản khí động Fw</div>
              <div className="font-mono text-base font-bold text-emerald-900 mt-0.5">
                {estimatedDragTotalKn} kN
              </div>
              <div className="text-[11px] text-emerald-700">12 cụm bè FPV</div>
            </div>

            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3">
              <div className="text-slate-500">Lực căng cáp lớn nhất</div>
              <div className="font-mono text-base font-bold text-amber-900 mt-0.5">
                {maxLineTensionEstimate} kN
              </div>
              <div className="text-[11px] text-amber-700">Tmax / Tcho_phép</div>
            </div>

            <div className="bg-cyan-50/70 border border-cyan-200 rounded-xl p-3">
              <div className="text-slate-500">Hệ số an toàn (SF)</div>
              <div className="font-mono text-base font-bold text-cyan-900 mt-0.5">
                {safetyFactorEstimate}
              </div>
              <div className="text-[11px] text-cyan-700 font-medium">
                {parseFloat(safetyFactorEstimate) >= 1.67 ? '✅ ĐẠT (≥ 1.67)' : '⚠️ CẢNH BÁO'}
              </div>
            </div>
          </div>

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
              <span>Mực nước hồ (Cao trình MNDB = 384.5 m)</span>
              <span className="font-mono text-sm text-cyan-700 font-bold bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200">
                {waterLevel_m.toFixed(2)} m
              </span>
            </div>

            <input
              type="range"
              min={380.0}
              max={386.0}
              step={0.1}
              value={waterLevel_m}
              onChange={(e) => onWaterLevelChange(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-cyan-600"
            />
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Mực nước chết: 380.0 m</span>
              <span className="font-bold text-cyan-600">MNDB: 384.5 m</span>
              <span>Mực nước lũ: 386.0 m</span>
            </div>

            {/* Dynamic Water Physics Feedback */}
            <div className={`p-2.5 rounded-xl text-xs flex items-center justify-between border ${
              waterLevel_m > 385.0
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : waterLevel_m < 382.0
                ? 'bg-amber-50 border-amber-200 text-amber-800'
                : 'bg-cyan-50 border-cyan-200 text-cyan-800'
            }`}>
              <span className="font-medium">
                {waterLevel_m > 385.0
                  ? '⚠️ Mực nước lũ cao: Bè dâng cao, cáp neo kéo căng, góc dốc cáp tăng.'
                  : waterLevel_m < 382.0
                  ? 'ℹ️ Mực nước cạn: Bè hạ thấp, cáp neo chùng xuống, chiều dài tiếp đáy tăng.'
                  : '✅ Mực nước bình thường (MNDB): Hệ neo làm việc ở điều kiện thiết kế chuẩn.'}
              </span>
              <span className="font-mono font-bold shrink-0 ml-2">
                ΔZ = {(waterLevel_m - 384.5) >= 0 ? '+' : ''}{(waterLevel_m - 384.5).toFixed(2)} m
              </span>
            </div>
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
                <span className="font-medium text-slate-700">⚓ 298 Tuyến Cáp Neo Catenary</span>
              </label>

              <label className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-50 hover:bg-slate-100 cursor-pointer">
                <input
                  type="checkbox"
                  checked={layers.shorePiles}
                  onChange={(e) => onLayersChange({ ...layers, shorePiles: e.target.checked })}
                  className="rounded text-brand-600 focus:ring-brand-500"
                />
                <span className="font-medium text-slate-700">📍 Cọc Neo Bờ & Cọc Đáy Hồ</span>
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
                    Kiểm tra độ võng & sức bền cáp
                  </div>
                  <div className="text-[11px] text-emerald-800">
                    Cáp sợi tổng hợp Polyester chịu lực kéo đứt 280 kN. Hệ số an toàn thiết kế hiện hành thoả mãn TCVN & DNV-ST-0119.
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
