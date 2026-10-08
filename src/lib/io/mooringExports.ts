import type { CalcResults, ProjectState } from '../calc/types';
import type { MooringOption } from '../calc/technicalComparison';
import type { PileScheduleBatchLike } from './pileSchedule';
import { exportPileScheduleToExcel } from './excelExport';
import { exportMooringPileDxf } from './dxfExport';
import { exportDeadweightScheduleToExcel } from './deadweightExcel';
import { exportMooringDeadweightDxf } from './deadweightDxf';
import { exportScrewBaseScheduleToExcel } from './screwBaseExcel';
import { exportMooringScrewBaseDxf } from './screwBaseDxf';

/**
 * The anchor schedule and the layout drawing follow the lake-bed option the
 * project is on — one place decides, so the header buttons and the layout tab
 * can never export two different things for the same project.
 */
export const mooringOptionOf = (state: ProjectState): MooringOption => state.anchor.bedAnchorOption ?? 'PA1_PILE';

export const MOORING_OPTION_LABEL: Record<MooringOption, string> = {
  PA1_PILE: 'Cọc đóng BTCT 350×350',
  PA2_DEADWEIGHT: 'Khối bê tông trọng lực',
  PA3_SCREW_BASE: 'Đế BTCT + vít xoắn'
};

export function exportAnchorSchedule(state: ProjectState, results: CalcResults, batch?: PileScheduleBatchLike[]): void {
  const option = mooringOptionOf(state);
  if (option === 'PA3_SCREW_BASE') exportScrewBaseScheduleToExcel(state, results, batch);
  else if (option === 'PA2_DEADWEIGHT') exportDeadweightScheduleToExcel(state, results, batch);
  else exportPileScheduleToExcel(state, results, batch);
}

export function exportMooringCad(state: ProjectState, results: CalcResults, batch?: PileScheduleBatchLike[]): void {
  const option = mooringOptionOf(state);
  if (option === 'PA3_SCREW_BASE') exportMooringScrewBaseDxf(state, results, batch);
  else if (option === 'PA2_DEADWEIGHT') exportMooringDeadweightDxf(state, results, batch);
  else exportMooringPileDxf(state, results, batch);
}
