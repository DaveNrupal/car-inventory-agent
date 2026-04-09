import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";

const client = new Anthropic();

export async function fixFile(
  outputDir: string,
  filePath: string,
  errors: string
): Promise<string> {
  const fullPath = path.join(outputDir, filePath);
  const currentContent = fs.existsSync(fullPath)
    ? fs.readFileSync(fullPath, "utf-8")
    : "";

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `You are a senior TypeScript engineer fixing a compilation or test error.

Rules:
- Output ONLY the corrected file content — no markdown, no code fences, no explanation
- Fix only what the errors describe — do not rewrite unrelated code
- Preserve all existing imports and logic that is not causing errors

File: ${filePath}

Current content:
${currentContent}

Errors:
${errors}

Output the fixed file content only:`,
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  return text.replace(/```tsx?\n?/g, "").replace(/```\n?/g, "").trim();
}
