/**
 * Shore-First Mooring Layout Optimizer (Bộ giải tối ưu hóa ưu tiên cọc neo ven bờ hồ).
 * 
 * Objective:
 * 1. Prioritize shore anchor piles along lake boundary (elev 384.5m) to minimize expensive
 *    submerged lake-bed piles.
 * 2. Ensure pile structural and geotechnical capacity: P_req <= P_max, safety factors
 *    SF_uplift >= 1.0, SF_lateral >= 1.0 using Broms method.
 * 3. Update pile schedule with optimized L_opt and P_max for all 12 rafts.
 */

import { MooringCoordinate, RaftSummaryItem } from '../../data/huoiVanhProject';
import { ProjectState, PileOptimizationResult } from './types';
import { optimizePileEmbedment } from './pileOptimizer';

export interface ShoreOptimizationSummary {
  originalShoreCount: number;
  originalBedCount: number;
  optimizedShoreCount: number;
  optimizedBedCount: number;
  convertedCount: number;
  shorePercentageBefore: number;
  shorePercentageAfter: number;
  estimatedCostSavingPercent: number; // Shore piles cost ~35% of lake bed piles
}

export interface OptimizedMooringResult {
  coordinates: MooringCoordinate[];
  rafts: RaftSummaryItem[];
  summary: ShoreOptimizationSummary;
  pileOptimizations: Record<string, {
    shore: PileOptimizationResult;
    bed: PileOptimizationResult;
  }>;
}

/**
 * Optimizes mooring line layout to prioritize lake shore anchor piles.
 *
 * @param coordinates Original 299 coordinates
 * @param rafts The 12 rafts of Huổi Vanh
 * @param project Base project state with soil & design load parameters
 * @param maxShoreSpan_m Maximum practical cable span to shore (default 65.0 m)
 */
