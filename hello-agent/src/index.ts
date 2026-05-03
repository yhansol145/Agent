import "dotenv/config";
import { GoogleGenAI } from "@google/genai";
import { toolDeclarations, executeTool } from "./tools.js";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error(
    "Missing GEMINI_API_KEY. Copy .env.example to .env and fill it in."
  );
  process.exit(1);
}

const userInput = process.argv.slice(2).join(" ").trim();
if (!userInput) {
  console.error('Usage: npx tsx src/index.ts "your question here"');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });
const MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
const MAX_TURNS = 8;

type Part = {
  text?: string;
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { name: string; response: unknown };
};
type Content = { role: "user" | "model"; parts: Part[] };

const contents: Content[] = [
  { role: "user", parts: [{ text: userInput }] },
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
    const result = executeTool(call.name, args);
    console.log(`  → ${JSON.stringify(result)}`);
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
