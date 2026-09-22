import React, { useState, useMemo, useRef, useEffect } from 'react';
import huoiVanhCoordinatesData from '../../data/huoiVanhCoordinates.json';
import { MooringCoordinate } from '../../data/huoiVanhProject';
import { useProjectStore } from '../../store/useProjectStore';
import {
  Map as MapIcon,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Filter,
  Compass,
  Thermometer,
  Table,
  FileSpreadsheet,
  DraftingCompass,
  Search,
  CheckCircle2
} from 'lucide-react';
import { buildPileSchedule } from '../../lib/io/pileSchedule';
import { exportPileScheduleToExcel } from '../../lib/io/excelExport';
import { exportMooringPileDxf } from '../../lib/io/dxfExport';

/** Heatmap colour by cable-tension utilization: Xanh < 0.7, Vàng 0.7–1.0, Đỏ > 1.0. */
function utilizationColor(u: number | null | undefined): string {
  if (u === null || u === undefined || !Number.isFinite(u)) return '#64748b'; // slate — no data
  if (u < 0.7) return '#10b981'; // emerald
  if (u <= 1.0) return '#f59e0b'; // amber
  return '#ef4444'; // red
}

const raftKeyFromName = (name: string): number | null => {
  const num = parseInt(name.replace(/\D/g, ''), 10);
  return Number.isFinite(num) ? num : null;
};

