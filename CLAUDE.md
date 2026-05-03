# Agent — 에이전트 학습 레포

레벨별로 차근차근 만들어보면서 LLM agent가 어떻게 동작하는지 손으로 익히는 학습용 레포. 사용자(한국어 사용자, 학습자)가 직접 작성하는 코드라 **간결하고 읽기 쉬운 게 최우선**.

## 스택

- TypeScript + Node.js (ESM, `"type": "module"`)
- Google Gemini API (`@google/genai` 패키지)
- 실행: `tsx` (빌드 단계 없음)
- **프레임워크 없음** — LangChain 등 일부러 안 씀. tool-use 루프를 직접 짜는 게 학습 목적.

## 폴더 구조 — 레벨별 독립 프로젝트

```
Agent/
├── hello-agent/        # 텍스트 + 범용 도구 (학습 시작점)
├── recipe-bot/         # Vision + 도메인 도구
├── gmail-organizer/    # Gmail 정리 (예정 — OAuth 필요)
└── ...
```

각 태스크 폴더는 자체 `package.json` / `node_modules` / `.env`를 가진 **독립 프로젝트**. 의존성 섞이지 않게 함. 새 태스크 추가 시 옆에 폴더 하나 더 만들고 동일 패턴 따름. 폴더 이름은 **태스크를 한눈에 알 수 있는 이름**(kebab-case).

### 각 태스크 폴더 표준 파일

```
<task-name>/
├── package.json          # @google/genai, dotenv + 개발: tsx, typescript, @types/node
├── tsconfig.json         # ES2022 / ESNext / bundler / strict
├── .env.example          # GEMINI_API_KEY=
├── README.md             # 실행법 + 학습 포인트 + 미니 과제
└── src/
    ├── index.ts          # agent loop (CLI 입력 → 루프 → 출력)
    └── tools.ts          # 도구 스키마 + executor + executeTool 디스패처
```

## Agent loop 컨벤션

`src/index.ts`의 핵심 패턴 (모든 레벨 동일):

```ts
const contents: Content[] = [{ role: "user", parts: [...] }];

for (let turn = 1; turn <= MAX_TURNS; turn++) {
  const response = await ai.models.generateContent({ model, contents, config: { tools } });
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  contents.push({ role: "model", parts });

  const functionCalls = parts.filter(p => p.functionCall).map(p => p.functionCall!);
  if (functionCalls.length === 0) {
    // 텍스트 답 출력하고 break
    break;
  }

  const toolResponses = functionCalls.map(call => ({
    functionResponse: { name: call.name, response: executeTool(call.name, call.args) }
  }));
  contents.push({ role: "user", parts: toolResponses });
}
```

매 도구 호출마다 콘솔에 `[tool] name(args) → result` 형식으로 로그 — **루프가 도는 걸 사용자가 눈으로 보는 게 학습 포인트**.

## 도구 스키마 컨벤션 (`tools.ts`)

```ts
export const toolDeclarations = [
  {
    name: "tool_name",
    description: "...",
    parameters: {
      type: "OBJECT",   // 대문자 문자열 — SDK enum 의존성 회피
      properties: { ... },
      required: [...],
    },
  },
];

export function executeTool(name: string, args: Record<string, unknown>): unknown {
  switch (name) {
    case "tool_name": return ...;
    default: return { error: `Unknown tool: ${name}` };
  }
}
```

## 실행 패턴

```bash
cd <task-name>
npm install                  # 첫 회만
cp .env.example .env         # 또는 cp ../hello-agent/.env .env
npx tsx src/index.ts <args>
```

API 키는 `https://aistudio.google.com/apikey` 에서 발급 (무료 티어 있음). 모든 레벨이 같은 `GEMINI_API_KEY` 재사용 가능.

## 진행 상황

- ✅ **hello-agent** — `get_weather` / `calculator` / `read_file`
- ✅ **recipe-bot** — Vision 입력 + `search_recipes` / `filter_recipes` / `get_recipe_details`, `data/recipes.json` DB
- ⏳ **gmail-organizer** — Gmail 정리 (예정 — OAuth 세팅이 메인 허들)

## 작업 시 가이드

- 사용자는 한국어 사용자 — 답변/주석/README는 한국어로 (코드/CLI는 영어).
- 기존 태스크의 패턴을 그대로 재사용. 새 태스크라고 구조 새로 만들지 말 것.
- 도구는 의도적으로 작게 쪼개기 — LLM이 여러 번 호출하게 만들어야 학습 효과.
- 외부 API 의존은 최소화 (학습용이라 키 발급 보스전을 피함). 단, gmail-organizer는 어쩔 수 없이 OAuth 필요.
