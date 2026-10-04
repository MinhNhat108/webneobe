import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ProjectState, CalcResults, RaftInput, EnvInput, LineInput, AnchorInput, Criteria, ProjectMeta, Attachment, SystemType } from '../lib/calc/types';
import { calculateProject } from '../lib/calc';
import { HUOI_VANH_DEFAULT_PROJECT, HUOI_VANH_RAFTS, RaftSummaryItem } from '../data/huoiVanhProject';
import { buildRaftProjectState, resolveRaftState, RaftDeviation } from '../lib/calc/raftState';
import type { MooringOption } from '../lib/calc/technicalComparison';
import type { DeadweightParams } from '../lib/calc/deadweight';
import { CostParams, DEFAULT_COST_PARAMS } from '../lib/calc/costEstimate';

const DEFAULT_ANCHOR = (HUOI_VANH_DEFAULT_PROJECT as unknown as ProjectState).anchor;
/**
 * The project as it opens: BÈ 1 exactly as designed. HUOI_VANH_DEFAULT_PROJECT
 * alone is NOT BÈ 1 (it carries older line/pile defaults, e.g. PES-28, 20
 * lines), so it must never be shown as "BÈ 1" without this mapping.
 */
const HUOI_VANH_START = buildRaftProjectState(
  HUOI_VANH_DEFAULT_PROJECT as unknown as ProjectState, HUOI_VANH_RAFTS[0], DEFAULT_ANCHOR
);


export interface RaftBatchResult {
  raft: RaftSummaryItem;
  state: ProjectState;
  results: CalcResults;
  /** The raft being edited in Tab 2 (its state IS currentProject). */
  isActive?: boolean;
  /** Per-raft inputs of the active raft that differ from the frozen design. */
  deviations?: RaftDeviation[];
}

export interface ProjectStore {
  // Current active project
  currentProject: ProjectState;
  
  // All projects list (for multi-project management)
  projectList: Array<{ id: string; name: string; code: string; location: string; date: string; systemType: SystemType }>;

  // For multi-raft projects (Huổi Vanh: 12 cụm bè, BÈ 1 đến BÈ 12)
  activeRaftId: number;
  raftsSummary: RaftSummaryItem[];

  // Calculation results
  results: CalcResults;

  // Lake-bed anchoring option: PA1 = driven piles (the design), PA2 = gravity
  // blocks. It lives IN the project (`anchor.bedAnchorOption`, `anchor.deadweight`)
  // so the engine, the checks, the report and the 3D view all follow it.
  /** Unit prices of the construction quotation (section 10) — editable, persisted. */
  costParams: CostParams;
  updateCostParams: (params: Partial<CostParams>) => void;
  resetCostParams: () => void;
  setMooringOption: (option: MooringOption) => void;
  updateDeadweightParams: (params: Partial<DeadweightParams>) => void;

  // Batch calculation across all rafts in raftsSummary — populated by
  // calculateAllRafts(), consumed by RaftsOverviewTable and the Master Excel export.
  batchResults: RaftBatchResult[];
  batchCalculatedAt: string | null;

  // Actions
  updateMeta: (meta: Partial<ProjectMeta>) => void;
  updateRaft: (raft: Partial<RaftInput>) => void;
  updateEnv: (env: Partial<EnvInput>) => void;
  updateLine: (line: Partial<LineInput>) => void;
  updateAnchor: (anchor: Partial<AnchorInput>) => void;
  updateCriteria: (criteria: Partial<Criteria>) => void;
  setSystemType: (type: SystemType) => void;
  
  // Raft switching (for the 12 rafts of the Huổi Vanh plan)
  setActiveRaft: (raftId: number) => void;

  // Project management
  switchProject: (projectId: string) => void;
  createNewProject: (name?: string, systemType?: SystemType) => void;
  resetToHuoiVanh: () => void;
  importProjectState: (state: ProjectState, rafts?: RaftSummaryItem[]) => void;
  
  // Attachments
  addAttachment: (attachment: Attachment) => void;
  removeAttachment: (id: string) => void;

  // Force recompute
  recalculate: () => void;