export function optimizeMooringLayoutToShore(
  coordinates: MooringCoordinate[],
  rafts: RaftSummaryItem[],
  project: ProjectState,
  maxShoreSpan_m: number = 65.0
): OptimizedMooringResult {
  let originalShore = 0;
  let originalBed = 0;
  coordinates.forEach((c) => {
    if (c.type === 'SHORE') originalShore++;
    else originalBed++;
  });

  // Calculate bounding shoreline profiles per raft based on existing shore anchors
  const raftShoreRanges = new Map<string, { minX: number; maxX: number; minY: number; maxY: number; avgZ: number }>();
  coordinates.forEach((c) => {
    if (c.type === 'SHORE') {
      const r = raftShoreRanges.get(c.raft) || {
        minX: Infinity, maxX: -Infinity,
        minY: Infinity, maxY: -Infinity,
        avgZ: c.zAnchor || 384.5
      };
      r.minX = Math.min(r.minX, c.xAnchor);
      r.maxX = Math.max(r.maxX, c.xAnchor);
      r.minY = Math.min(r.minY, c.yAnchor);
      r.maxY = Math.max(r.maxY, c.yAnchor);
      raftShoreRanges.set(c.raft, r);
    }
  });

  const optimizedCoords: MooringCoordinate[] = [];
  const raftShoreCounts = new Map<string, number>();
  const raftBedCounts = new Map<string, number>();

  let convertedCount = 0;

  coordinates.forEach((c) => {
    if (c.type === 'SHORE') {
      // Keep existing surveyed shore anchors
      optimizedCoords.push({ ...c });
      raftShoreCounts.set(c.raft, (raftShoreCounts.get(c.raft) || 0) + 1);
    } else {
      // BED anchor: Evaluate if it can be extended to reach the lake shoreline
      const shoreRange = raftShoreRanges.get(c.raft);
      const rad = (c.azimuth * Math.PI) / 180;
      const dx = Math.sin(rad); // azimuth is clockwise from North (+Y)
      const dy = Math.cos(rad);

      let canConvert = false;
      let newSpan = c.span;
      let newXAnchor = c.xAnchor;
      let newYAnchor = c.yAnchor;

      if (shoreRange) {
        // Test extension lengths from 28m up to maxShoreSpan_m
        const targetSpan = Math.min(maxShoreSpan_m, Math.max(35.0, c.span * 2.2));
        const testX = c.xRaft + targetSpan * dx;
        const testY = c.yRaft + targetSpan * dy;

        // Check if the ray points towards the shoreline sector of this raft
        const nearShoreSector = (
          (testX >= shoreRange.minX - 40 && testX <= shoreRange.maxX + 40) &&
          (testY >= shoreRange.minY - 40 && testY <= shoreRange.maxY + 40)
        );

        // Rafts near shore have clear directional affinity
        const isFringeRaft = ['BÈ 1', 'BÈ 2', 'BÈ 3', 'BÈ 4', 'BÈ 8', 'BÈ 9', 'BÈ 10', 'BÈ 11', 'BÈ 12'].includes(c.raft);

        if (nearShoreSector || (isFringeRaft && targetSpan <= maxShoreSpan_m)) {
          canConvert = true;
          newSpan = Math.round(targetSpan * 10) / 10;
          newXAnchor = Math.round(testX * 100) / 100;
          newYAnchor = Math.round(testY * 100) / 100;
        }
      }

      if (canConvert) {
        convertedCount++;
        optimizedCoords.push({
          ...c,
          type: 'SHORE',
          xAnchor: newXAnchor,
          yAnchor: newYAnchor,
          zAnchor: 384.5,
          span: newSpan
        });
        raftShoreCounts.set(c.raft, (raftShoreCounts.get(c.raft) || 0) + 1);
      } else {
        // Remains BED anchor in deep lake center
        optimizedCoords.push({ ...c });
        raftBedCounts.set(c.raft, (raftBedCounts.get(c.raft) || 0) + 1);
      }
    }
  });

  const optimizedRafts: RaftSummaryItem[] = rafts.map((r) => {
    const sc = raftShoreCounts.get(r.name) || r.shoreAnchors;
    const bc = raftBedCounts.get(r.name) || (r.cableCount - sc);
    return {
      ...r,
      shoreAnchors: sc,
      bedAnchors: Math.max(0, bc)
    };
  });

  const optShoreTotal = Array.from(raftShoreCounts.values()).reduce((a, b) => a + b, 0);
  const optBedTotal = Array.from(raftBedCounts.values()).reduce((a, b) => a + b, 0);

  // Run Broms Pile Optimizer for all 12 rafts to calculate required L_opt & P_max
  const pileOptimizations: Record<string, { shore: PileOptimizationResult; bed: PileOptimizationResult }> = {};

  optimizedRafts.forEach((r) => {
    const appliedHShore = 25.0 * (r.focusFactor || 0.3) * (35 / Math.max(1, r.shoreAnchors));
    const appliedTvShore = 15.0 * (r.focusFactor || 0.3) * (35 / Math.max(1, r.shoreAnchors));
    const cableTensionShore = Math.hypot(appliedHShore, appliedTvShore);

    // Shore pile optimizer
    const shoreOpt = optimizePileEmbedment({
      soilType: project.anchor.soilShore || 'clay',
      cu_kPa: project.anchor.cuShore_kPa || 40,
      phi_deg: project.anchor.phiShore_deg,
      gammaSub_kNm3: project.anchor.gammaSubShore_kNm3,
      appliedH: appliedHShore,
      appliedTv: appliedTvShore,
      cableTension_kN: cableTensionShore,
      e: project.anchor.shoreArm_e_m || 0.5,
      D: r.shorePileD_m || project.anchor.shoreD_m || 0.45,
      FS: project.criteria.sfPileLateral || 1.0,
      concreteRb_MPa: project.anchor.concreteRb_MPa || 14.5,
      minL_m: 3.0,
      maxL_m: 15.0
    });

    const appliedHBed = 28.0 * (r.focusFactor || 0.3) * (35 / Math.max(1, r.bedAnchors || 1));
    const appliedTvBed = 18.0 * (r.focusFactor || 0.3) * (35 / Math.max(1, r.bedAnchors || 1));
    const cableTensionBed = Math.hypot(appliedHBed, appliedTvBed);

    // Bed pile optimizer
    const bedOpt = optimizePileEmbedment({
      soilType: project.anchor.soilBed || 'mud',
      cu_kPa: project.anchor.cuBed_kPa || 20,
      phi_deg: project.anchor.phiBed_deg,
      gammaSub_kNm3: project.anchor.gammaSubBed_kNm3,
      appliedH: appliedHBed,
      appliedTv: appliedTvBed,
      cableTension_kN: cableTensionBed,
      e: project.anchor.bed1Arm_e_m || 0.0,
      D: r.bedPileD_m || project.anchor.bed1D_m || 0.35,
      FS: project.criteria.sfPileLateral || 1.0,
      concreteRb_MPa: project.anchor.concreteRb_MPa || 14.5,
      minL_m: 4.0,
      maxL_m: 18.0
    });

    pileOptimizations[r.name] = { shore: shoreOpt, bed: bedOpt };
  });

  const summary: ShoreOptimizationSummary = {
    originalShoreCount: originalShore,
    originalBedCount: originalBed,
    optimizedShoreCount: optShoreTotal,
    optimizedBedCount: optBedTotal,
    convertedCount,
    shorePercentageBefore: Math.round((originalShore / coordinates.length) * 100),
    shorePercentageAfter: Math.round((optShoreTotal / coordinates.length) * 100),
    estimatedCostSavingPercent: Math.round(
      ((originalBed - optBedTotal) * 1.8) / (originalBed * 2.8 + originalShore * 1.0) * 100
    )
  };

  return {
    coordinates: optimizedCoords,
    rafts: optimizedRafts,
    summary,
    pileOptimizations
  };
}
