import "dotenv/config";
import { GoogleGenAI } from "@google/genai";
import { toolDeclarations, executeTool } from "./tools.js";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error(
    "Missing GEMINI_API_KEY. .env 파일을 만들어 채우세요. (.env.example 참고)"
  );
  process.exit(1);
}

const userInput = process.argv.slice(2).join(" ").trim();
if (!userInput) {
  console.error(
    'Usage: npx tsx src/index.ts "정리해달라는 요청"\n' +
      'Example: npx tsx src/index.ts "오늘 안 읽은 메일 요약해줘"'
  );
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });
const MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
const MAX_TURNS = 10;

type Part = {
  text?: string;
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { name: string; response: unknown };
};
type Content = { role: "user" | "model"; parts: Part[] };

const SYSTEM_PROMPT =
  "너는 사용자의 Gmail 받은편지함을 정리해주는 에이전트야. " +
  "필요하면 list_messages로 메일을 검색하고, get_message로 흥미로워 보이는 메일의 본문을 읽어. " +
  "메일이 너무 많으면 모두 다 get_message 하지 말고, 제목/발신자/snippet만 보고 카테고리를 분류해도 돼. " +
  "최종 답변은 한국어로, 카테고리별(예: 업무 / 결제·청구 / 뉴스레터 / 광고 / 기타)로 묶어서 발신자와 한 줄 핵심을 간결하게 정리해서 줘.";

const contents: Content[] = [
  {
    role: "user",
    parts: [{ text: `${SYSTEM_PROMPT}\n\n사용자 요청: ${userInput}` }],
  },
];

console.log(`> ${userInput}\n`);

for (let turn = 1; turn <= MAX_TURNS; turn++) {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: contents as any,
    config: {
      tools: [{ functionDeclarations: toolDeclarations as any }],
    },
  });

  const candidate = response.candidates?.[0];
  const parts = (candidate?.content?.parts ?? []) as Part[];

  contents.push({ role: "model", parts });

  const functionCalls = parts
    .filter((p) => p.functionCall)
    .map((p) => p.functionCall!);

  if (functionCalls.length === 0) {
    const text = parts
      .map((p) => p.text)
      .filter((t): t is string => Boolean(t))
      .join("");
    console.log(`\n[answer]\n${text}`);
    break;
  }

  const toolResponses: Part[] = [];
  for (const call of functionCalls) {
    const args = call.args ?? {};
    console.log(`[tool] ${call.name}(${JSON.stringify(args)})`);
    const result = await executeTool(call.name, args);
    const preview = JSON.stringify(result);
    console.log(
      `  → ${preview.length > 200 ? preview.slice(0, 200) + "...(truncated log)" : preview}`
    );
    toolResponses.push({
      functionResponse: {
        name: call.name,
        response: result as Record<string, unknown>,
      },
    });
  }

  contents.push({ role: "user", parts: toolResponses });

  if (turn === MAX_TURNS) {
    console.log(`\n[stop] reached max turns (${MAX_TURNS}).`);
  }
}
