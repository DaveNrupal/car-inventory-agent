# Car Inventory Agent

An agentic CLI tool that reads a natural-language specification and autonomously generates a working React + TypeScript Car Inventory Manager application.

---

## Architecture Overview

```
spec.txt (natural language input)
        │
        ▼
┌─────────────────┐
│   PLANNER       │  LLM call → ordered JSON task list (dependency-aware)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   GENERATOR     │  One LLM call per file → writes to generated-app/
│  (per task)     │  Passes dependency file contents as context
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   VALIDATOR     │  Runs: npm run typecheck && npm run test
└────────┬────────┘
         │ errors?
         ▼
┌─────────────────┐
│   FIXER         │  LLM call with error + file → patched file (3 retries max)
└────────┬────────┘
         │
         ▼
  ✓ generated-app/  (runnable React app)
```

### Key Design Decisions

**1. Task decomposition before generation**
The planner makes a single LLM call to break the spec into an ordered, dependency-aware task list. This ensures hooks are generated before components that use them, and components before App.tsx wires them together.

**2. Dependency-aware context injection**
Each generator call receives only the boilerplate types + the content of files it depends on — not the entire codebase. This keeps token usage low while giving the LLM exactly what it needs.

**3. Separate fixer agent**
Validation errors are fed to a dedicated fixer prompt rather than re-running the full generator. This is faster, cheaper, and more targeted.

**4. Automatic retry with backoff**
All LLM calls use exponential backoff (3 attempts, 15s base delay) to handle transient API errors (503/429) without failing the whole run.

**5. Why Google Gemini (gemini-2.5-flash)?**
- Available via Google AI Studio with billing enabled
- Large context window handles dependency file injection well
- Fast response times suitable for sequential file generation

**Tradeoffs considered:**
- Single agent vs multi-agent → chose single agent with retry loop for simplicity and reliability
- LangChain vs custom loop → chose custom function-calling loop; less abstraction overhead, easier to debug
- Parallel generation vs sequential → chose sequential to respect file dependencies correctly

---

## Project Structure

```
Fullstack-Coding-Challenge-main/
├── agent/                    ← CLI agent (this is what you build)
│   ├── src/
│   │   ├── index.ts          ← Orchestrator / CLI entry point
│   │   ├── planner.ts        ← Spec → ordered task list
│   │   ├── generator.ts      ← Task → generated file content
│   │   ├── validator.ts      ← Runs typecheck + vitest
│   │   ├── fixer.ts          ← Error → fixed file
│   │   └── retry.ts          ← Retry with exponential backoff
│   ├── spec.txt              ← Sample natural-language spec input
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
├── src/                      ← Boilerplate (untouched)
│   ├── graphql/              ← Apollo client + queries
│   ├── mocks/                ← MSW handlers + seed data
│   ├── types.ts              ← Car interface
│   └── main.tsx              ← Entry with Apollo + MUI providers
└── generated-app/            ← Agent output (sample run committed)
```

---

## Setup & Running

### Prerequisites
- Node.js 18+
- A Google AI Studio API key with billing enabled

### 1. Clone and install
```bash
git clone https://github.com/DaveNrupal/car-inventory-agent.git
cd car-inventory-agent
```

### 2. Set up the agent
```bash
cd agent
npm install
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY
```

### 3. Run the agent
```bash
npm run generate
```

The agent will:
1. Copy the boilerplate to `generated-app/`
2. Plan 9 tasks from `spec.txt`
3. Generate all files one by one
4. Run `npm run typecheck && npm run test`
5. Auto-fix any errors (up to 3 retries)

### 4. Run the generated app
```bash
cd ../generated-app
npm install
npm run dev       # → localhost:5173
npm run test      # → all tests pass
npm run typecheck # → no errors
```

---

## Generated App Features

The agent generates a fully functional Car Inventory Manager with:

- **Car list** — fetched via Apollo Client from MSW mock GraphQL API
- **Responsive images** — mobile (≤640px), tablet (641–1023px), desktop (≥1024px)
- **MUI cards** — each showing make, model, year, color, and image
- **Add Car form** — submits via `AddCar` GraphQL mutation
- **Search** — filter cars by model name
- **Sorting** — sort by year or make
- **`useCars()` hook** — all GraphQL logic extracted into a reusable hook
- **Unit tests** — for CarCard, AddCarForm, and SearchBar components

---

## What Worked Well

- Dependency-aware task ordering meant generated files imported correctly on the first try
- Structured prompts with explicit rules ("output ONLY raw TypeScript, no markdown") produced clean files without parsing issues
- The fixer agent successfully patched TypeScript errors without rewriting unrelated code

## What I'd Improve With More Time

- **Parallel generation** for independent files (e.g. SearchBar and AddCarForm have no shared dependency)
- **Prompt caching** to reduce token cost on repeated runs with the same boilerplate context
- **Smarter error parsing** — instead of passing full stderr to the fixer, extract only the relevant error lines per file
- **Multi-model strategy** — use a cheaper model for fixing minor errors, expensive model only for initial generation

---

## Approximate Cost Per Run

| Step | LLM Calls | Approx tokens |
|---|---|---|
| Planner | 1 | ~2,000 |
| Generator (9 files) | 9 | ~45,000 |
| Fixer (if needed) | 1–3 | ~10,000 |
| **Total** | ~13 | ~57,000 |

**Estimated cost: ~$0.01–$0.05 per run** using Gemini 2.5 Flash pricing.

---

## Environment Variables

See `agent/.env.example`:

```
GEMINI_API_KEY=your_gemini_api_key_here
```