export const MooringLayoutMap: React.FC = () => {
  const { currentProject, results, setActiveRaft, activeRaftId, batchResults, calculateAllRafts } = useProjectStore();
  const [filterRaft, setFilterRaft] = useState<string>('ALL');
  const [selectedAnchor, setSelectedAnchor] = useState<MooringCoordinate | null>(null);
  const [viewMode, setViewMode] = useState<'schedule' | 'coords'>('schedule');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Batch results drive the heatmap: each raft's OWN required-vs-actual MBL
  // utilization (results.cableUtilization) is applied to every cable line of
  // that raft's cluster — this app models one governing line tension per
  // raft, not a per-line FEA, so that governing value is the honest colour
  // to show for every line in the cluster rather than a fabricated spread.
  useEffect(() => {
    if (batchResults.length === 0) calculateAllRafts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const raftUtilization = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const b of batchResults) map.set(b.raft.name, b.results.cableUtilization);
    return map;
  }, [batchResults]);

  // Zoom & Pan state
  const [scale, setScale] = useState<number>(1.2);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const coordinates: MooringCoordinate[] = huoiVanhCoordinatesData as MooringCoordinate[];

  // Calculate extents from coordinates
  const bounds = useMemo(() => {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    coordinates.forEach(c => {
      minX = Math.min(minX, c.xRaft, c.xAnchor);
      maxX = Math.max(maxX, c.xRaft, c.xAnchor);
      minY = Math.min(minY, c.yRaft, c.yAnchor);
      maxY = Math.max(maxY, c.yRaft, c.yAnchor);
    });
    return {
      minX, maxX, minY, maxY,
      width: maxX - minX,
      height: maxY - minY,
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2
    };
  }, [coordinates]);

  // Transform coordinates to SVG viewBox (800 x 600)
  const svgWidth = 800;
  const svgHeight = 550;
  const padding = 60;

  const toSvgX = (x: number) => {
    const norm = (x - bounds.minX) / (bounds.width || 1);
    return padding + norm * (svgWidth - 2 * padding);
  };

  const toSvgY = (y: number) => {
    const norm = (y - bounds.minY) / (bounds.height || 1);
    return svgHeight - padding - norm * (svgHeight - 2 * padding);
  };

  // Full Pile Schedule (299 piles) with Broms L_opt and P_max
  const pileSchedule = useMemo(() => {
    const batch = batchResults.length > 0 ? batchResults : undefined;
    return buildPileSchedule(currentProject, results, batch);
  }, [currentProject, results, batchResults]);

  // Filtered coordinates for map and coords table
  const displayedCoords = useMemo(() => {
    return coordinates.filter((c) => {
      const matchRaft = filterRaft === 'ALL' || c.raft.toUpperCase() === filterRaft.toUpperCase();
      if (!matchRaft) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return c.code.toLowerCase().includes(q) || c.raft.toLowerCase().includes(q);
    });
  }, [coordinates, filterRaft, searchQuery]);

  // Filtered pile schedule for CAD / Broms table
  const displayedSchedule = useMemo(() => {
    return pileSchedule.filter((r) => {
      const matchRaft = filterRaft === 'ALL' || r.raft.toUpperCase() === filterRaft.toUpperCase();
      if (!matchRaft) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        r.pileId.toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q) ||
        r.raft.toLowerCase().includes(q)
      );
    });
  }, [pileSchedule, filterRaft, searchQuery]);

  const handleExportPileSchedule = () => {
    const batch = batchResults.length > 0 ? batchResults : calculateAllRafts();
    exportPileScheduleToExcel(currentProject, results, batch);
  };

  const handleExportCad = () => {
    const batch = batchResults.length > 0 ? batchResults : calculateAllRafts();
    exportMooringPileDxf(currentProject, results, batch);
  };

  // Unique rafts
  const uniqueRafts = useMemo(() => {
    const set = new Set<string>();
    coordinates.forEach(c => set.add(c.raft));
    return Array.from(set);
  }, [coordinates]);

  // Mouse handlers for dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  return (
    <div className="card p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="form-card-icon bg-sky-50 text-sky-600">
            <MapIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="card-title">
              Sơ Đồ Mặt Bằng Tọa Độ Hệ Neo 12 Bè (Huổi Vanh)
            </h3>
            <p className="card-subtitle">
              Biểu diễn 299 tuyến cáp neo, cọc neo bờ (xanh lá) và cọc neo đáy hồ (cam)
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Raft Filter */}
          <div className="flex items-center gap-1.5 bg-slate-100 rounded-lg px-2.5 py-1 border border-slate-200 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={filterRaft}
              onChange={(e) => {
                setFilterRaft(e.target.value);
                if (e.target.value !== 'ALL') {
                  const num = parseInt(e.target.value.replace(/\D/g, ''));
                  if (num) setActiveRaft(num);
                }
              }}
              className="bg-transparent font-medium text-slate-700 outline-none cursor-pointer"
            >
              <option value="ALL">Toàn bộ 12 Bè</option>
              {uniqueRafts.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Zoom buttons */}
          <button
            type="button"
            onClick={() => setScale(s => Math.min(3.0, s + 0.2))}
            className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 transition-colors"
            title="Phóng to"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setScale(s => Math.max(0.6, s - 0.2))}
            className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 transition-colors"
            title="Thu nhỏ"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => { setScale(1.2); setPan({ x: 0, y: 0 }); }}
            className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 transition-colors"
            title="Đặt lại góc nhìn"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* SVG Canvas Map */}
      <div
        className="relative w-full h-[520px] bg-slate-950 rounded-xl overflow-hidden cursor-grab active:cursor-grabbing border border-slate-800 select-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Compass & Legends */}
        <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur border border-slate-700/60 rounded-lg px-3 py-2 text-xs text-white space-y-1.5 z-10 pointer-events-none">
          <div className="flex items-center gap-1.5 font-semibold text-sky-400">
            <Compass className="w-4 h-4" />
            Phương Bắc (N)
          </div>
          <div className="flex items-center gap-1.5 font-semibold text-slate-300 pt-1 border-t border-slate-700/60">
            <Thermometer className="w-3.5 h-3.5" />
            Heatmap hệ số căng dây (η)
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="w-3 h-0.5 rounded-full inline-block" style={{ background: '#10b981' }}></span>
            <span>η &lt; 0.7 (an toàn)</span>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="w-3 h-0.5 rounded-full inline-block" style={{ background: '#f59e0b' }}></span>
            <span>η 0.7 – 1.0 (cận giới hạn)</span>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="w-3 h-0.5 rounded-full inline-block" style={{ background: '#ef4444' }}></span>
            <span>η &gt; 1.0 (vượt tải)</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] pt-1 border-t border-slate-700/60">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block"></span>
            <span>Cọc Bờ</span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block ml-2"></span>
            <span>Cọc Đáy</span>
          </div>
          <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-700/60">
            Click vào tên bè hoặc dây neo để chọn bè tính toán
          </div>
        </div>

        {/* Selected anchor info popup */}
        {selectedAnchor && (
          <div className="absolute bottom-3 left-3 bg-slate-900/90 backdrop-blur border border-sky-500/50 rounded-lg p-3 text-xs text-white z-10 shadow-xl max-w-xs animate-fade-in">
            <div className="flex items-center justify-between font-bold text-sky-400 border-b border-slate-700 pb-1 mb-1.5">
              <span>{selectedAnchor.raft} — {selectedAnchor.code}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${selectedAnchor.type === 'SHORE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                {selectedAnchor.type === 'SHORE' ? 'NEO BỜ' : 'NEO ĐÁY'}
              </span>
            </div>
            <div className="space-y-0.5 text-slate-300 font-mono text-[11px]">
              <div>Tọa độ Bè: X = {selectedAnchor.xRaft}, Y = {selectedAnchor.yRaft}</div>
              <div>Tọa độ Cọc: X = {selectedAnchor.xAnchor}, Y = {selectedAnchor.yAnchor}</div>
              <div>Cao trình Z: {selectedAnchor.zAnchor} m</div>
              <div>Chiều dài nhịp cáp: <strong className="text-white">{selectedAnchor.span} m</strong></div>
              <div>Góc phương vị: <strong className="text-white">{selectedAnchor.azimuth}°</strong></div>
            </div>
          </div>
        )}

        <svg
          className="w-full h-full"
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.15s ease-out'
          }}
        >
          {/* Grid lines */}
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(51, 65, 85, 0.4)" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width={svgWidth} height={svgHeight} fill="url(#grid)" />

          {/* Mooring Lines — stroke coloured by tension-utilization heatmap */}
          <g>
            {displayedCoords.map((c, idx) => {
              const x1 = toSvgX(c.xRaft);
              const y1 = toSvgY(c.yRaft);
              const x2 = toSvgX(c.xAnchor);
              const y2 = toSvgY(c.yAnchor);
              const isShore = c.type === 'SHORE';
              const raftId = raftKeyFromName(c.raft);
              const isActiveRaft = raftId !== null && raftId === activeRaftId;
              const heat = utilizationColor(raftUtilization.get(c.raft));

              return (
                <g
                  key={idx}
                  className="cursor-pointer"
                  onClick={() => {
                    setSelectedAnchor(c);
                    if (raftId !== null) setActiveRaft(raftId);
                  }}
                >
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={heat}
                    strokeOpacity={isActiveRaft ? 0.95 : 0.6}
                    strokeWidth={isActiveRaft ? 2 : 1.2}
                    strokeDasharray={isShore ? 'none' : '3 2'}
                  />
                  {/* Anchor Point Circle */}
                  <circle
                    cx={x2}
                    cy={y2}
                    r="3.5"
                    fill={isShore ? '#10b981' : '#f59e0b'}
                    stroke="#ffffff"
                    strokeWidth="0.8"
                  />
                  {/* Fairlead Raft Point */}
                  <circle
                    cx={x1}
                    cy={y1}
                    r="2"
                    fill="#38bdf8"
                  />
                </g>
              );
            })}
          </g>

          {/* Raft Label Tags — click to select that raft for calculation */}
          <g>
            {uniqueRafts.map((raftName, idx) => {
              const raftPoints = coordinates.filter(c => c.raft === raftName);
              if (raftPoints.length === 0) return null;
              const avgX = raftPoints.reduce((sum, p) => sum + p.xRaft, 0) / raftPoints.length;
              const avgY = raftPoints.reduce((sum, p) => sum + p.yRaft, 0) / raftPoints.length;
              const sx = toSvgX(avgX);
              const sy = toSvgY(avgY);
              const raftId = raftKeyFromName(raftName);
              const isActiveRaft = raftId !== null && raftId === activeRaftId;

              return (
                <g
                  key={idx}
                  className="cursor-pointer"
                  onClick={() => { if (raftId !== null) setActiveRaft(raftId); }}
                >
                  <title>{`Chọn ${raftName} để tính toán`}</title>
                  <rect
                    x={sx - 24}
                    y={sy - 10}
                    width="48"
                    height="20"
                    rx="4"
                    fill={isActiveRaft ? 'rgba(2, 132, 199, 0.9)' : 'rgba(15, 23, 42, 0.85)'}
                    stroke={isActiveRaft ? '#7dd3fc' : '#0284c7'}
                    strokeWidth={isActiveRaft ? 1.5 : 1}
                  />
                  <text
                    x={sx}
                    y={sy + 4}
                    textAnchor="middle"
                    fill={isActiveRaft ? '#ffffff' : '#38bdf8'}
                    fontSize="10"
                    fontWeight="bold"
                  >
                    {raftName}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* Enhanced Pile Schedule & Coordinate Table */}
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
        {/* Table Header Bar */}
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Switcher */}
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setViewMode('schedule')}
                className={`px-3 py-1 rounded-md transition-all flex items-center gap-1.5 ${
                  viewMode === 'schedule'
                    ? 'bg-white text-brand-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Table className="w-3.5 h-3.5 text-emerald-600" />
                <span>Bảng Thống Kê Cọc (CAD / Broms)</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('coords')}
                className={`px-3 py-1 rounded-md transition-all flex items-center gap-1.5 ${
                  viewMode === 'coords'
                    ? 'bg-white text-brand-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <MapIcon className="w-3.5 h-3.5 text-sky-600" />
                <span>Tọa Độ & Nhịp Cáp Khảo Sát</span>
              </button>
            </div>

            {/* Quick Summary Pill */}
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-200/80 text-slate-700">
              {viewMode === 'schedule' ? displayedSchedule.length : displayedCoords.length} / {coordinates.length} cọc
            </span>
            <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              100% ĐẠT
            </span>
          </div>

          {/* Action Buttons: Export Excel & Export CAD */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportPileSchedule}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
              title="Xuất riêng Bảng Thống Kê Cọc Neo (299 cọc, L_opt, P_max) ra file Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Xuất Excel Bảng Cọc</span>
            </button>
            <button
              type="button"
              onClick={handleExportCad}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
              title="Xuất bản vẽ mặt bằng đóng cọc neo ra CAD (.DXF) — kèm bảng thống kê cọc"
            >
              <DraftingCompass className="w-3.5 h-3.5 text-amber-400" />
              <span>Xuất CAD</span>
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="px-4 py-2 bg-slate-50/50 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 flex-1 min-w-[220px] max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Tìm theo mã cọc (HV-P...), ký hiệu KS (N1-01)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded px-2.5 py-1 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div className="text-slate-500 text-[11px] font-mono">
            {viewMode === 'schedule'
              ? 'L_opt: Chiều sâu đóng cọc tối ưu (Broms) · P_max: Sức chịu tải cho phép lớn nhất (kN)'
              : 'Hệ tọa độ thiết kế (m) · Nhịp dây thẳng từ mép bè tới tim cọc'}
          </div>
        </div>

        {/* Table Content */}
        <div className="max-h-80 overflow-y-auto">
          {viewMode === 'schedule' ? (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 uppercase font-semibold sticky top-0 border-b border-slate-200 z-10">
                <tr>
                  <th className="px-3 py-2">MÃ CỌC</th>
                  <th className="px-3 py-2">KÝ HIỆU KS</th>
                  <th className="px-3 py-2">CỤM BÈ</th>
                  <th className="px-3 py-2">LOẠI</th>
                  <th className="px-3 py-2 text-right">X (m)</th>
                  <th className="px-3 py-2 text-right">Y (m)</th>
                  <th className="px-3 py-2 text-right">Z (m)</th>
                  <th className="px-3 py-2 text-right">D (m)</th>
                  <th className="px-3 py-2 text-right">L_opt (m)</th>
                  <th className="px-3 py-2 text-right">T_max (kN)</th>
                  <th className="px-3 py-2 text-right">P_req (kN)</th>
                  <th className="px-3 py-2 text-right">P_max (kN)</th>
                  <th className="px-3 py-2 text-center">KL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {displayedSchedule.map((r, i) => {
                  const coord = coordinates.find((c) => c.code === r.code);
                  return (
                    <tr
                      key={r.pileId || i}
                      onClick={() => {
                        if (coord) setSelectedAnchor(coord);
                        const rId = raftKeyFromName(r.raft);
                        if (rId !== null) setActiveRaft(rId);
                      }}
                      className="hover:bg-sky-50/70 cursor-pointer transition-colors"
                    >
                      <td className="px-3 py-1.5 font-bold text-brand-700">{r.pileId}</td>
                      <td className="px-3 py-1.5 font-semibold text-slate-700">{r.code}</td>
                      <td className="px-3 py-1.5 font-bold text-slate-900">{r.raft}</td>
                      <td className="px-3 py-1.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            r.type === 'SHORE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {r.type === 'SHORE' ? 'BỜ' : 'ĐÁY HỒ'}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-right">{r.x.toFixed(2)}</td>
                      <td className="px-3 py-1.5 text-right">{r.y.toFixed(2)}</td>
                      <td className="px-3 py-1.5 text-right">{r.z.toFixed(2)}</td>
                      <td className="px-3 py-1.5 text-right">{r.D_m.toFixed(2)}</td>
                      <td className="px-3 py-1.5 text-right font-bold text-sky-700">
                        {r.Lopt_m !== null ? r.Lopt_m.toFixed(2) : 'KHÔNG ĐẠT'}
                      </td>
                      <td className="px-3 py-1.5 text-right">{r.Tmax_kN.toFixed(1)}</td>
                      <td className="px-3 py-1.5 text-right">{r.Preq_kN.toFixed(1)}</td>
                      <td className="px-3 py-1.5 text-right font-bold text-emerald-700">
                        {r.Pmax_kN.toFixed(1)}
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            r.isPmaxOk
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {r.isPmaxOk ? 'ĐẠT' : 'KIỂM TRA'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 uppercase font-semibold sticky top-0 border-b border-slate-200 z-10">
                <tr>
                  <th className="px-3 py-2">Bè</th>
                  <th className="px-3 py-2">Mã neo</th>
                  <th className="px-3 py-2">Loại neo</th>
                  <th className="px-3 py-2">X Bè (m)</th>
                  <th className="px-3 py-2">Y Bè (m)</th>
                  <th className="px-3 py-2">X Cọc (m)</th>
                  <th className="px-3 py-2">Y Cọc (m)</th>
                  <th className="px-3 py-2">Z Cọc (m)</th>
                  <th className="px-3 py-2">Nhịp dây (m)</th>
                  <th className="px-3 py-2">Phương vị (°)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {displayedCoords.map((c, i) => (
                  <tr
                    key={i}
                    onClick={() => {
                      setSelectedAnchor(c);
                      const rId = raftKeyFromName(c.raft);
                      if (rId !== null) setActiveRaft(rId);
                    }}
                    className="hover:bg-sky-50/60 cursor-pointer transition-colors"
                  >
                    <td className="px-3 py-1.5 font-bold text-slate-900">{c.raft}</td>
                    <td className="px-3 py-1.5 font-semibold text-brand-600">{c.code}</td>
                    <td className="px-3 py-1.5">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          c.type === 'SHORE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {c.type === 'SHORE' ? 'NEO BỜ' : 'NEO ĐÁY'}
                      </span>
                    </td>
                    <td className="px-3 py-1.5">{c.xRaft}</td>
                    <td className="px-3 py-1.5">{c.yRaft}</td>
                    <td className="px-3 py-1.5">{c.xAnchor}</td>
                    <td className="px-3 py-1.5">{c.yAnchor}</td>
                    <td className="px-3 py-1.5">{c.zAnchor}</td>
                    <td className="px-3 py-1.5 font-bold text-slate-800">{c.span}</td>
                    <td className="px-3 py-1.5">{c.azimuth}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
