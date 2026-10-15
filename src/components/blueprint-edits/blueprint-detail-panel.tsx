import { getDetailCaveats } from '@/lib/blueprint-caveats';
import type { BlueprintDetail, BlueprintEditsMeta } from '@/types/blueprint-edits';

import { BlueprintExplorer } from './blueprint-explorer';

interface BlueprintDetailPanelProps {
  detail: BlueprintDetail;
  meta: BlueprintEditsMeta;
}

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

export function BlueprintDetailPanel({ detail, meta }: BlueprintDetailPanelProps) {
  const { summary } = detail;
  const caveats = getDetailCaveats(summary, detail.voxels);
  const stats = [
    { label: '실행', value: `${summary.runs}회` },
    { label: '플레이어 / 월드', value: `${summary.players}명 / ${summary.worlds}곳` },
    {
      label: '수정이 있었던 실행',
      value: `${summary.runsWithEdit}회 (${formatPercent(summary.editRunRate)})`,
    },
    { label: '캔 횟수 / 추가한 횟수', value: `${summary.digCount} / ${summary.addCount}` },
    {
      label: '크기 (기본 칸 수)',
      value: `${summary.size.x}×${summary.size.y}×${summary.size.z} (${summary.voxelCount}칸)`,
    },
  ];

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">블루프린트 #{summary.id}</h1>
        <p className="text-sm text-muted-foreground">
          실행 직후 {meta.editWindowMinutes}분 안에(다음 블루프린트 실행 전까지) 플레이어가 캔 칸과
          새로 놓은 칸입니다.
        </p>
      </header>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((stat) => (
          <div key={stat.label}>
            <dt className="text-xs text-muted-foreground">{stat.label}</dt>
            <dd className="font-medium tabular-nums">{stat.value}</dd>
          </div>
        ))}
      </dl>

      {caveats.length > 0 && (
        <div className="rounded-lg border border-edit-dig/40 bg-edit-dig/5 p-3 text-sm">
          <p className="font-medium">해석 주의</p>
          <ul className="mt-1 flex list-disc flex-col gap-1 pl-5 text-muted-foreground">
            {caveats.map((caveat) => (
              <li key={caveat.kind}>
                <span className="font-medium text-foreground">{caveat.label}.</span>{' '}
                {caveat.description}
              </li>
            ))}
          </ul>
        </div>
      )}

      <BlueprintExplorer key={summary.id} detail={detail} />

      <p className="text-xs text-muted-foreground">
        기본 칸은 실행의 50% 이상에서 설치된 칸입니다. 추가한 칸은 블루프린트 범위(±1칸) 안에 새로
        놓은 칸입니다. 운영 계정은 제외했습니다.
        {summary.selfEditShare !== null &&
          ` 이 블루프린트의 수정 중 ${formatPercent(summary.selfEditShare)}는 실행한 본인이 했습니다.`}
      </p>
    </section>
  );
}
