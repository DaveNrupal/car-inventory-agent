import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { planTasks } from "./planner.js";
import { generateFile, writeFile } from "./generator.js";
import { validate } from "./validator.js";
import { fixFile } from "./fixer.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MAX_RETRIES = 3;

function parseArgs(): { specPath: string } {
  const args = process.argv.slice(2);
  const specIndex = args.indexOf("--spec");
  const specPath =
    specIndex !== -1 && args[specIndex + 1]
      ? args[specIndex + 1]
      : "spec.txt";
  return { specPath };
}

function copyBoilerplate(boilerplateDir: string, outputDir: string): void {
  if (fs.existsSync(outputDir)) {
    fs.rmSync(outputDir, { recursive: true });
  }
  fs.mkdirSync(outputDir, { recursive: true });

  const SKIP = new Set(["node_modules", ".git", "agent", "generated-app", "dist"]);

  function copyDir(src: string, dest: string) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      if (SKIP.has(entry.name)) continue;
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        copyDir(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  copyDir(boilerplateDir, outputDir);
  console.log("✓ Boilerplate copied to generated-app/");
}

async function run() {
  const { specPath } = parseArgs();

  // Resolve paths
  const agentDir = path.resolve(__dirname, "..");
  const rootDir = path.resolve(agentDir, "..");
  const specFile = path.resolve(agentDir, specPath);
  const outputDir = path.resolve(rootDir, "generated-app");

  // Read spec
  if (!fs.existsSync(specFile)) {
    console.error(`Spec file not found: ${specFile}`);
    process.exit(1);
  }
  const spec = fs.readFileSync(specFile, "utf-8");
  console.log(`\n=== Car Inventory Agent ===`);
  console.log(`Spec: ${specFile}`);
  console.log(`Output: ${outputDir}\n`);

  // Step 1: Copy boilerplate
  console.log("[ 1/4 ] Copying boilerplate...");
  copyBoilerplate(rootDir, outputDir);

  // Step 2: Plan
  console.log("\n[ 2/4 ] Planning tasks...");
  const tasks = await planTasks(spec);
  console.log(`  → ${tasks.length} tasks planned:`);
  tasks.forEach((t) => console.log(`    ${t.id}. ${t.file}`));

  // Step 3: Generate files
  console.log("\n[ 3/4 ] Generating files...");
  for (const task of tasks) {
    console.log(`\n  Generating: ${task.file}`);
    const content = await generateFile(task, tasks, spec, outputDir);
    writeFile(outputDir, task.file, content);
    // Small delay between files to avoid rate limiting
    await new Promise((res) => setTimeout(res, 2000));
  }

  // Step 4: Validate + fix loop
  console.log("\n[ 4/4 ] Validating...");

  // Install deps in generated-app first
  const { execSync } = await import("child_process");
  execSync("npm install", { cwd: outputDir, stdio: "inherit" });

  let attempt = 0;
  let result = validate(outputDir);

  while (!result.success && attempt < MAX_RETRIES) {
    attempt++;
    console.log(`\n  ✗ Validation failed (attempt ${attempt}/${MAX_RETRIES})`);
    console.log(`  Errors:\n${result.errors.slice(0, 1500)}`);
    console.log(`\n  Attempting fix...`);

    // Parse which files have errors and fix them
    const errorLines = result.errors;
    const fixedFiles = new Set<string>();

    for (const task of tasks) {
      const fileName = path.basename(task.file);
      if (errorLines.includes(fileName) && !fixedFiles.has(task.file)) {
        console.log(`  Fixing: ${task.file}`);
        const fixed = await fixFile(outputDir, task.file, errorLines);
        writeFile(outputDir, task.file, fixed);
        fixedFiles.add(task.file);
      }
    }

    result = validate(outputDir);
  }

  if (result.success) {
    console.log("\n✓ All checks passed!");
    console.log("\nRun the generated app:");
    console.log("  cd generated-app && npm run dev");
  } else {
    console.log(`\n✗ Validation failed after ${MAX_RETRIES} retries.`);
    console.log("Check generated-app/ manually for issues.");
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Agent error:", err);
  process.exit(1);
});
