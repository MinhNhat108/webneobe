import React from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { NumberField } from './NumberField';
import { Ship, SunMedium, Compass, ArrowDownUp } from 'lucide-react';

export const RaftForm: React.FC = () => {
  const { currentProject, updateRaft, results } = useProjectStore();
  const raft = currentProject.raft;
  const env = currentProject.env;
  const isSolar = currentProject.systemType === 'solar_fpv';

  const raftArea = raft.length_m * raft.width_m;
  const perimeter = 2 * (raft.length_m + raft.width_m);

  // Live calculation of cable geometries for 4 sides
  const waterDepth = env.waterDepth_m || 6.0;
  const bankSlope = env.bankSlope_m || 3.1;
  const shoreOffset = ((env.mncn_m || 384) - (env.mndbt_m || 383) + 0.5) * bankSlope;

  // South side
  const southSpan = (raft.southDist_m || 17.1) + shoreOffset;
  const southLength = Math.sqrt(southSpan * southSpan + 1.5 * 1.5);

  // North side
  const northSpan = (raft.northDist_m || 33.2) + shoreOffset;
  const northLength = Math.sqrt(northSpan * northSpan + 1.5 * 1.5);

  // East side
  const eastSpan = (raft.eastDist_m || 44.2) + shoreOffset;
  const eastLength = Math.sqrt(eastSpan * eastSpan + 1.5 * 1.5);

  // West side (Lake bed pile)
  const westBedDist = (raft.westDist_m || 27.0) / 2.0;
  const westAngleDeg = results.bedCableAngle_deg !== undefined
    ? results.bedCableAngle_deg
    : (Math.atan(waterDepth / Math.max(1, westBedDist)) * 180) / Math.PI;
  const westLength = Math.sqrt(westBedDist * westBedDist + waterDepth * waterDepth);

  return (
    <div className="card p-6 space-y-6">
      <div className="form-card-header">
        <div className="form-card-icon bg-blue-50 text-blue-600">
          <Ship className="w-5 h-5" />
        </div>
        <div>
          <h3 className="card-title">
            {isSolar ? '1. Hình Học Bè & Hệ Thống Tấm Pin Nổi' : '1. Hình Học & Kích Thước Bè'}
          </h3>
          <p className="card-subtitle">
            Kích thước mặt bằng, diện tích cản gió và đặc tính khối lượng
          </p>
        </div>
      </div>

      {/* Geometry Dimensions */}
      <div className="field-grid">
        <NumberField
          label="Chiều dài bè (L)"
          value={raft.length_m}
          onChange={(val) => updateRaft({ length_m: val })}
          unit="m"
          step={0.1}
          min={1}
          helpText="Chiều dài theo cạnh dài của cụm bè"
        />

        <NumberField
          label="Chiều rộng bè (W)"
          value={raft.width_m}
          onChange={(val) => updateRaft({ width_m: val })}
          unit="m"
          step={0.1}
          min={1}
          helpText="Chiều rộng theo cạnh ngắn của cụm bè"
        />

        <div className="flex flex-col gap-1 text-sm bg-slate-50 p-3 rounded-lg border border-slate-200">
          <span className="font-medium text-slate-700">Diện tích mặt bằng & Chu vi</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="card-subtitle">Diện tích S:</span>
            <span className="font-mono font-bold text-slate-900">{raftArea.toLocaleString()} m²</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="card-subtitle">Chu vi P:</span>
            <span className="font-mono font-medium text-slate-700">{perimeter.toFixed(1)} m</span>
          </div>
        </div>

        <NumberField
          label="Mớn nước bè (Draft)"
          value={raft.draft_m}
          onChange={(val) => updateRaft({ draft_m: val })}
          unit="m"
          step={0.05}
          min={0.05}
          helpText="Chiều sâu chìm dưới nước của phao/khung bè"
        />

        <NumberField
          label="Chiều cao phần nổi (Freeboard)"
          value={raft.freeboardHeight_m}
          onChange={(val) => updateRaft({ freeboardHeight_m: val })}
          unit="m"
          step={0.05}
          min={0.05}
          helpText="Chiều cao mép phao nhô khỏi mặt nước"
        />

        <NumberField
          label="Khối lượng bè (Displacement)"
          value={raft.displacement_t}
          onChange={(val) => updateRaft({ displacement_t: val })}
          unit="tấn"
          step={1}
          min={1}
          helpText="Tổng tải trọng nổi bao gồm phao, tấm pin và khung giá"
        />
      </div>

      {/* Solar Specific Parameters */}
      {isSolar && (
        <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-200/70 space-y-4">
          <div className="flex items-center gap-2 text-amber-900 font-semibold text-sm">
            <SunMedium className="w-4 h-4 text-amber-600" />
            Thông số hệ thống tấm pin mặt trời (FPV)
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <NumberField
              label="Số lượng tấm pin"
              value={raft.solarPanelCount}
              onChange={(val) => updateRaft({ solarPanelCount: val })}
              unit="tấm"
              step={1}
              min={0}
              helpText="Tổng số module quang điện trên cụm bè"
            />

            <NumberField
              label="Diện tích 1 tấm pin"
              value={raft.solarPanelArea_m2}
              onChange={(val) => updateRaft({ solarPanelArea_m2: val })}
              unit="m²"
              step={0.01}
              min={0.5}
              helpText="Quy cách tấm pin (vd: 2.701 m²)"
            />

            <NumberField
              label="Góc nghiêng tấm pin (Tilt)"
              value={raft.solarTilt_deg}
              onChange={(val) => updateRaft({ solarTilt_deg: val })}
              unit="độ"
              step={0.5}
              min={0}
              max={60}
              helpText="Góc nghiêng so với phương ngang (12°)"
            />

            <NumberField
              label="Hệ số che chắn (Shielding)"
              value={raft.solarShieldFactor}
              onChange={(val) => updateRaft({ solarShieldFactor: val })}
              unit="-"
              step={0.05}
              min={0.1}
              max={1.0}
              helpText="Hệ số giảm cản gió giữa các hàng pin (0.55)"
            />
          </div>
        </div>
      )}

      {/* Distances to Shores (Four sides) */}
      <div className="border-t border-slate-100 pt-4 space-y-3">
        <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
          Khoảng cách 4 cạnh bè tới bờ / bè lân cận (Dùng cho sơ đồ neo & góc cáp):
        </h4>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <NumberField
            label="Cạnh dài Nam (Bờ)"
            value={raft.southDist_m}
            onChange={(val) => updateRaft({ southDist_m: val })}
            unit="m"
            step={0.5}
          />
          <NumberField
            label="Cạnh dài Bắc (Bờ)"
            value={raft.northDist_m}
            onChange={(val) => updateRaft({ northDist_m: val })}
            unit="m"
            step={0.5}
          />
          <NumberField
            label="Cạnh ngắn Đông (Bờ)"
            value={raft.eastDist_m}
            onChange={(val) => updateRaft({ eastDist_m: val })}
            unit="m"
            step={0.5}
          />
          <NumberField
            label="Cạnh ngắn Tây (Giáp bè khác)"
            value={raft.westDist_m}
            onChange={(val) => updateRaft({ westDist_m: val })}
            unit="m"
            step={0.5}
            helpText="Khe hở giữa 2 bè (cọc đóng lòng hồ đặt giữa khe)"
          />
        </div>

        {/* Real-time Dynamic Feedback Box for the 4 Distances */}
        <div className="bg-sky-50/60 p-4 rounded-xl border border-sky-200/80 space-y-3 text-xs">
          <div className="flex items-center justify-between font-semibold text-sky-900">
            <span className="flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-sky-600" />
              Kết quả cập nhật trực tiếp theo khoảng cách 4 cạnh vừa nhập:
            </span>
            <span className="font-mono text-[11px] text-sky-700">
              Độ sâu nước h = {waterDepth}m
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 font-mono">
            <div className="bg-white p-2.5 rounded-lg border border-sky-100 shadow-2xs">
              <div className="text-[11px] text-slate-500 font-sans font-medium">Cạnh Nam (Neo bờ):</div>
              <div className="text-slate-800 font-bold">Dài cáp: {southLength.toFixed(1)} m</div>
              <div className="text-[10px] text-slate-400">Góc cáp: ~4° (Kéo ngang)</div>
            </div>

            <div className="bg-white p-2.5 rounded-lg border border-sky-100 shadow-2xs">
              <div className="text-[11px] text-slate-500 font-sans font-medium">Cạnh Bắc (Neo bờ):</div>
              <div className="text-slate-800 font-bold">Dài cáp: {northLength.toFixed(1)} m</div>
              <div className="text-[10px] text-slate-400">Góc cáp: ~2° (Kéo ngang)</div>
            </div>

            <div className="bg-white p-2.5 rounded-lg border border-sky-100 shadow-2xs">
              <div className="text-[11px] text-slate-500 font-sans font-medium">Cạnh Đông (Neo bờ):</div>
              <div className="text-slate-800 font-bold">Dài cáp: {eastLength.toFixed(1)} m</div>
              <div className="text-[10px] text-slate-400">Góc cáp: ~2° (Kéo ngang)</div>
            </div>

            <div className="bg-white p-2.5 rounded-lg border border-amber-200 bg-amber-50/40 shadow-2xs">
              <div className="text-[11px] text-amber-900 font-sans font-semibold flex items-center justify-between">
                <span>Cạnh Tây (Cọc đáy):</span>
                <ArrowDownUp className="w-3 h-3 text-amber-600" />
              </div>
              <div className="text-amber-950 font-bold">Dài cáp: {westLength.toFixed(1)} m</div>
              <div className="text-[11px] text-amber-800 font-bold mt-0.5">
                Góc nghiêng θ: {westAngleDeg.toFixed(1)}°
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Th = {(results.bedCableTh_kN || 0).toFixed(1)} kN | Tv = {(results.bedCableTv_kN || 0).toFixed(1)} kN
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
