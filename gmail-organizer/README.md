# gmail-organizer (실제 외부 API + OAuth)

내 Gmail 받은편지함을 읽어서 카테고리별로 정리/요약해주는 에이전트.

**hello-agent / recipe-bot과 동일한 agent loop**에 두 가지만 다름:

1. 도구가 **실제 외부 API(Gmail)** 를 호출 — 지금까지는 mock 데이터였음.
2. **OAuth 2.0 인증**이 필요 — 이 태스크 진짜 보스전. 한 번 세팅하면 끝나니까 차근차근.

루프 자체는 안 바뀜. 도구 2개(`list_messages`, `get_message`)만 추가됐고 — recipe-bot처럼 의도적으로 작게 쪼개서 LLM이 **검색 → 본문 읽기 → 분류 요약**의 멀티스텝을 거치게 함.

## OAuth 세팅 (한 번만)

### 1. Google Cloud 프로젝트 + Gmail API 활성화

1. [Google Cloud Console](https://console.cloud.google.com/) → 프로젝트 새로 만들기 (이름 아무거나, 예: `gmail-organizer-learn`)
2. 좌측 메뉴 **APIs & Services → Library** → "Gmail API" 검색 → **Enable**

### 2. OAuth 동의 화면 (Consent screen)

1. **APIs & Services → OAuth consent screen**
2. User Type: **External** 선택 → Create
3. App name / User support email / Developer email만 채우고 나머지는 비워둬도 됨
4. **Scopes** 단계: "Add or Remove Scopes" → `.../auth/gmail.readonly` 추가 → Save
5. **Test users** 단계: 본인 Gmail 주소 추가 (이거 안 하면 인증 시 차단됨)

### 3. OAuth Client ID 발급

1. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
2. Application type: **Desktop app** 선택 (이게 핵심 — loopback redirect 자동 허용)
3. 이름 적당히 → Create
4. 팝업에 뜨는 **Client ID / Client Secret** 복사

### 4. .env 채우기 (1차)

```bash
cd gmail-organizer
npm install                  # 첫 회만
cp .env.example .env
```

`.env` 열어서:
```
GEMINI_API_KEY=<hello-agent의 .env에서 그대로 복사>
GOOGLE_CLIENT_ID=<3번에서 복사>
GOOGLE_CLIENT_SECRET=<3번에서 복사>
GOOGLE_REFRESH_TOKEN=    # 5번에서 채울 거임
```

### 5. Refresh token 발급

```bash
npx tsx src/get-token.ts
```

→ 브라우저 자동으로 열림 → 본인 Google 계정 로그인 → "이 앱은 확인되지 않았습니다" 경고 뜨면 **고급 → 안전하지 않은 페이지로 이동** → 권한 허용

→ 콘솔에 `[refresh_token] xxxxxx` 출력됨 → `.env`의 `GOOGLE_REFRESH_TOKEN=` 뒤에 붙여넣기

> 만약 `refresh_token이 없음` 에러가 나면 [Google 계정 권한](https://myaccount.google.com/permissions)에서 이 앱 권한 해제 후 재실행. (Google이 같은 앱에 두 번째부터는 refresh_token을 안 줌 — `prompt: consent`로 강제했지만 가끔 이래.)

## 실행

```bash
npx tsx src/index.ts "오늘 안 읽은 메일 요약해줘"
npx tsx src/index.ts "최근 3일 동안 결제/청구 관련 메일 정리해줘"
npx tsx src/index.ts "광고/뉴스레터 빼고 중요해 보이는 메일만 알려줘"
npx tsx src/index.ts "Stripe에서 온 메일 다 보여줘"
```

LLM이 알아서 Gmail 검색 쿼리를 만들어서 `list_messages`로 호출하고, 흥미로운 것들은 `get_message`로 본문까지 읽어와 요약함. 콘솔에 매 도구 호출이 찍히니까 루프 도는 게 눈에 보임.

## 도구 2개

| 도구 | 동작 |
|---|---|
| `list_messages(query, maxResults?)` | Gmail 검색 쿼리(`is:unread`, `from:`, `newer_than:1d`, `category:promotions` 등)로 메일 검색. **메타데이터만** — id/from/subject/snippet/date. 본문은 안 줌. |
| `get_message(id)` | 특정 메일의 본문(plain text 추출, 3000자로 truncate)과 헤더 정보 반환. |

**왜 2단계로 쪼갰나:** 한 번에 본문까지 다 받으면 토큰이 폭발함. LLM이 먼저 제목/snippet으로 훑고, 진짜 궁금한 것만 본문 읽도록 강제. 루프가 여러 번 도는 걸 보는 게 학습 포인트.

## 이전 태스크와 다른 점

- **외부 API 호출이 비동기** → `executeTool`이 `async`가 됨. 그래서 `index.ts`에서 `await executeTool(...)`. 이거 외엔 루프 동일.
- **MIME 파싱** ([src/tools.ts](src/tools.ts)의 `extractBody`) — Gmail API는 `payload.parts`가 트리 구조라 재귀로 `text/plain`을 찾고, 없으면 `text/html`을 stripping. 이런 외부 데이터 파싱이 실전 도구의 절반.

## 코드 읽을 때 주목할 포인트

1. **[src/auth.ts](src/auth.ts)** — refresh_token만 있으면 access_token은 SDK가 알아서 갱신. 즉 한 번 발급한 refresh_token은 (Google이 만료시키지 않는 한) 영구 사용 가능.
2. **[src/tools.ts](src/tools.ts)의 `list_messages`** — Gmail의 `q` 파라미터에 자연어 검색 문법을 그대로 넘김. LLM이 사용자의 한국어 요청을 Gmail 검색 쿼리로 번역해야 함 — 이게 LLM이 잘하는 작업.
3. **[src/get-token.ts](src/get-token.ts)** — loopback HTTP 서버 띄워서 OAuth 콜백 받기. 이게 "Desktop app" OAuth client의 표준 패턴.

## 미니 과제

읽기만 가능한 첫 버전. 도전하고 싶으면:

- **옵션 A:** `add_label(messageId, labelName)` 도구 추가 — 분류한 결과를 Gmail에 라벨로 적용. scope를 `gmail.modify`로 늘려야 함 (refresh_token 재발급 필요).
- **옵션 B:** `mark_as_read(messageId)` — 읽음 처리. 같은 scope 필요.
- **옵션 C:** Slack/Discord 연동 — 매일 아침 요약을 메신저로 보내기. (여기까지 가면 진짜 production 에이전트.)