  // Batch: calculate every raft in raftsSummary against the current
  // project's environment/criteria/cable-catalogue defaults, for the
  // Master Report table and the Master Excel export.
  calculateAllRafts: () => RaftBatchResult[];
}

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set, get) => ({
      currentProject: HUOI_VANH_START,
      projectList: [
        {
          id: 'huoi-vanh-fpv',
          name: 'Dự án Điện Mặt Trời Nổi Hồ Huổi Vanh',
          code: 'HV-FPV-2026',
          location: 'Hồ Huổi Vanh, Tỉnh Điện Biên',
          date: '2026-08-19',
          systemType: 'solar_fpv'
        }
      ],
      activeRaftId: 1,
      raftsSummary: HUOI_VANH_RAFTS,
      results: calculateProject(HUOI_VANH_START),
      batchResults: [],
      batchCalculatedAt: null,
      costParams: DEFAULT_COST_PARAMS,
      updateCostParams: (params) => set({ costParams: { ...get().costParams, ...params } }),
      resetCostParams: () => set({ costParams: DEFAULT_COST_PARAMS }),
      setMooringOption: (option) => get().updateAnchor({ bedAnchorOption: option }),
      updateDeadweightParams: (params) =>
        get().updateAnchor({ deadweight: { ...(get().currentProject.anchor.deadweight ?? {}), ...params } }),

      updateMeta: (meta) => {
        const current = get().currentProject;
        const updated = {
          ...current,
          meta: { ...current.meta, ...meta },
          name: meta.name ?? current.name,
          code: meta.code ?? current.code
        };
        const results = calculateProject(updated);
        set({ currentProject: updated, results });
      },

      updateRaft: (raft) => {
        const current = get().currentProject;
        const updated = {
          ...current,
          raft: { ...current.raft, ...raft }
        };
        const results = calculateProject(updated);
        set({ currentProject: updated, results });
      },

      updateEnv: (env) => {
        const current = get().currentProject;
        const updated = {
          ...current,
          env: { ...current.env, ...env }
        };
        const results = calculateProject(updated);
        set({ currentProject: updated, results });
      },

      updateLine: (line) => {
        const current = get().currentProject;
        const updated = {
          ...current,
          line: { ...current.line, ...line }
        };
        const results = calculateProject(updated);
        set({ currentProject: updated, results });
      },

      updateAnchor: (anchor) => {
        const current = get().currentProject;
        const updated = {
          ...current,
          anchor: { ...current.anchor, ...anchor }
        };
        const results = calculateProject(updated);
        set({ currentProject: updated, results });
      },

      updateCriteria: (criteria) => {
        const current = get().currentProject;
        const updated = {
          ...current,
          criteria: { ...current.criteria, ...criteria }
        };
        const results = calculateProject(updated);
        set({ currentProject: updated, results });
      },

      setSystemType: (systemType) => {
        const current = get().currentProject;
        const updated = { ...current, systemType };
        const results = calculateProject(updated);
        set({ currentProject: updated, results });
      },

      setActiveRaft: (raftId: number) => {
        const state = get();
        const raftItem = state.raftsSummary.find(r => r.id === raftId);
        if (!raftItem) return;

        // Base (project-default) pile geometry — the fallback for every raft
        // that does NOT carry its own Broms override. Falling back to
        // `current.anchor` instead would leak the previously selected raft's
        // (possibly oversized) pile into a raft that never asked for it.
        const defaultAnchor = (HUOI_VANH_DEFAULT_PROJECT as unknown as ProjectState).anchor;
        const updated = buildRaftProjectState(state.currentProject, raftItem, defaultAnchor);

        const results = calculateProject(updated);
        set({ activeRaftId: raftId, currentProject: updated, results });
      },

      switchProject: (projectId: string) => {
        if (projectId === 'huoi-vanh-fpv') {
          get().resetToHuoiVanh();
        }
      },

      createNewProject: (name = 'Dự án Mới', systemType: SystemType = 'solar_fpv') => {
        const id = 'proj_' + Date.now();
        const newProj: ProjectState = {
          id,
          name,
          code: 'DA-' + new Date().getFullYear(),
          systemType,
          meta: {
            name,
            code: 'DA-' + new Date().getFullYear(),
            location: 'Hồ chứa / Vùng biển',
            designer: 'Kỹ sư Thiết kế',
            date: new Date().toISOString().split('T')[0],
            note: 'Dự án tính toán hệ neo mới'
          },
          raft: {
            length_m: 60.0,
            width_m: 40.0,
            draft_m: 0.2,
            freeboardHeight_m: 0.35,
            displacement_t: 80.0,
            solarPanelCount: 600,
            solarPanelArea_m2: 2.7,
            solarTilt_deg: 12.0,
            solarShieldFactor: 0.55,
            cdPanel: 1.3,
            cdFloat: 1.1
          },
          env: {
            waterDepth_m: 8.0,
            tideRange_m: 1.0,
            windSpeed_ms: 25.0,
            windCd: 1.3,
            currentSpeed_ms: 0.5,
            currentCd: 1.2,
            waveHs_m: 0.3,
            waveTp_s: 2.5,
            waveCd: 1.0,
            waveCurrentFactor: 1.05,
            combinationFactor: 1.0,
            airDensity: 1.25,
            waterDensity: 1000.0,
            gravity: 9.81
          },
          line: {
            count: 16,
            effectiveCount: 4,
            horizontalAngle_deg: 30.0,
            type: 'cable',
            cableCode: 'PES-28',
            chainDiameter_mm: 28,
            chainGrade: 'U2',
            mbl_kN: 235.0,
            unitWeightAir_kgpm: 0.54,
            pretension_kN: 5.0,
            focusFactor: 0.3,
            totalLength_m: 35.0,
            groundedLengthMin_m: 5.0,
            seabedFrictionCoef: 0.8
          },
          anchor: {
            mode: 'pile',
            soil: 'mud',
            cuShore_kPa: 40.0,
            cuBed_kPa: 20.0,
            sfPile: 2.5,
            sfUplift: 2.0,
            concreteRb_MPa: 14.5,
            shoreArm_e_m: 0.5,
            shoreD_m: 0.45,
            shoreL_m: 6.5,
            bed1Arm_e_m: 0.0,
            bed1D_m: 0.35,
            bed1L_m: 8.0,
            bed1Stickup_m: 1.0,
            bed2D_m: 0.70,
            bed2L_m: 9.0,
            anchorType: 'danforth',
            weight_t: 1.5,
            concreteDensity: 2400.0
          },
          criteria: {
            sfLineIntact: 3.0,
            sfLineDamaged: 2.0,
            sfAnchorIntact: 1.5,
            sfAnchorDamaged: 1.1,
            sfPileLateral: 1.0,
            sfPileUplift: 1.0,
            sfPileSection: 1.0,
            maxLineSpacing_m: 15.0,
            minScopeRatio: 5.0,
            maxOffset_m: 1.0
          },
          attachments: []
        };

        const results = calculateProject(newProj);
        set((s) => ({
          currentProject: newProj,
          projectList: [
            ...s.projectList,
            {
              id: newProj.id,
              name: newProj.name,
              code: newProj.code,
              location: newProj.meta.location,
              date: newProj.meta.date,
              systemType: newProj.systemType
            }
          ],
          results
        }));
      },

      resetToHuoiVanh: () => {
        const huoiVanhState = HUOI_VANH_START;
        const results = calculateProject(huoiVanhState);
        set({
          currentProject: huoiVanhState,
          activeRaftId: 1,
          raftsSummary: HUOI_VANH_RAFTS,
          results
        });
      },

      importProjectState: (importedState, rafts) => {
        const results = calculateProject(importedState);
        set({
          currentProject: importedState,
          raftsSummary: rafts || get().raftsSummary,
          results
        });
      },

      addAttachment: (attachment) => {
        const current = get().currentProject;
        const updated = {
          ...current,
          attachments: [...(current.attachments || []), attachment]
        };
        set({ currentProject: updated });
      },

      removeAttachment: (id) => {
        const current = get().currentProject;
        const att = (current.attachments || []).find(a => a.id === id);
        if (att && att.blobUrl) {
          URL.revokeObjectURL(att.blobUrl);
        }
        const updated = {
          ...current,
          attachments: (current.attachments || []).filter(a => a.id !== id)
        };
        set({ currentProject: updated });
      },

      recalculate: () => {
        const results = calculateProject(get().currentProject);
        set({ results });
      },

      calculateAllRafts: () => {
        const state = get();
        const defaultAnchor = (HUOI_VANH_DEFAULT_PROJECT as unknown as ProjectState).anchor;
        const batchResults: RaftBatchResult[] = state.raftsSummary.map((raftItem) => {
          const r = resolveRaftState(state.currentProject, state.activeRaftId, raftItem, defaultAnchor);
          return { raft: raftItem, state: r.state, results: calculateProject(r.state), isActive: r.isActive, deviations: r.deviations };
        });
        set({ batchResults, batchCalculatedAt: new Date().toISOString() });
        return batchResults;
      }
    }),
    {
      name: 'mooring-calc-storage',
      version: 15,
      migrate: (persistedState: any, version: number) => {
        if (persistedState) {
          if (persistedState.currentProject) {
            persistedState.currentProject.systemType = 'solar_fpv';
          }
          if (Array.isArray(persistedState.projectList)) {
            persistedState.projectList.forEach((p: any) => {
              p.systemType = 'solar_fpv';
            });
          }
          // 2026-08-25 Bè 7+8 merge (13 -> 12 rafts): a browser that saved its
          // state before this change still has the stale 13-raft summary
          // (raft id 8 present) cached under this localStorage key. Detect
          // that specific stale shape and re-sync just the raft layout to the
          // current HUOI_VANH_RAFTS — do NOT touch it for a user's own custom
          // (non-Huổi-Vanh) project, only when the cached raftsSummary still
          // carries the removed id 8.
          const hasStaleRaft8 = Array.isArray(persistedState.raftsSummary)
            && persistedState.raftsSummary.some((r: any) => r?.id === 8);
          if (hasStaleRaft8) {
            persistedState.raftsSummary = HUOI_VANH_RAFTS;
            if (persistedState.currentProject?.id === 'huoi-vanh-fpv') {
              persistedState.currentProject = HUOI_VANH_START;
              persistedState.activeRaftId = 1;
            }
            if (persistedState.activeRaftId === 8) {
              persistedState.activeRaftId = 1;
            }
          }

          // 2026-09-22 renumbering to the client's CAD plan: the drawing has
          // exactly 12 clusters, BÈ 1..12, and its cluster 8 merges the two
          // old survey groups 8 and 9. A browser that cached the previous
          // layout still holds names up to "BÈ 13" / an id above 12, which no
          // longer exists — re-sync the raft layout in that case (again, only
          // for the Huổi Vanh project, never a user's own custom one).
          const hasStaleRaft13 = Array.isArray(persistedState.raftsSummary)
            && persistedState.raftsSummary.some((r: any) => (r?.id ?? 0) > 12 || r?.name === 'BÈ 13');
          if (hasStaleRaft13) {
            persistedState.raftsSummary = HUOI_VANH_RAFTS;
            if (persistedState.currentProject?.id === 'huoi-vanh-fpv') {
              persistedState.currentProject = HUOI_VANH_START;
              persistedState.activeRaftId = 1;
            }
          }

          // 2026-09-27 V2 layout (90.724 m² after the BÈ 5 re-cut, 304 lines, square RC piles,
          // tilt 15° / C_d 1.15): a Huổi Vanh raft list cached before this
          // change carries V1 areas, line counts and pile sizes — re-sync it,
          // and the Huổi Vanh project inputs with it. A user's own project is
          // recognised by its raft names and never touched.
          const isHuoiVanhList = Array.isArray(persistedState.raftsSummary)
            && persistedState.raftsSummary.length > 0
            && persistedState.raftsSummary.every((r: any) => /^BÈ \d+$/.test(r?.name ?? ''));
          const cachedArea = isHuoiVanhList
            ? persistedState.raftsSummary.reduce((s: number, r: any) => s + (r?.area_m2 ?? 0), 0)
            : 0;
          const v2Area = HUOI_VANH_RAFTS.reduce((s, r) => s + r.area_m2, 0);
          if (isHuoiVanhList && cachedArea !== v2Area) {
            persistedState.raftsSummary = HUOI_VANH_RAFTS;
            if (persistedState.currentProject?.id === 'huoi-vanh-fpv') {
              persistedState.currentProject = HUOI_VANH_START;
              persistedState.activeRaftId = 1;
            }
          }

          // 2026-09-22: Sync attachments to the updated documents list
          // (including CAD DXF file, HOHUOIVANH.Bố trí sơ bộ bè pin.pdf, and THUYET_MINH.docx)
          if (persistedState.currentProject?.id === 'huoi-vanh-fpv') {
            const hasDxf = persistedState.currentProject.attachments?.some((a: any) => a.kind === 'dxf');
            const hasOldPdfName = persistedState.currentProject.attachments?.some((a: any) => a.name?.includes('bố trí bè pin'));
            const hasDocx = persistedState.currentProject.attachments?.some((a: any) => a.id === 'doc_huoi_vanh_docx');
            if (!hasDxf || hasOldPdfName || !hasDocx) {
              persistedState.currentProject.attachments = (HUOI_VANH_DEFAULT_PROJECT as any).attachments;
            }
          }

          // v9 (2026-09-30): the multi-raft views now show the ACTIVE raft
          // from currentProject. Earlier versions could hold the bare default
          // project under "BÈ 1" (PES-28, 20 lines), which would read as a
          // trial edit — re-apply the active raft's design values once,
          // keeping the project-wide inputs the user set.
          if (version < 9 && persistedState.currentProject?.id === 'huoi-vanh-fpv') {
            const item = HUOI_VANH_RAFTS.find((r) => r.id === persistedState.activeRaftId) ?? HUOI_VANH_RAFTS[0];
            persistedState.activeRaftId = item.id;
            persistedState.currentProject = buildRaftProjectState(persistedState.currentProject, item, DEFAULT_ANCHOR);
          }

          // v10 (2026-10-03): the anchoring option moved into the project and the
          // first PA2 draft's stand-alone keys are gone.
          delete persistedState.mooringOption;
          delete persistedState.costInputs;

          // v11 (2026-10-03): default panel tilt adjusted to 12.0°
          if (version < 11 && persistedState.currentProject?.raft) {
            persistedState.currentProject.raft.solarTilt_deg = 12.0;
          }

          // v12 (2026-10-03): 350 x 350 mm piles with explicit reinforcement
          // (TCVN 5574:2018 bending). A cached Huổi Vanh raft list still holds
          // the 0.35–0.60 m piles and no bars — which the corrected check would
          // show as unreinforced. Re-sync the list and the active raft's pile
          // inputs; project-wide inputs the user set are kept.
          // v14 (2026-10-04): 4 corner bars per pile, shore cable shackled 0.1 m above the ground.
          // v15 (2026-10-04): shore piles are round bored piles D350.
          if (version < 15 && persistedState.currentProject?.id === 'huoi-vanh-fpv') {
            if (persistedState.currentProject.anchor) {
              persistedState.currentProject.anchor.shoreArm_e_m = DEFAULT_ANCHOR.shoreArm_e_m;
              persistedState.currentProject.anchor.shorePileShape = DEFAULT_ANCHOR.shorePileShape;
            }
            persistedState.raftsSummary = HUOI_VANH_RAFTS;
            const item = HUOI_VANH_RAFTS.find((r) => r.id === persistedState.activeRaftId) ?? HUOI_VANH_RAFTS[0];
            persistedState.activeRaftId = item.id;
            persistedState.currentProject = buildRaftProjectState(persistedState.currentProject, item, DEFAULT_ANCHOR);
          }

          // Whatever the history, never leave the app pointing at a raft that
          // is not in the list: the selector would render nothing selected.
          if (Array.isArray(persistedState.raftsSummary)
            && persistedState.raftsSummary.length > 0
            && !persistedState.raftsSummary.some((r: any) => r?.id === persistedState.activeRaftId)) {
            persistedState.activeRaftId = persistedState.raftsSummary[0].id;
          }
        }
        return persistedState;
      },
      onRehydrateStorage: () => (state) => {
        if (state && state.currentProject) {
          state.currentProject.systemType = 'solar_fpv';
          if (state.currentProject.id === 'huoi-vanh-fpv') {
            const hasDxf = state.currentProject.attachments?.some(a => a.kind === 'dxf');
            const hasOldPdfName = state.currentProject.attachments?.some(a => a.name?.includes('bố trí bè pin'));
            const hasDocx = state.currentProject.attachments?.some(a => a.id === 'doc_huoi_vanh_docx');
            if (!hasDxf || hasOldPdfName || !hasDocx) {
              state.currentProject.attachments = (HUOI_VANH_DEFAULT_PROJECT as any).attachments;
            }
          }
          state.results = calculateProject(state.currentProject);
        }
      },
      partialize: (state) => ({
        currentProject: state.currentProject,
        projectList: state.projectList,
        activeRaftId: state.activeRaftId,
        raftsSummary: state.raftsSummary,
        costParams: state.costParams
      })
    }
  )
);

// Every edit in Tab 2 (or a change of the active raft) must reach the
// multi-raft views: once a batch exists, keep it in step with currentProject.
useProjectStore.subscribe((s, prev) => {
  if (s.batchResults.length > 0 && (s.currentProject !== prev.currentProject || s.activeRaftId !== prev.activeRaftId)) {
    s.calculateAllRafts();
  }
});
