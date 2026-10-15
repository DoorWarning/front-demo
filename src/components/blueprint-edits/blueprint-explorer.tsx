'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import type { BlueprintDetail } from '@/types/blueprint-edits';

import { type HoveredCell, type ViewMode, VoxelViewer } from './voxel-viewer';

interface BlueprintExplorerProps {
  detail: BlueprintDetail;
}

const VIEW_MODES: { value: ViewMode; label: string }[] = [
  { value: 'heatmap', label: '수정 히트맵' },
  { value: 'texture', label: '원래 텍스처' },
];

export function BlueprintExplorer({ detail }: BlueprintExplorerProps) {
  const [mode, setMode] = useState<ViewMode>('heatmap');
  const [showAdded, setShowAdded] = useState(true);
  const [hovered, setHovered] = useState<HoveredCell | null>(null);

  const maxDigRuns = Math.max(0, ...detail.voxels.map((voxel) => voxel[5]));
  const maxPlaceRuns = Math.max(0, ...detail.added.map((voxel) => voxel[5]));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div role="group" aria-label="보기 방식" className="flex gap-1">
          {VIEW_MODES.map((item) => (
            <Button
              key={item.value}
              size="sm"
              variant={mode === item.value ? 'default' : 'outline'}
              aria-pressed={mode === item.value}
              onClick={() => setMode(item.value)}
            >
              {item.label}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Switch
            aria-labelledby="show-added-label"
            checked={showAdded}
            onCheckedChange={setShowAdded}
          />
          <span id="show-added-label" className="text-sm">
            추가한 칸 보기 ({detail.added.length}칸)
          </span>
        </div>
      </div>

      <div className="relative h-[60vh] max-h-[640px] min-h-96 rounded-lg border bg-muted/40">
        <VoxelViewer detail={detail} mode={mode} showAdded={showAdded} onHover={setHovered} />
        {hovered && (
          <div
            className="pointer-events-none absolute z-10 w-52 rounded-md border bg-popover p-2 text-xs text-popover-foreground shadow-md"
            style={{ left: hovered.screenX + 14, top: hovered.screenY + 14 }}
          >
            <p className="font-medium">{hovered.blockName}</p>
            <p className="text-muted-foreground">
              {hovered.kind === 'base' ? '블루프린트 기본 칸' : '실행 후 추가한 칸'} · (
              {hovered.position.join(', ')})
            </p>
            {hovered.kind === 'base' ? (
              <p className="mt-1">
                캔 횟수 {hovered.count}회 · 캔 실행 {hovered.runs}회 / {detail.summary.runs}회
              </p>
            ) : (
              <p className="mt-1">
                설치 횟수 {hovered.count}회 · 설치한 실행 {hovered.runs}회 / {detail.summary.runs}회
              </p>
            )}
          </div>
        )}
        <p className="pointer-events-none absolute bottom-2 left-3 text-xs text-muted-foreground">
          드래그: 회전 · 휠: 확대 · 오른쪽 드래그: 이동
        </p>
      </div>

      <div className="flex flex-wrap gap-x-8 gap-y-2 text-xs text-muted-foreground">
        {mode === 'heatmap' && (
          <div className="flex items-center gap-2">
            <span>캔 실행 수</span>
            <span>0</span>
            <span className="h-2.5 w-28 rounded-sm bg-linear-to-r from-edit-none to-edit-dig" />
            <span>{maxDigRuns}회 (이 블루프린트 최대)</span>
          </div>
        )}
        {showAdded && (
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-sm border border-edit-add bg-edit-add/40" />
            <span>
              {mode === 'heatmap'
                ? `추가한 칸 (진할수록 여러 실행에서 추가, 최대 ${maxPlaceRuns}회)`
                : '추가한 칸 (실제 블록에 파란 틴트와 테두리)'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
