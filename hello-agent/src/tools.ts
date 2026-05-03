import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

// Tool schemas — what the LLM sees when deciding which tool to call.
// We use plain string literals for `type` so this stays robust across SDK
// minor versions (Gemini's underlying proto accepts "OBJECT", "STRING", etc.).
export const toolDeclarations = [
  {
    name: "get_weather",
    description:
      "Get current mock weather for a city. Returns temperature in Celsius and a brief description. Only a few cities are supported (Seoul, Tokyo, New York, London, Paris).",
    parameters: {
      type: "OBJECT",
      properties: {
        city: {
          type: "STRING",
          description: "Name of the city in English, e.g. 'Seoul' or 'Tokyo'.",
        },
      },
      required: ["city"],
    },
  },
  {
    name: "calculator",
    description:
      "Evaluate a simple arithmetic expression like '2 * (3 + 4)'. Only digits, spaces, parentheses, and + - * / are allowed.",
    parameters: {
      type: "OBJECT",
      properties: {
        expression: {
          type: "STRING",
          description: "Arithmetic expression to evaluate.",
        },
      },
      required: ["expression"],
    },
  },
  {
    name: "read_file",
    description:
      "Read a UTF-8 text file located inside the hello-agent/ project directory. Returns the file content as a string. Useful for inspecting project files like 'package.json' or 'src/tools.ts'.",
    parameters: {
      type: "OBJECT",
      properties: {
        path: {
          type: "STRING",
          description:
            "Path relative to the hello-agent/ project directory, e.g. 'package.json' or 'src/index.ts'.",
        },
      },
      required: ["path"],
    },
  },
];

const MOCK_WEATHER: Record<string, { tempC: number; description: string }> = {
  seoul: { tempC: 18, description: "맑음" },
  tokyo: { tempC: 21, description: "흐림" },
  "new york": { tempC: 14, description: "비" },
  london: { tempC: 12, description: "안개" },
  paris: { tempC: 16, description: "구름 조금" },
};

function getWeather(args: { city: string }) {
  const key = args.city.trim().toLowerCase();
  const w = MOCK_WEATHER[key];
  if (!w) {
    return {
      error: `No mock data for "${args.city}". Try Seoul, Tokyo, New York, London, or Paris.`,
    };
  }
  return {
    city: args.city,
    temperatureCelsius: w.tempC,
    description: w.description,
  };
}

function calculator(args: { expression: string }) {
  const expr = args.expression;
  if (!/^[\d\s+\-*/().]+$/.test(expr)) {
    return { error: "Expression contains disallowed characters." };
  }
  try {
    const result = Function(`"use strict"; return (${expr});`)();
    if (typeof result !== "number" || !Number.isFinite(result)) {
      return { error: "Result is not a finite number." };
    }
    return { expression: expr, result };
  } catch (e) {
    return { error: `Failed to evaluate: ${(e as Error).message}` };
  }
}

const PROJECT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

function readFile(args: { path: string }) {
  const target = path.resolve(PROJECT_DIR, args.path);
  if (!target.startsWith(PROJECT_DIR + path.sep)) {
    return { error: "Path escapes project directory." };
  }
  try {
    const content = fs.readFileSync(target, "utf-8");
    const truncated =
      content.length > 4000 ? content.slice(0, 4000) + "\n...(truncated)" : content;
    return { path: args.path, content: truncated };
  } catch (e) {
    return { error: `Failed to read: ${(e as Error).message}` };
  }
}

export function executeTool(name: string, args: Record<string, unknown>): unknown {
  switch (name) {
    case "get_weather":
      return getWeather(args as { city: string });
    case "calculator":
      return calculator(args as { expression: string });
    case "read_file":
      return readFile(args as { path: string });
    default:
      return { error: `Unknown tool: ${name}` };
  }
}
