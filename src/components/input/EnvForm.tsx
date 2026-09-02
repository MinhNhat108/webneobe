import React from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { NumberField } from './NumberField';
import { Waves, Wind } from 'lucide-react';

export const EnvForm: React.FC = () => {
  const { currentProject, updateEnv } = useProjectStore();
  const env = currentProject.env;
  const isSolar = currentProject.systemType === 'solar_fpv';

  return (
    <div className="card p-6 space-y-6">
      <div className="form-card-header">
        <div className="form-card-icon bg-sky-50 text-sky-600">
          <Wind className="w-5 h-5" />
        </div>
        <div>
          <h3 className="card-title">
            2. Điều Kiện Môi Trường & Mực Nước Hồ Chứa
          </h3>
          <p className="card-subtitle">
            Gió bão thiết kế, độ sâu hồ, dao động mực nước MNDBT/MNCN và dòng chảy
          </p>
        </div>
      </div>

      {/* Reservoir Water Level Section */}
      <div className="field-grid">
        <NumberField
          label="Mực nước dâng bình thường (MNDBT)"
          value={env.mndbt_m}
          onChange={(val) => updateEnv({ mndbt_m: val })}
          unit="m"
          step={0.1}
          helpText="Cao trình MNDBT theo hồ sơ hồ chứa (vd: 383m)"
        />

        <NumberField
          label="Mực nước cao nhất (MNCN)"
          value={env.mncn_m}
          onChange={(val) => updateEnv({ mncn_m: val })}
          unit="m"
          step={0.1}
          helpText="Cao trình MNCN khi có lũ kiểm tra (vd: 384m)"
        />

        <NumberField
          label="Độ sâu nước tại vị trí bè"
          value={env.waterDepth_m}
          onChange={(val) => updateEnv({ waterDepth_m: val })}
          unit="m"
          step={0.1}
          min={0.5}
          helpText="Độ sâu từ mặt nước tới đáy bùn lòng hồ (vd: 6.0m)"
        />

        <NumberField
          label="Biên độ dao động mực nước"
          value={env.tideRange_m}
          onChange={(val) => updateEnv({ tideRange_m: val })}
          unit="m"
          step={0.1}
          min={0}
          helpText="Chênh lệch giữa MNCN và MNDBT hoặc thủy triều"
        />

        <NumberField
          label="Độ dốc mái bờ hồ (1:m)"
          value={env.bankSlope_m}
          onChange={(val) => updateEnv({ bankSlope_m: val })}
          unit="m"
          step={0.1}
          min={0.1}
          helpText="Tỷ lệ độ dốc tự nhiên của sườn bờ hồ (1:3.1)"
        />

        <NumberField
          label="Độ sâu tối thiểu cần dưới đáy bè"
          value={env.minWaterDepthUnderRaft_m}
          onChange={(val) => updateEnv({ minWaterDepthUnderRaft_m: val })}
          unit="m"
          step={0.1}
          min={0.5}
          helpText="Khoảng cách an toàn chống bè chạm đáy bùn (1.5m)"
        />
      </div>

      {/* Wind & Current & Waves */}
      <div className="border-t border-slate-100 pt-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm">
            <Waves className="w-4 h-4 text-sky-600" />
            Tải trọng Gió, Sóng & Dòng chảy thiết kế
          </div>

          {isSolar && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Cách tổ hợp tải (FPV):</span>
              <div className="flex rounded-lg bg-slate-100 p-1 border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => updateEnv({ loadCombinationMode: 'fpv_combined' })}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                    (env.loadCombinationMode ?? 'fpv_combined') === 'fpv_combined'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Gộp dòng chảy & sóng vào tải gió qua hệ số 1.05"
                >
                  Gộp hệ số 1.05
                </button>
                <button
                  type="button"
                  onClick={() => updateEnv({ loadCombinationMode: 'separate' })}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                    env.loadCombinationMode === 'separate'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Tính riêng lực gió, dòng chảy và sóng theo công thức từng thành phần"
                >
                  Tính riêng biệt
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <NumberField
              label="Vận tốc gió thiết kế (V_wind)"
              value={env.windSpeed_ms}
              onChange={(val) => updateEnv({ windSpeed_ms: val })}
              unit="m/s"
              step={0.5}
              min={0}
              helpText={`Gió ${(env.windSpeed_ms * 3.6).toFixed(1)} km/h • q = ${(0.5 * (env.airDensity || 1.25) * env.windSpeed_ms * env.windSpeed_ms).toFixed(1)} Pa`}
            />
            {/* Quick preset wind speed selector */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] font-medium text-slate-500">Chọn nhanh:</span>
              {[
                { label: '10 m/s (Cấp 5-6)', speed: 10.0, hint: 'Gió thường / Vận hành' },
                { label: '15 m/s (Cấp 7)', speed: 15.0, hint: 'Gió mạnh' },
                { label: '20 m/s (Cấp 8-9)', speed: 20.0, hint: 'Gió giông' },
                { label: '30 m/s (Cấp 11)', speed: 30.0, hint: 'Bão thiết kế' }
              ].map((item) => {
                const isActive = Math.abs(env.windSpeed_ms - item.speed) < 0.1;
                return (
                  <button
                    key={item.speed}
                    type="button"
                    onClick={() => updateEnv({ windSpeed_ms: item.speed })}
                    title={item.hint}
                    className={`text-[11px] px-2 py-0.5 rounded-full font-medium transition-all ${
                      isActive
                        ? 'bg-sky-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 border border-slate-200'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          <NumberField
            label="Hệ số cản gió (Cd_wind)"
            value={env.windCd}
            onChange={(val) => updateEnv({ windCd: val })}
            unit="-"
            step={0.05}
            min={0.1}
            helpText="Hệ số khí động học tấm pin / bè (1.3)"
          />

          <NumberField
            label="Vận tốc dòng chảy (V_current)"
            value={env.currentSpeed_ms}
            onChange={(val) => updateEnv({ currentSpeed_ms: val })}
            unit="m/s"
            step={0.1}
            min={0}
            helpText="Vận tốc dòng nước mặt hồ / biển (0.5 m/s)"
          />

          <NumberField
            label="Hệ số bổ sung Sóng & Dòng"
            value={env.waveCurrentFactor}
            onChange={(val) => updateEnv({ waveCurrentFactor: val })}
            unit="-"
            step={0.01}
            min={1.0}
            disabled={isSolar && env.loadCombinationMode === 'separate'}
            helpText={isSolar && env.loadCombinationMode === 'separate'
              ? 'Không dùng ở chế độ tính riêng biệt'
              : 'Hệ số gia tăng tải trọng môi trường trong hồ (1.05)'}
          />
        </div>

        {/* Wave/current detail terms — only load-bearing in 'separate' FPV mode
            or the general (non-FPV) hydrodynamic branch, but always editable
            here so switching modes never leaves them at a silent default. */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <NumberField
            label="Chiều cao sóng thiết kế (Hs)"
            value={env.waveHs_m}
            onChange={(val) => updateEnv({ waveHs_m: val })}
            unit="m"
            step={0.05}
            min={0}
            helpText="Chiều cao sóng có nghĩa tại vị trí bè (F_wave)"
          />
          <NumberField
            label="Hệ số cản sóng (Cd_wave)"
            value={env.waveCd}
            onChange={(val) => updateEnv({ waveCd: val })}
            unit="-"
            step={0.05}
            min={0.1}
            helpText="Hệ số phản xạ sóng dùng trong F_wave (1.0)"
          />
          <NumberField
            label="Hệ số cản dòng chảy (Cd_current)"
            value={env.currentCd}
            onChange={(val) => updateEnv({ currentCd: val })}
            unit="-"
            step={0.05}
            min={0.1}
            helpText="Hệ số cản thủy động lực học cho F_current (1.2)"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
          <NumberField
            label="Khối lượng riêng không khí (ρ_air)"
            value={env.airDensity}
            onChange={(val) => updateEnv({ airDensity: val })}
            unit="kg/m³"
            step={0.01}
          />
          <NumberField
            label="Khối lượng riêng nước (ρ_water)"
            value={env.waterDensity}
            onChange={(val) => updateEnv({ waterDensity: val })}
            unit="kg/m³"
            step={1}
            helpText="1000 kg/m³ cho nước ngọt hồ chứa, 1025 cho biển"
          />
          <NumberField
            label="Gia tốc trọng trường (g)"
            value={env.gravity}
            onChange={(val) => updateEnv({ gravity: val })}
            unit="m/s²"
            step={0.01}
          />
        </div>
      </div>
    </div>
  );
};
