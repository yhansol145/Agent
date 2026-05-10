# Agent — 에이전트 학습 레포

태스크 단위로 차근차근 만들어보면서 에이전트가 어떻게 동작하는지 감 잡기.

## 진행 상황

- **hello-agent** — tool-use 루프 직접 구현 → [hello-agent/](./hello-agent/)
- **recipe-bot** — Vision 입력 + 도메인 도구 → [recipe-bot/](./recipe-bot/)
- **gmail-organizer** — Gmail 받은편지함 분류/요약 (실제 외부 API + OAuth) → [gmail-organizer/](./gmail-organizer/)
- **(다음)** — 미정

## 스택

- TypeScript (Node.js, ESM)
- Google Gemini API (`@google/genai`)
- 프레임워크 없음 — 루프와 도구 디스패처를 직접 작성

