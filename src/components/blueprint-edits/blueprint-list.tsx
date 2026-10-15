import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { getSummaryCaveats } from '@/lib/blueprint-caveats';
import { cn } from '@/lib/utils';
import type { BlueprintSummary } from '@/types/blueprint-edits';

interface BlueprintListProps {
  blueprints: BlueprintSummary[];
  selectedId: number;
  featuredIds: readonly number[];
}

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

export function BlueprintList({ blueprints, selectedId, featuredIds }: BlueprintListProps) {
  return (
    <nav aria-label="블루프린트 목록">
      <ul className="flex flex-col gap-1">
        {blueprints.map((blueprint) => {
          const caveats = getSummaryCaveats(blueprint);
          const selected = blueprint.id === selectedId;
          return (
            <li key={blueprint.id}>
              <Link
                href={`/blueprint-edits/${blueprint.id}`}
                aria-current={selected ? 'page' : undefined}
                className={cn(
                  'flex flex-col gap-1 rounded-md px-3 py-2 text-sm hover:bg-accent',
                  selected && 'bg-accent',
                )}
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">
                    #{blueprint.id}
                    {featuredIds.includes(blueprint.id) && (
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                        볼만한 사례
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    실행 {blueprint.runs}회
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full bg-edit-dig"
                      style={{ width: formatPercent(blueprint.editRunRate) }}
                    />
                  </span>
                  <span className="w-20 text-right text-xs text-muted-foreground tabular-nums">
                    수정 {formatPercent(blueprint.editRunRate)}
                  </span>
                </span>
                {caveats.length > 0 && (
                  <span className="flex flex-wrap gap-1">
                    {caveats.map((caveat) => (
                      <Badge key={caveat.kind} variant="outline" className="text-[11px]">
                        {caveat.label}
                      </Badge>
                    ))}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
