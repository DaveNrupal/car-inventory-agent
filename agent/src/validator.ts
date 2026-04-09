import { execSync } from "child_process";

export interface ValidationResult {
  success: boolean;
  errors: string;
}

export function validate(outputDir: string): ValidationResult {
  try {
    const result = execSync("npm run typecheck 2>&1 && npm run test 2>&1", {
      cwd: outputDir,
      encoding: "utf-8",
      timeout: 60000,
    });
    return { success: true, errors: "" };
  } catch (err: any) {
    const errors = err.stdout ?? err.message ?? String(err);
    return { success: false, errors };
  }
}
