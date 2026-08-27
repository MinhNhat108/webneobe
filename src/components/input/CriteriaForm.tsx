import React from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { NumberField } from './NumberField';
import { ShieldCheck } from 'lucide-react';

export const CriteriaForm: React.FC = () => {
  const { currentProject, updateCriteria } = useProjectStore();
  const criteria = currentProject.criteria;

  return (
    <div className="card p-6 space-y-6">
      <div className="form-card-header">
        <div className="form-card-icon bg-rose-50 text-rose-600">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div>
          <h3 className="card-title">
            5. Tiêu Chuẩn Kiểm Tra & Hệ Số An Toàn Thiết Kế
          </h3>
          <p className="card-subtitle">
            Các hệ số an toàn cho phép theo tiêu chuẩn DNV / API / QCVN
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <NumberField
          label="Hệ số an toàn cáp (Nguyên vẹn)"
          value={criteria.sfLineIntact}
          onChange={(val) => updateCriteria({ sfLineIntact: val })}
          unit="-"
          step={0.1}
          min={1.5}
          helpText="MBL / T_max ≥ 3.0"
        />

        <NumberField
          label="Hệ số an toàn cáp (Đứt 1 dây)"
          value={criteria.sfLineDamaged}
          onChange={(val) => updateCriteria({ sfLineDamaged: val })}
          unit="-"
          step={0.1}
          min={1.2}
          helpText="MBL / T_max,dam ≥ 2.0"
        />

        <NumberField
          label="Hệ số an toàn mỏ neo (Nguyên vẹn)"
          value={criteria.sfAnchorIntact}
          onChange={(val) => updateCriteria({ sfAnchorIntact: val })}
          unit="-"
          step={0.1}
          min={1.2}
          helpText="R_total / H_line ≥ 1.5"
        />

        <NumberField
          label="Tỷ lệ chiều dài dây tối thiểu (Scope)"
          value={criteria.minScopeRatio}
          onChange={(val) => updateCriteria({ minScopeRatio: val })}
          unit="-"
          step={0.5}
          min={2.0}
          helpText="L_total / waterDepth ≥ 5.0"
        />

        <NumberField
          label="Khoảng hở đáy bè – đáy hồ tối thiểu (C8)"
          value={criteria.minBedClearance_m}
          onChange={(val) => updateCriteria({ minBedClearance_m: val })}
          unit="m"
          step={0.1}
          min={0.2}
          helpText="Mặc định theo 'Độ sâu tối thiểu cần dưới đáy bè' ở mục Môi trường nếu bỏ trống (1.0m)"
        />

        <NumberField
          label="Khoảng cách dây neo tối đa (C9, cảnh báo)"
          value={criteria.maxLineSpacing_m}
          onChange={(val) => updateCriteria({ maxLineSpacing_m: val })}
          unit="m"
          step={0.5}
          min={2.0}
          helpText="P_bè / N_dây ≤ 15.0 — chỉ cảnh báo, không làm KHÔNG ĐẠT toàn hệ"
        />
      </div>
    </div>
  );
};
