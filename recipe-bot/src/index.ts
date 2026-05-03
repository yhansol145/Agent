import "dotenv/config";
import * as fs from "node:fs";
import * as path from "node:path";
import { GoogleGenAI } from "@google/genai";
import { toolDeclarations, executeTool } from "./tools.js";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error(
    "Missing GEMINI_API_KEY. Copy .env.example to .env and fill it in."
  );
  process.exit(1);
}

const imagePath = process.argv[2];
const userInput = process.argv.slice(3).join(" ").trim();

if (!imagePath) {
  console.error(
    'Usage: npx tsx src/index.ts <image_path> [user_prompt]\n' +
      'Example: npx tsx src/index.ts ./samples/fridge.jpg "30분 안에 만들 수 있는 거"'
  );
  process.exit(1);
}

if (!fs.existsSync(imagePath)) {
  console.error(`Image not found: ${imagePath}`);
  process.exit(1);
}

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};
const ext = path.extname(imagePath).toLowerCase();
const mimeType = MIME_BY_EXT[ext];
if (!mimeType) {
  console.error(`Unsupported image extension: ${ext}. Use .jpg/.jpeg/.png/.webp`);
  process.exit(1);
}

const imageBase64 = fs.readFileSync(imagePath).toString("base64");

const ai = new GoogleGenAI({ apiKey });
const MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
const MAX_TURNS = 10;

const promptText =
  userInput || "이 사진의 재료로 만들 수 있는 요리를 추천하고 조리법을 알려줘.";

type Part = {
  text?: string;
  inlineData?: { mimeType: string; data: string };
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { name: string; response: unknown };
};
type Content = { role: "user" | "model"; parts: Part[] };

const contents: Content[] = [
  {
    role: "user",
    parts: [
      { inlineData: { mimeType, data: imageBase64 } },
      { text: promptText },
    ],
  },
];

console.log(`> [image: ${path.basename(imagePath)}] + "${promptText}"\n`);

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
