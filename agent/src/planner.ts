import Anthropic from "@anthropic-ai/sdk";

export interface Task {
  id: number;
  file: string;
  description: string;
  dependsOn: number[];
}

const client = new Anthropic();

export async function planTasks(spec: string): Promise<Task[]> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `You are a senior React architect. Given the following app specification, decompose it into an ordered list of files to generate.

Rules:
- Output ONLY valid JSON — no markdown, no explanation
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

Output format (JSON array only):
[
  {
    "id": 1,
    "file": "src/hooks/useCars.ts",
    "description": "...",
    "dependsOn": []
  }
]`,
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  // Strip markdown fences if present
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  const tasks: Task[] = JSON.parse(cleaned);
  return tasks;
}
