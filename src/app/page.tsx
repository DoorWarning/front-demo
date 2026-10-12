import { Button } from '@/components/ui/button';

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 px-4">
      <p className="text-sm text-muted-foreground">5dots front demo</p>
      <h1 className="text-3xl font-semibold tracking-tight">
        플레이어의 콘텐츠 실행 직후 행동 분석
      </h1>
      <p className="text-muted-foreground">
        블루프린트 실행 직후 플레이어가 무엇을 하는지로 콘텐츠의 개선점을 찾습니다.
      </p>
      <div>
        <Button>시작하기</Button>
      </div>
    </main>
  );
}
