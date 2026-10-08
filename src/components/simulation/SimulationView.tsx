import React, { useState, useRef, useMemo } from 'react';
import {
  Box,
  HelpCircle,
  Maximize2,
  Minimize2,
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import {
  ThreeSimulationCanvas,
  ThreeCanvasRef
} from './ThreeSimulationCanvas';
import { SimulationControls } from './SimulationControls';
import {
  WindParams,
  LayerVisibility,
  SelectedElement,
  LoadedIfcMetadata
} from './types';
import { computeRaftMooringStates, MNDB_M, MNC_M, MNLKT_M } from './sceneModel';
import { WATER_LEVEL_MIN_M, WATER_LEVEL_MAX_M } from './SimulationControls';
import { useProjectStore } from '../../store/useProjectStore';

export const SimulationView: React.FC = () => {
  const canvasRef = useRef<ThreeCanvasRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);

  // Simulation State
  const [windParams, setWindParams] = useState<WindParams>({
    speed: 29.7, // Design storm wind speed of Huổi Vanh
    direction: 45, // North-East
    gustFactor: 1.0,
    airDensity: 1.225,
    dragCoefficient: 1.15
  });

  const [layers, setLayers] = useState<LayerVisibility>({
    rafts: true,
    solarPanels: true,
    mooringLines: true,
    shorePiles: true,
    bedPiles: true,
    waterSurface: true,
    lakeTerrain: true,
    terrainXray: false,
    windStreamlines: true,
    labels: true,
    axesAndGrid: true,
    ifcModel: true
  });

  const [waterLevel_m, setWaterLevel_m] = useState<number>(MNDB_M);
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);
  const [ifcData, setIfcData] = useState<LoadedIfcMetadata | null>(null);
  const currentProject = useProjectStore((s) => s.currentProject);
  const activeRaftId = useProjectStore((s) => s.activeRaftId);
  const solarTilt_deg = currentProject.raft.solarTilt_deg ?? 12;

  // The calculation engine, run for the 12 rafts at the chosen wind: one
  // source for the 3D colours, the KPI cards and the inspector panel. The
  // raft being edited in Tab 2 uses exactly those inputs (cable, piles…).
  const mooringStates = useMemo(
    () => computeRaftMooringStates(currentProject, windParams.speed * windParams.gustFactor, activeRaftId),
    [currentProject, activeRaftId, windParams.speed, windParams.gustFactor]
  );

  // Toggle Fullscreen
  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err) => {
        console.warn('Fullscreen request failed:', err);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch((err) => {
        console.warn('Exit fullscreen failed:', err);
      });
      setIsFullscreen(false);
    }
  };

  // Capture Snapshot
  const handleCaptureSnapshot = () => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.captureSnapshot();
    if (!dataUrl) return;

    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `MoPhong_HuoiVanh_3D_Vw_${windParams.speed}ms_Dir_${windParams.direction}deg.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div ref={containerRef} className="space-y-6 animate-fade-in">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-brand-950 to-slate-900 text-white rounded-2xl p-6 shadow-xl border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-brand-500/20 text-brand-400 border border-brand-500/30">
                <Box className="w-5 h-5" />
              </span>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                8. Mô Phỏng Dự Án (3D & Khí Động Học Gió)
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                WebGL / WebAssembly
              </span>
            </div>
            <p className="text-xs md:text-sm text-slate-300 max-w-3xl leading-relaxed">
              Mô hình 3D của 9 cụm bè điện mặt trời nổi trên địa hình IFC thật của hồ Huổi Vanh: 231 điểm neo bờ bằng cọc khoan nhồi D350 (BÈ 3A, BÈ 5A dùng cọc đôi, mô hình vẽ một cọc đại diện mỗi điểm), 32 điểm neo đáy theo phương án đang chọn (mặc định đế BTCT + vít xoắn, 29 đế dùng chung hai bè; mô hình vẽ đế, không vẽ vít), 292 tuyến cáp neo nối từ bích bè tới điểm neo; lực căng và hệ số an toàn lấy trực tiếp từ bộ tính toán của dự án.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowInfoModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-700 transition shadow-sm"
            >
              <HelpCircle className="w-4 h-4 text-cyan-400" />
              <span>Thuyết Minh Kỹ Thuật</span>
            </button>

            <button
              type="button"
              onClick={handleToggleFullscreen}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-brand-600 hover:bg-brand-500 text-white transition shadow-sm"
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Thu Nhỏ</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Toàn Màn Hình</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Feature Badges Strip */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-wrap items-center gap-4 text-xs text-slate-300">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>
              9 cụm bè (95.873 m²) theo bản vẽ DXF
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span>
              292 tuyến cáp · 263 điểm neo (231 bờ + 32 đáy, 29 đế dùng chung)
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span>MNDB {MNDB_M} m · MNC {MNC_M} · MNLKT {MNLKT_M} (mô phỏng {WATER_LEVEL_MIN_M}–{WATER_LEVEL_MAX_M} m)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
            <span>Địa hình: Toposolid của dia hinh ho.ifc (quy đổi cao độ −17,5 m)</span>
          </div>
        </div>
      </div>

      {/* Main Simulation Viewport & Controls Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* 3D Canvas Viewport (8 cols on large screens) */}
        <div className="lg:col-span-8 h-[640px] xl:h-[720px] w-full">
          <ThreeSimulationCanvas
            ref={canvasRef}
            windParams={windParams}
            layers={layers}
            waterLevel_m={waterLevel_m}
            ifcData={ifcData}
            selectedElement={selectedElement}
            onSelectElement={(elem) => setSelectedElement(elem)}
            mooringStates={mooringStates}
          />
        </div>

        {/* Interactive Simulation Controls Sidebar (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <SimulationControls
            windParams={windParams}
            onWindParamsChange={setWindParams}
            layers={layers}
            onLayersChange={setLayers}
            waterLevel_m={waterLevel_m}
            onWaterLevelChange={setWaterLevel_m}
            selectedElement={selectedElement}
            onClearSelection={() => setSelectedElement(null)}
            ifcData={ifcData}
            onIfcDataLoaded={setIfcData}
            onSetCameraPreset={(preset, raftId) =>
              canvasRef.current?.setCameraPreset(preset, raftId)
            }
            onResetCamera={() => canvasRef.current?.resetCamera()}
            onCaptureSnapshot={handleCaptureSnapshot}
            mooringStates={mooringStates}
          />
        </div>
      </div>

      {/* Technical Explanation Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2 text-brand-900 font-bold text-base">
                <ShieldCheck className="w-5 h-5 text-brand-600" />
                Nguyên Lý Mô Phỏng Khí Động Học & Cáp Neo FPV 3D
              </div>
              <button
                type="button"
                onClick={() => setShowInfoModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold px-2 py-0.5 rounded"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-3 leading-relaxed">
              <p>
                <strong>1. Trường Gió Động Lực (Wind Aerodynamics):</strong> Áp lực gió động tác dụng lên giàn pin mặt trời nổi được tính toán theo tiêu chuẩn TCVN 2737:2023 và DNV-ST-0119 với công thức Bernoulli:
                <br />
                <code className="text-brand-700 bg-slate-100 px-2 py-0.5 rounded block my-1">
                  q_wind = 0.5 × ρ_air × (V_w × G)² × C_d
                </code>
                Trong đó ρ_air = 1.225 kg/m³, G là hệ số gió giật, và C_d là hệ số cản khí động học của giàn pin nghiêng {solarTilt_deg}°.
              </p>

              <p>
                <strong>2. Cáp Neo & Cọc Neo:</strong> Mỗi tuyến cáp nối từ bích neo ở mép bè tới đỉnh cọc theo đường thẳng, vì bộ tính toán mô hình hệ neo cọc là cáp căng thẳng (không võng catenary). Tất cả là cọc vuông BTCT 350×350, chiều sâu ngàm L_tk và cốt thép định riêng cho từng bè; BÈ 5 dùng cọc đôi tại mỗi điểm neo (mô hình vẽ một cọc đại diện); đỉnh cọc nhô khỏi nền đúng đoạn dùng trong kiểm tra Broms. Màu cáp và cọc là hệ số sử dụng của bè đó do bộ tính toán đưa ra (xanh &lt; 0,7 · vàng 0,7–1,0 · đỏ &gt; 1,0). Bộ tính toán cho lực căng thiết kế bất lợi nhất của cả bè, không có mô hình từng dây theo hướng gió, nên mọi dây của một bè cùng một màu.
              </p>

              <p>
                <strong>3. Địa hình & mực nước:</strong> Địa hình là Toposolid trích từ file dia hinh ho.ifc (scripts/extractTerrainFromIfc.mjs). Mặt nước trong file IFC đặt ở cao độ 402,0 m, tương ứng MNDB 384,5 m của dự án, nên toàn bộ địa hình được quy đổi −17,5 m. Mực nước dâng từ các cụm bè ra trong lòng hồ; bè nào có đáy chạm nền khi nước hạ sẽ được báo mắc cạn.
              </p>

              <p>
                <strong>4. Chuẩn Mô Hình Mở IFC (OpenBIM):</strong> Web-IFC sử dụng bộ biên dịch WebAssembly (WASM) thực thi trực tiếp trên trình duyệt của máy khách (client-side), cho phép nạp và hiển thị trực quan các file mô hình IFC2X3 và IFC4 từ Revit, Civil 3D, Tekla... mà không cần gửi dữ liệu lên máy chủ bên ngoài, đảm bảo tuyệt đối tính bảo mật của dự án.
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowInfoModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white transition"
              >
                Đã Hiểu & Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
