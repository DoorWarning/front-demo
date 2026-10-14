import type { BaseVoxel, BlueprintSummary } from '@/types/blueprint-edits';

// One player making up this share of runs means the numbers describe that player's habit.
const SINGLE_PLAYER_SHARE = 0.8;
// Below this many runs a blueprint is an anecdote, not a pattern.
const FEW_RUNS = 10;
// Share of base cells dug at least once above which the heatmap saturates and needs a note.
const MOSTLY_DUG_SHARE = 0.9;

export type CaveatKind = 'single-player' | 'few-runs' | 'mostly-dug';

export interface Caveat {
  kind: CaveatKind;
  label: string;
  description: string;
}

export function getSummaryCaveats(summary: BlueprintSummary): Caveat[] {
  const caveats: Caveat[] = [];
  if (summary.players === 1 || summary.topPlayerRunShare >= SINGLE_PLAYER_SHARE) {
    caveats.push({
      kind: 'single-player',
      label: '한 명의 사례',
      description: `실행의 ${Math.round(summary.topPlayerRunShare * 100)}%를 한 플레이어가 했습니다. 여러 사람의 경향이 아니라 한 사람의 반복 사용으로 읽어 주세요.`,
    });
  }
  if (summary.runs <= FEW_RUNS) {
    caveats.push({
      kind: 'few-runs',
      label: `실행 ${summary.runs}회`,
      description: '실행 수가 적어 패턴이 아니라 개별 사례로만 읽어 주세요.',
    });
  }
  return caveats;
}

export function getDetailCaveats(summary: BlueprintSummary, voxels: BaseVoxel[]): Caveat[] {
  const caveats = getSummaryCaveats(summary);
  const dugCells = voxels.filter((voxel) => voxel[4] > 0).length;
  if (voxels.length > 0 && dugCells / voxels.length >= MOSTLY_DUG_SHARE) {
    caveats.push({
      kind: 'mostly-dug',
      label: '거의 전부 캐짐',
      description: `기본 모양 ${voxels.length}칸 중 ${dugCells}칸을 실행 직후 한 번 이상 캤습니다. 히트맵이 전부 진하게 나오는 것이 정상입니다. 한 실행에서 통째로 철거했는지, 여러 실행에 나눠 캤는지는 캔 실행 수로 구분해 보세요.`,
    });
  }
  return caveats;
}
