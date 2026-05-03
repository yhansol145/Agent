# hello-agent

가장 단순한 형태의 에이전트. **LLM이 도구를 호출하고 → 우리가 실행해서 결과를 다시 넣어주는** 루프를 직접 짭니다. 프레임워크 없음.

## 실행

```bash
cd hello-agent
npm install                  # 이미 했으면 생략
cp .env.example .env         # GEMINI_API_KEY 채우기
                             # 키 발급: https://aistudio.google.com/apikey

npx tsx src/index.ts "안녕"
npx tsx src/index.ts "서울 날씨 알려줘"
npx tsx src/index.ts "12 * 34 계산하고, package.json의 name 필드도 알려줘"
```

## 도구 3개

| 도구 | 동작 |
|---|---|
| `get_weather(city)` | 하드코딩된 mock 날씨 (Seoul / Tokyo / New York / London / Paris) |
| `calculator(expression)` | 산술식 평가 (화이트리스트 정규식으로 안전 보장) |
| `read_file(path)` | hello-agent/ 디렉터리 안 파일만 읽기 (path traversal 차단) |

## 코드 읽을 때 주목할 포인트

1. **[src/tools.ts](src/tools.ts) — 스키마 ↔ 실행 함수 매핑.**
   `toolDeclarations`는 LLM이 보는 명세(이름, 설명, 파라미터). `executeTool()`은 LLM이 호출 요청한 도구 이름을 실제 함수에 디스패치하는 곳. 이 둘이 **분리되어 있다**는 게 핵심.

2. **[src/index.ts](src/index.ts)의 `for` 루프 — agent loop의 정체.**
   매 턴: ① Gemini 호출 → ② 응답에 `functionCall`이 있나 본다 → ③ 있으면 실행해서 `functionResponse`로 다시 넣고 다음 턴, 없으면 텍스트 답을 출력하고 종료. 이게 전부.

3. **`contents` 배열 — 에이전트의 "기억".**
   매 턴 `user → model → user(tool response) → model → ...` 식으로 자라난다. 이 배열 자체가 대화 히스토리 = 컨텍스트. 이걸 통째로 매 호출에 다시 보낸다.

4. **루프 종료 조건.**
   `functionCalls.length === 0`일 때만 break. LLM이 "더 이상 도구가 필요 없다"고 판단할 때까지 돌음. `MAX_TURNS`로 무한 루프 방지.

## 미니 과제 (다음 태스크 가기 전)

도구 하나 직접 추가해보세요. 예시:

- `get_current_time()` — 현재 시각을 ISO 문자열로 반환
- `list_files(directory)` — 디렉터리 안 파일 목록 (hello-agent/ 하위로 제한)

추가할 곳 3군데:
1. `tools.ts`의 `toolDeclarations` 배열에 스키마 추가
2. 같은 파일에 실행 함수 작성
3. `executeTool()` switch에 case 추가

추가하고 나서 `npx tsx src/index.ts "지금 몇 시야?"` 같은 거 던져보면 LLM이 새 도구를 알아서 부릅니다.
