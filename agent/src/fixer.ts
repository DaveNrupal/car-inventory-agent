import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function fixFile(
  outputDir: string,
  filePath: string,
  errors: string
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const fullPath = path.join(outputDir, filePath);
  const currentContent = fs.existsSync(fullPath)
    ? fs.readFileSync(fullPath, "utf-8")
    : "";

  const prompt = `You are a senior TypeScript engineer fixing a compilation or test error.

Rules:
- Output ONLY the corrected file content — no markdown, no code fences, no explanation
- Fix only what the errors describe — do not rewrite unrelated code
- Preserve all existing imports and logic that is not causing errors

File: ${filePath}

Current content:
${currentContent}

Errors:
${errors}

Output the fixed file content only (no markdown, no code fences):`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  return text.replace(/```tsx?\n?/g, "").replace(/```\n?/g, "").trim();
}
