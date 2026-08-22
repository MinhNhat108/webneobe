import React from 'react';
import { CalcResults, ProjectState } from '../../lib/calc/types';

interface CatenarySketchProps {
  state: ProjectState;
  results: CalcResults;
}

export const CatenarySketch: React.FC<CatenarySketchProps> = ({ state, results }) => {
  const depth = state.env.waterDepth_m || 6.0;
  const s = results.suspendedLength_s_m || 15.0;
  const l_ground = results.groundedLength_m || 10.0;

  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Mô Hình Sơ Đồ Cắt Dọc Dây Neo & Catenary
          </h3>
          <p className="card-subtitle">
            Biểu diễn độ võng dây cáp, đoạn lơ lửng s, đoạn nằm tiếp đáy và vị trí cọc/neo
          </p>
        </div>
      </div>

      <div className="w-full h-64 bg-slate-900 rounded-xl overflow-hidden relative border border-slate-800 flex items-center justify-center p-4">
        <svg viewBox="0 0 600 240" className="w-full h-full">
          {/* Water Surface */}
          <line x1="20" y1="50" x2="580" y2="50" stroke="#38bdf8" strokeWidth="2" strokeDasharray="4 2" />
          <text x="30" y="42" fill="#38bdf8" fontSize="11" fontWeight="bold">Mặt nước (MNDBT)</text>

          {/* Seabed */}
          <line x1="20" y1="190" x2="580" y2="190" stroke="#94a3b8" strokeWidth="3" />
          <text x="30" y="210" fill="#94a3b8" fontSize="11" fontWeight="bold">Đáy bùn lòng hồ / biển</text>

          {/* Raft float block */}
          <rect x="420" y="35" width="120" height="25" rx="3" fill="#0284c7" stroke="#38bdf8" strokeWidth="1.5" />
          <text x="480" y="52" fill="#ffffff" fontSize="11" fontWeight="bold" textAnchor="middle">Cụm Bè</text>

          {/* Anchor / Pile at Left */}
          <rect x="80" y="180" width="12" height="40" fill="#f59e0b" stroke="#ffffff" strokeWidth="1" />
          <text x="86" y="235" fill="#f59e0b" fontSize="10" fontWeight="bold" textAnchor="middle">Cọc / Mỏ neo</text>

          {/* Catenary Curve Line */}
          <path
            d="M 420 55 Q 320 190 220 190 L 86 190"
            fill="none"
            stroke="#10b981"
            strokeWidth="2.5"
          />

          {/* Touchdown point */}
          <circle cx="220" cy="190" r="3.5" fill="#10b981" />

          {/* Dimension texts */}
          <text x="330" y="110" fill="#a7f3d0" fontSize="10" fontWeight="bold">Đoạn lơ lửng s = {s}m</text>
          <text x="150" y="180" fill="#fde68a" fontSize="10">Đoạn nằm đáy = {l_ground.toFixed(1)}m</text>
          <text x="550" y="125" fill="#bae6fd" fontSize="10" textAnchor="end">Độ sâu d = {depth}m</text>

          {/* Fairlead Tension Vector */}
          <line x1="420" y1="55" x2="380" y2="70" stroke="#f43f5e" strokeWidth="2" />
        </svg>
      </div>
    </div>
  );
};
