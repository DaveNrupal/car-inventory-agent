import { GoogleGenerativeAI } from "@google/generative-ai";

export interface Task {
  id: number;
  file: string;
  description: string;
  dependsOn: number[];
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function planTasks(spec: string): Promise<Task[]> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `You are a senior React architect. Given the following app specification, decompose it into an ordered list of files to generate.

Rules:
- Output ONLY valid JSON — no markdown, no explanation, no code fences
- Order tasks so dependencies come first (hooks before components, components before App)
- Each task must have: id (number), file (relative path from src/), description (what to generate), dependsOn (array of task ids this file imports from)

App spec:
${spec}

Available boilerplate (already exists, do NOT include these):
- src/types.ts (Car interface)
- src/graphql/queries.ts (GET_CARS, GET_CAR, ADD_CAR)
- src/graphql/client.ts (Apollo client)
- src/mocks/ (MSW handlers, data, browser, server)
- src/main.tsx (entry point with Apollo + MUI providers)
- src/test-setup.ts

Generate tasks for ONLY these files (in this order):
1. src/hooks/useCars.ts
2. src/components/CarCard.tsx
3. src/components/SearchBar.tsx
4. src/components/AddCarForm.tsx
5. src/components/CarList.tsx
6. src/App.tsx
7. src/__tests__/CarCard.test.tsx
8. src/__tests__/AddCarForm.test.tsx
9. src/__tests__/SearchBar.test.tsx

Output format (JSON array only, no markdown):
[
  {
    "id": 1,
    "file": "src/hooks/useCars.ts",
    "description": "...",
    "dependsOn": []
  }
]`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  // Strip markdown fences if present
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  const tasks: Task[] = JSON.parse(cleaned);
  return tasks;
}
