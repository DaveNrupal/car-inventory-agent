import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";
import { Task } from "./planner.js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const BOILERPLATE_CONTEXT = `
// src/types.ts
export interface Car {
  id: string;
  make: string;
  model: string;
  year: number;
  color: string;
  mobile: string;
  tablet: string;
  desktop: string;
}

// src/graphql/queries.ts
import { gql } from "@apollo/client";
export const GET_CARS = gql\`query GetCars { cars { id make model year color mobile tablet desktop } }\`;
export const GET_CAR = gql\`query GetCar($id: ID!) { car(id: $id) { id make model year color mobile tablet desktop } }\`;
export const ADD_CAR = gql\`mutation AddCar($make: String!, $model: String!, $year: Int!, $color: String!) { addCar(make: $make, model: $model, year: $year, color: $color) { id make model year color mobile tablet desktop } }\`;
`;

function readGeneratedFile(outputDir: string, filePath: string): string | null {
  const fullPath = path.join(outputDir, filePath);
  if (fs.existsSync(fullPath)) {
    return fs.readFileSync(fullPath, "utf-8");
  }
  return null;
}

function buildDependencyContext(
  task: Task,
  allTasks: Task[],
  outputDir: string
): string {
  const parts: string[] = [BOILERPLATE_CONTEXT];

  for (const depId of task.dependsOn) {
    const depTask = allTasks.find((t) => t.id === depId);
    if (!depTask) continue;
    const content = readGeneratedFile(outputDir, depTask.file);
    if (content) {
      parts.push(`// ${depTask.file}\n${content}`);
    }
  }

  return parts.join("\n\n");
}

export async function generateFile(
  task: Task,
  allTasks: Task[],
  spec: string,
  outputDir: string
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
  const depContext = buildDependencyContext(task, allTasks, outputDir);

  const prompt = `You are a senior React + TypeScript engineer. Generate the file described below.

Rules:
- Output ONLY the raw TypeScript/TSX file content — no markdown, no code fences, no explanation
- Use React 19, TypeScript strict mode, Apollo Client, Material UI (MUI), and the boilerplate types shown
- For responsive images: use window.innerWidth <=640 for mobile, 641-1023 for tablet, >=1024 for desktop
- All GraphQL logic must go through the useCars hook (not directly in components)
- Tests must use @testing-library/react with MSW server (already configured in test-setup.ts)
- Import paths must use relative paths (e.g. ../hooks/useCars)

App spec:
${spec}

Existing boilerplate and dependency files:
${depContext}

File to generate:
Path: ${task.file}
Purpose: ${task.description}

Output the file content only (no markdown, no code fences):`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  // Strip markdown fences if present
  return text.replace(/```tsx?\n?/g, "").replace(/```\n?/g, "").trim();
}

export function writeFile(
  outputDir: string,
  filePath: string,
  content: string
): void {
  const fullPath = path.join(outputDir, filePath);
  const dir = path.dirname(fullPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(fullPath, content, "utf-8");
  console.log(`  ✓ Written: ${filePath}`);
}
