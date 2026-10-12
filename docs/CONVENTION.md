# 코드 컨벤션

이 저장소는 [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript)와 [Airbnb React/JSX Style Guide](https://github.com/airbnb/javascript/tree/master/react)를 기준으로 한다. 사람이 외우지 않아도 되도록 대부분은 도구가 강제한다.

| 도구                                     | 역할                                         | 설정 파일                  |
| ---------------------------------------- | -------------------------------------------- | -------------------------- |
| ESLint + `eslint-config-airbnb-extended` | Airbnb 규칙 (JS, React, Next.js, TypeScript) | `eslint.config.mjs`        |
| Prettier                                 | 포맷 (따옴표, 줄바꿈, Tailwind 클래스 정렬)  | `.prettierrc.json`         |
| husky + lint-staged                      | 커밋 전 변경 파일 자동 lint/format           | `.husky/pre-commit`        |
| commitlint                               | 커밋 메시지 형식 검사                        | `commitlint.config.mjs`    |
| GitHub Actions                           | PR마다 `pnpm check` + `pnpm build`           | `.github/workflows/ci.yml` |

PR 올리기 전에 `pnpm check` 하나만 통과시키면 된다.

## 1. 포맷 (Prettier가 처리)

- 작은따옴표 `'`, JSX 속성은 큰따옴표 `"`
- 세미콜론 사용, trailing comma `all`
- 들여쓰기 2칸, 한 줄 최대 100자
- Tailwind 클래스 순서는 `prettier-plugin-tailwindcss`가 정렬한다. 손으로 정렬하지 않는다.

## 2. Airbnb 핵심 규칙 (ESLint가 처리)

- `var` 금지, 기본은 `const`, 재할당할 때만 `let`
- 콜백은 화살표 함수
- 객체/배열은 리터럴과 구조 분해 사용
- `==` 금지, `===` 사용
- 사용하지 않는 변수, import 금지
- import 순서: 외부 패키지 → `@/` 내부 모듈 → 상대 경로

## 3. 팀 예외 규칙

Airbnb 원칙과 Next.js/shadcn 관례가 충돌하는 곳만 끈다. 새 예외를 추가하면 이 표에 이유를 적는다.

| 규칙                             | 상태 | 이유                                                                 |
| -------------------------------- | ---- | -------------------------------------------------------------------- |
| `import-x/prefer-default-export` | off  | App Router의 `page`/`layout`만 default export, 나머지는 named export |
| `react/react-in-jsx-scope`       | off  | React 17+ JSX 변환                                                   |
| `react/jsx-props-no-spreading`   | off  | shadcn/ui 컴포넌트가 `...props` 패턴 사용                            |
| `react/require-default-props`    | off  | TypeScript 타입이 prop-types를 대체                                  |
| `src/components/ui/**` 일부 규칙 | off  | shadcn이 생성한 코드는 원본과 가깝게 유지                            |

## 4. 폴더 구조

```
src/
  app/                 # 라우트. page.tsx, layout.tsx, loading.tsx 등만 둔다
  components/
    ui/                # shadcn/ui 생성 컴포넌트 (pnpm dlx shadcn@latest add ...)
    <feature>/         # 기능별 컴포넌트 (예: blueprint/, charts/)
  hooks/               # use 로 시작하는 커스텀 훅
  lib/                 # 순수 함수, 데이터 변환, utils.ts(cn)
  types/               # 공용 타입
```

## 5. 네이밍

| 대상            | 규칙                        | 예시                 |
| --------------- | --------------------------- | -------------------- |
| 컴포넌트 파일   | kebab-case                  | `blueprint-card.tsx` |
| 컴포넌트 이름   | PascalCase                  | `BlueprintCard`      |
| 훅              | camelCase, `use` 시작       | `useRunStats`        |
| 함수/변수       | camelCase                   | `getAfterActions`    |
| 상수            | UPPER_SNAKE_CASE            | `MAX_RUN_COUNT`      |
| 타입/인터페이스 | PascalCase, `I` 접두사 금지 | `RunEvent`           |

shadcn CLI가 kebab-case 파일을 만들기 때문에 파일명은 kebab-case로 통일한다.

## 6. React / Next.js

- 기본은 Server Component. 상태, 이벤트, 브라우저 API가 필요할 때만 파일 맨 위에 `'use client'`
- 컴포넌트는 함수 선언형: `export function BlueprintCard() {}`
- props 타입은 컴포넌트 바로 위에 `type BlueprintCardProps = {...}`
- 페이지 데이터 로딩은 Server Component에서, 클라이언트 fetch는 꼭 필요할 때만
- 이미지는 `next/image`, 링크는 `next/link`

## 7. shadcn/ui 와 스타일

- UI 기본 부품은 직접 만들지 말고 먼저 shadcn에서 찾는다: `pnpm dlx shadcn@latest add <component>`
- `src/components/ui/` 파일은 가능한 한 수정하지 않는다. 변형이 필요하면 감싸는 컴포넌트를 `components/<feature>/`에 만든다
- 조건부 클래스는 `cn()` 사용, 문자열 이어붙이기 금지
- 색은 `globals.css`의 CSS 변수 토큰(`bg-background`, `text-muted-foreground` 등)만 사용. `bg-[#123456]` 같은 하드코딩 금지
- 다크 모드는 토큰으로 처리되므로 `dark:` 를 남발하지 않는다

## 8. 데이터 취급 (Akkadia 프로젝트 공통)

- 운영자 계정(`/su` 사용 계정)은 기본 제외
- 채팅 원문, 지갑 주소(playerId, targetAddress)는 화면과 저장소 어디에도 노출 금지
- 이탈률/리텐션 지표는 사용하지 않는다
