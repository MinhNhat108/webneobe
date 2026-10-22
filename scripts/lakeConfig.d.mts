/** Types of scripts/lakeConfig.mjs, for the TypeScript scripts and tests that import it. */
export interface ScriptLake {
  id: 'huoi-vanh' | 'ban-mong';
  files: Record<'polygons' | 'coords' | 'piles' | 'terrain' | 'catalogue', string>;
  mndb: number;
  waterDepth: Record<string, number>;
  defaultDepth: number | null;
  bedOnTerrain: boolean;
  bedMaxGround?: number;
  gapLimited: string[];
  /** Panels of each raft from the drawing; without it the plan total is shared by area. */
  panelsByRaft?: Record<string, number>;
  /** R3: a single base facing a raft without room for a partner is reported, not a violation. */
  singleBaseFacingOk?: boolean;
}
export const ROOT: string;
export const LAKES: Record<'huoi-vanh' | 'ban-mong', ScriptLake>;
export function lakeFromArgv(argv?: string[]): ScriptLake & { abs: ScriptLake['files'] };
