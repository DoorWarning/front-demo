import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { BlueprintDetailPanel } from '@/components/blueprint-edits/blueprint-detail-panel';
import { BlueprintList } from '@/components/blueprint-edits/blueprint-list';
import {
  FEATURED_BLUEPRINT_IDS,
  getBlueprintDetail,
  getBlueprintEditsMeta,
  getBlueprintSummaries,
} from '@/server/data/blueprint-edits';

export async function generateStaticParams() {
  const blueprints = await getBlueprintSummaries();
  return blueprints.map((blueprint) => ({ id: String(blueprint.id) }));
}

async function BlueprintEditsView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const blueprintId = Number(id);
  const [blueprints, detail, meta] = await Promise.all([
    getBlueprintSummaries(),
    getBlueprintDetail(blueprintId),
    getBlueprintEditsMeta(),
  ]);
  if (!detail) {
    notFound();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <aside className="flex flex-col gap-2 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
        <p className="px-3 text-xs text-muted-foreground">
          실행 {meta.minRuns}회 이상 블루프린트 {blueprints.length}개 · 막대는 수정이 있었던 실행
          비율
        </p>
        <div className="max-h-64 overflow-y-auto lg:max-h-none">
          <BlueprintList
            blueprints={blueprints}
            selectedId={blueprintId}
            featuredIds={FEATURED_BLUEPRINT_IDS}
          />
        </div>
      </aside>
      <BlueprintDetailPanel detail={detail} meta={meta} />
    </div>
  );
}

export default function BlueprintEditsPage({ params }: PageProps<'/blueprint-edits/[id]'>) {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6">
      <p className="mb-4 text-sm text-muted-foreground">
        실험용 데모 · 블루프린트 실행 직후 어디를 많이 고쳤나
      </p>
      <Suspense fallback={<p className="text-sm text-muted-foreground">불러오는 중...</p>}>
        <BlueprintEditsView params={params} />
      </Suspense>
    </main>
  );
}
