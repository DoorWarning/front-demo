/** [x, y, z, blockId, digCount, digRuns] — a cell of the blueprint's base shape. */
export type BaseVoxel = [number, number, number, number, number, number];

/** [x, y, z, blockId, placeCount, placeRuns] — a cell placed by hand after a run. */
export type AddedVoxel = [number, number, number, number, number, number];

export interface BlueprintSummary {
  id: number;
  runs: number;
  players: number;
  worlds: number;
  topPlayerRunShare: number;
  voxelCount: number;
  size: { x: number; y: number; z: number };
  runsWithEdit: number;
  editRunRate: number;
  digCount: number;
  addCount: number;
  /** Share of edits made by the player who ran the blueprint. null when there were no edits. */
  selfEditShare: number | null;
}

export interface BlockInfo {
  id: number;
  name: string;
  texture: string;
  transparent: boolean;
}

export interface BlueprintDetail {
  summary: BlueprintSummary;
  voxels: BaseVoxel[];
  added: AddedVoxel[];
  blocks: BlockInfo[];
}

export interface BlueprintEditsMeta {
  editWindowMinutes: number;
  minRuns: number;
}
