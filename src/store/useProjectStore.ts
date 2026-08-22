import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ProjectState, CalcResults, RaftInput, EnvInput, LineInput, AnchorInput, Criteria, ProjectMeta, Attachment, SystemType } from '../lib/calc/types';
import { calculateProject } from '../lib/calc';
import { HUOI_VANH_DEFAULT_PROJECT, HUOI_VANH_RAFTS, RaftSummaryItem } from '../data/huoiVanhProject';

export interface ProjectStore {
  // Current active project
  currentProject: ProjectState;
  
  // All projects list (for multi-project management)
  projectList: Array<{ id: string; name: string; code: string; location: string; date: string; systemType: SystemType }>;

  // For multi-raft projects (like Huổi Vanh 13 bè)
  activeRaftId: number;
  raftsSummary: RaftSummaryItem[];

  // Calculation results
  results: CalcResults;

  // Actions
  updateMeta: (meta: Partial<ProjectMeta>) => void;
  updateRaft: (raft: Partial<RaftInput>) => void;
  updateEnv: (env: Partial<EnvInput>) => void;
  updateLine: (line: Partial<LineInput>) => void;
  updateAnchor: (anchor: Partial<AnchorInput>) => void;
  updateCriteria: (criteria: Partial<Criteria>) => void;
  setSystemType: (type: SystemType) => void;
  
  // Raft switching (for 13 rafts)
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

        const current = state.currentProject;
        // Base (project-default) pile geometry — the fallback for every raft
        // that does NOT carry its own Broms override. Falling back to
        // `current.anchor` instead would leak the previously selected raft's
        // (possibly oversized) pile into a raft that never asked for it.
        const defaultAnchor = (HUOI_VANH_DEFAULT_PROJECT as unknown as ProjectState).anchor;
        const updated: ProjectState = {
          ...current,
          activeRaftId: raftId,
          meta: {
            ...current.meta,
            note: `Tính toán cho ${raftItem.name} — diện tích ${raftItem.area_m2.toLocaleString()} m², số dây ${raftItem.cableCount} (bờ: ${raftItem.shoreAnchors}, đáy: ${raftItem.bedAnchors})`
          },
          raft: {
            ...current.raft,
            length_m: raftItem.length_m,
            width_m: raftItem.width_m,
            solarPanelCount: raftItem.solarPanelCount || Math.round(raftItem.area_m2 * 0.22)
          },
          line: {
            ...current.line,
            count: raftItem.cableCount,
            cableCode: raftItem.selectedCable,
            focusFactor: raftItem.focusFactor,
            shoreLineCount: raftItem.shoreAnchors,
            bedLineCount: raftItem.bedAnchors,
            mbl_kN: raftItem.selectedCable === 'PES-48' ? 688
              : raftItem.selectedCable === 'PES-36' ? 385
              : raftItem.selectedCable === 'PES-32' ? 305
              : raftItem.selectedCable === 'PES-28' ? 235
              : 172
          },
          env: {
            ...current.env,
            waterDepth_m: raftItem.waterDepth_m || 6.0
          },
          // Broms pile geometry: per-raft override when the cluster's line
          // tension needs a bigger pile (BP-1..BP-5), otherwise the project
          // default (shore D0.45/L6.5, bed D0.35/L8.0).
          anchor: {
            ...current.anchor,
            shoreD_m: raftItem.shorePileD_m ?? defaultAnchor.shoreD_m,
            shoreL_m: raftItem.shorePileL_m ?? defaultAnchor.shoreL_m,
            bed1D_m: raftItem.bedPileD_m ?? defaultAnchor.bed1D_m,
            bed1L_m: raftItem.bedPileL_m ?? defaultAnchor.bed1L_m
          }
        };

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
      }
    }),
    {
      name: 'mooring-calc-storage',
      version: 3,
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
