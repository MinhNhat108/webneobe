import * as THREE from 'three';

export interface WindParams {
  speed: number; // m/s (0 to 45)
  direction: number; // degrees (0 to 360, 0 = North, 90 = East)
  gustFactor: number; // 1.0 to 1.35
  airDensity: number; // kg/m3 (default 1.225)
  dragCoefficient: number; // default 1.15
}

export interface LayerVisibility {
  rafts: boolean;
  solarPanels: boolean;
  mooringLines: boolean;
  shorePiles: boolean;
  bedPiles: boolean;
  waterSurface: boolean;
  lakeTerrain: boolean;
  windStreamlines: boolean;
  labels: boolean;
  axesAndGrid: boolean;
  ifcModel: boolean;
}

export type CameraPreset = 'overview' | 'topDown' | 'waterLevel' | 'raftFocus';

export interface SelectedElement {
  type: 'raft' | 'line' | 'pile';
  id: string; // e.g. 'BÈ 1' or 'N1-01'
  title: string;
  data: Record<string, string | number | boolean>;
}

export interface LoadedIfcMetadata {
  fileName: string;
  fileSize: number;
  elementCount: number;
  schema?: string;
  categories: {
    terrain: number;
    rafts: number;
    cables: number;
    piles: number;
    water: number;
    other: number;
  };
  rootGroup?: THREE.Group;
}
