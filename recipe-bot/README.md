# recipe-bot (Vision + 도메인 도구)

냉장고 사진을 보고 만들 수 있는 요리를 추천해주는 에이전트. **hello-agent와 동일한 agent loop**에 두 가지만 추가:

1. 입력에 **이미지 part**를 끼움 (multimodal)
2. 도구가 **레시피 도메인 특화** (`search_recipes` / `filter_recipes` / `get_recipe_details`)

루프 자체는 안 바뀜. "hello-agent 패턴이 그대로 더 어려운 문제도 푼다"는 걸 직접 확인하는 게 학습 목적.

## 실행

```bash
cd recipe-bot
npm install                          # 이미 했으면 생략
cp ../hello-agent/.env .env          # hello-agent 키 재사용 (또는 새로 발급)

# 냉장고 사진 한 장 준비 (자기 폰으로 찍거나, 인터넷에서 받기)
cp ~/Downloads/your_fridge.jpg ./samples/fridge.jpg

# 기본
npx tsx src/index.ts ./samples/fridge.jpg

# 조건 추가
npx tsx src/index.ts ./samples/fridge.jpg "30분 안에 만들 수 있는 거"
npx tsx src/index.ts ./samples/fridge.jpg "한식으로 추천해줘"
npx tsx src/index.ts ./samples/fridge.jpg "쉬운 요리로"
```

## 도구 3개

| 도구 | 동작 |
|---|---|
| `search_recipes(ingredients)` | `data/recipes.json`(18개) 훑어서 재료 2개 이상 겹치는 레시피 반환. **요약만** — 조리법은 안 줌. |
| `filter_recipes(ids, maxMinutes?, cuisine?, difficulty?)` | 1차 결과를 조건으로 좁힘. LLM이 사용자의 자연어 조건을 인자로 변환. |
| `get_recipe_details(id)` | 최종 선택된 레시피의 단계별 조리법 반환. |

도구를 의도적으로 **3단계로 쪼갠 이유:** 한 번에 모든 정보가 안 나오니까 LLM이 루프를 여러 번 돌리게 강제됨. 이게 멀티스텝 도구 사용 학습 포인트.

## hello-agent와 다른 점 — 코드 비교

`hello-agent/src/index.ts`와 `recipe-bot/src/index.ts`를 나란히 열어보세요. 실질적으로 바뀐 건 **두 군데**뿐:

```ts
// 1. CLI 인자 파싱 — 이미지 경로 받기
const imagePath = process.argv[2];
const userInput = process.argv.slice(3).join(" ").trim();

// 2. contents 초기값 — 이미지 part 추가
const contents = [{
  role: "user",
  parts: [
    { inlineData: { mimeType, data: imageBase64 } },
    { text: promptText },
  ],
}];
```

루프(`for (let turn = 1; ...)`), function call 처리, 종료 조건은 **완전히 동일**합니다.

## 코드 읽을 때 주목할 포인트

1. **[src/tools.ts](src/tools.ts)의 `searchRecipes`** — LLM이 보내준 ingredient 리스트와 DB 레시피의 재료를 어떻게 매칭하는지. `ri.includes(ui) || ui.includes(ri)` 같은 느슨한 매칭으로 LLM이 "egg" 보내든 "eggs" 보내든 잡힘.
2. **3단계 도구 호출 흐름** — Gemini가 Vision으로 이미지에서 재료 추출 → `search_recipes` → `filter_recipes` (조건이 있을 때만) → `get_recipe_details` → 자연어 답. 콘솔 로그로 이 4단계가 다 보임.
3. **`data/recipes.json`** — 외부 API 의존 없이 학습할 수 있도록 로컬 DB. 도메인 도구의 본질은 "어떤 데이터에 접근하느냐"라는 것.

## 미니 과제 (다음 태스크 가기 전)

DB에 없는 레시피도 찾을 수 있게 만들어보세요:

- **옵션 A:** `recipes.json`에 자기 입맛에 맞는 레시피 5개 더 추가하기 (가장 쉬움)
- **옵션 B:** `web_search(query)` 도구 추가 — Gemini의 [Google Search 그라운딩](https://ai.google.dev/gemini-api/docs/grounding) 사용
- **옵션 C:** 영양정보 도구 추가 — `get_nutrition(recipe_id)` 같은 거 하드코딩으로
