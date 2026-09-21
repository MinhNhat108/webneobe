import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ProjectState, CalcResults, RaftInput, EnvInput, LineInput, AnchorInput, Criteria, ProjectMeta, Attachment, SystemType } from '../lib/calc/types';
import { calculateProject } from '../lib/calc';
import { HUOI_VANH_DEFAULT_PROJECT, HUOI_VANH_RAFTS, RaftSummaryItem } from '../data/huoiVanhProject';

const CABLE_MBL_KN: Record<string, number> = {
  'PES-48': 688,
  'PES-36': 385,
  'PES-32': 305,
  'PES-28': 235
};

/**
 * Builds the per-raft ProjectState override — the SAME logic `setActiveRaft`
 * applies to switch the active raft, factored out so the batch calculator
 * (`calculateAllRafts`) can run it for all 12 rafts without touching
 * `activeRaftId` / `currentProject` in the store.
 */
function buildRaftProjectState(
  base: ProjectState,
  raftItem: RaftSummaryItem,
  defaultAnchor: AnchorInput
): ProjectState {
  return {
    ...base,
    activeRaftId: raftItem.id,
    meta: {
      ...base.meta,
      note: `Tính toán cho ${raftItem.name} — diện tích ${raftItem.area_m2.toLocaleString()} m², số dây ${raftItem.cableCount} (bờ: ${raftItem.shoreAnchors}, đáy: ${raftItem.bedAnchors})`
    },
    raft: {
      ...base.raft,
      length_m: raftItem.length_m,
      width_m: raftItem.width_m,
      solarPanelCount: raftItem.solarPanelCount || Math.round(raftItem.area_m2 * 0.22)
    },
    line: {
      ...base.line,
      count: raftItem.cableCount,
      cableCode: raftItem.selectedCable,
      focusFactor: raftItem.focusFactor,
      shoreLineCount: raftItem.shoreAnchors,
      bedLineCount: raftItem.bedAnchors,
      mbl_kN: CABLE_MBL_KN[raftItem.selectedCable] ?? 172
    },
    env: {
      ...base.env,
      waterDepth_m: raftItem.waterDepth_m || 6.0
    },
    anchor: {
      ...base.anchor,
      shoreD_m: raftItem.shorePileD_m ?? defaultAnchor.shoreD_m,
      shoreL_m: raftItem.shorePileL_m ?? defaultAnchor.shoreL_m,
      bed1D_m: raftItem.bedPileD_m ?? defaultAnchor.bed1D_m,
      bed1L_m: raftItem.bedPileL_m ?? defaultAnchor.bed1L_m
    }
  };
}

export interface RaftBatchResult {
  raft: RaftSummaryItem;
  state: ProjectState;
  results: CalcResults;
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
      currentProject: HUOI_VANH_DEFAULT_PROJECT as unknown as ProjectState,
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
      results: calculateProject(HUOI_VANH_DEFAULT_PROJECT as unknown as ProjectState),
      batchResults: [],
      batchCalculatedAt: null,

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
        const huoiVanhState = HUOI_VANH_DEFAULT_PROJECT as unknown as ProjectState;
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
          const raftState = buildRaftProjectState(state.currentProject, raftItem, defaultAnchor);
          return { raft: raftItem, state: raftState, results: calculateProject(raftState) };
        });
        set({ batchResults, batchCalculatedAt: new Date().toISOString() });
        return batchResults;
      }
    }),
    {
      name: 'mooring-calc-storage',
      version: 5,
      migrate: (persistedState: any) => {
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
              persistedState.currentProject = HUOI_VANH_DEFAULT_PROJECT;
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
              persistedState.currentProject = HUOI_VANH_DEFAULT_PROJECT;
            }
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
          state.results = calculateProject(state.currentProject);
        }
      },
      partialize: (state) => ({
        currentProject: state.currentProject,
        projectList: state.projectList,
        activeRaftId: state.activeRaftId,
        raftsSummary: state.raftsSummary
      })
    }
  )
);
