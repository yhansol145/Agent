import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

type Recipe = {
  id: number;
  name: string;
  cuisine: string;
  timeMinutes: number;
  difficulty: "easy" | "medium" | "hard";
  ingredients: string[];
  instructions: string[];
};

const PROJECT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const RECIPES: Recipe[] = JSON.parse(
  fs.readFileSync(path.join(PROJECT_DIR, "data", "recipes.json"), "utf-8")
);

export const toolDeclarations = [
  {
    name: "search_recipes",
    description:
      "Find recipes that can be made with the given list of ingredients. Returns recipes that share at least 2 ingredients with the input, sorted by match count. Returns recipe summaries only (no full instructions). Ingredient names should be in English (e.g. 'egg', 'tomato', 'onion', 'rice', 'pasta', 'kimchi', 'tofu', 'garlic').",
    parameters: {
      type: "OBJECT",
      properties: {
        ingredients: {
          type: "ARRAY",
          items: { type: "STRING" },
          description: "List of ingredients you have, in English lowercase.",
        },
      },
      required: ["ingredients"],
    },
  },
  {
    name: "filter_recipes",
    description:
      "Narrow down a previous list of recipe IDs by additional criteria like time limit, cuisine, or difficulty. Returns the matching subset.",
    parameters: {
      type: "OBJECT",
      properties: {
        recipeIds: {
          type: "ARRAY",
          items: { type: "NUMBER" },
          description: "Recipe IDs to filter (typically from a previous search_recipes call).",
        },
        maxMinutes: {
          type: "NUMBER",
          description: "Maximum cooking time in minutes (optional).",
        },
        cuisine: {
          type: "STRING",
          description: "Cuisine filter, one of: '한식', '양식', '중식' (optional).",
        },
        difficulty: {
          type: "STRING",
          description: "Difficulty filter: 'easy', 'medium', or 'hard' (optional).",
        },
      },
      required: ["recipeIds"],
    },
  },
  {
    name: "get_recipe_details",
    description:
      "Get the full recipe details including step-by-step cooking instructions. Call this after narrowing down to a final recipe choice.",
    parameters: {
      type: "OBJECT",
      properties: {
        id: {
          type: "NUMBER",
          description: "Recipe ID.",
        },
      },
      required: ["id"],
    },
  },
];

function normalize(s: string): string {
  return s.toLowerCase().trim();
}

function searchRecipes(args: { ingredients: string[] }) {
  const userIngs = (args.ingredients ?? []).map(normalize);
  if (userIngs.length === 0) {
    return { results: [], message: "No ingredients provided." };
  }

  const scored = RECIPES.map((r) => {
    const recipeIngs = r.ingredients.map(normalize);
    const matched = recipeIngs.filter((ri) =>
      userIngs.some((ui) => ri.includes(ui) || ui.includes(ri))
    );
    return {
      recipe: r,
      matchCount: matched.length,
      totalCount: recipeIngs.length,
      matchedIngredients: matched,
      missingCount: recipeIngs.length - matched.length,
    };
  })
    .filter((s) => s.matchCount >= 2)
    .sort(
      (a, b) =>
        b.matchCount - a.matchCount || a.missingCount - b.missingCount
    )
    .slice(0, 8);

  return {
    results: scored.map((s) => ({
      id: s.recipe.id,
      name: s.recipe.name,
      cuisine: s.recipe.cuisine,
      timeMinutes: s.recipe.timeMinutes,
      difficulty: s.recipe.difficulty,
      matchCount: s.matchCount,
      missingCount: s.missingCount,
      allIngredients: s.recipe.ingredients,
    })),
  };
}

function filterRecipes(args: {
  recipeIds: number[];
  maxMinutes?: number;
  cuisine?: string;
  difficulty?: string;
}) {
  const ids = new Set(args.recipeIds ?? []);
  const filtered = RECIPES.filter((r) => ids.has(r.id))
    .filter((r) => args.maxMinutes == null || r.timeMinutes <= args.maxMinutes)
    .filter((r) => args.cuisine == null || r.cuisine === args.cuisine)
    .filter((r) => args.difficulty == null || r.difficulty === args.difficulty)
    .map((r) => ({
      id: r.id,
      name: r.name,
      cuisine: r.cuisine,
      timeMinutes: r.timeMinutes,
      difficulty: r.difficulty,
    }));
  return { results: filtered };
}

function getRecipeDetails(args: { id: number }) {
  const r = RECIPES.find((x) => x.id === args.id);
  if (!r) return { error: `Recipe with id ${args.id} not found.` };
  return r;
}

export function executeTool(name: string, args: Record<string, unknown>): unknown {
  switch (name) {
    case "search_recipes":
      return searchRecipes(args as { ingredients: string[] });
    case "filter_recipes":
      return filterRecipes(
        args as {
          recipeIds: number[];
          maxMinutes?: number;
          cuisine?: string;
          difficulty?: string;
        }
      );
    case "get_recipe_details":
      return getRecipeDetails(args as { id: number });
    default:
      return { error: `Unknown tool: ${name}` };
  }
}
