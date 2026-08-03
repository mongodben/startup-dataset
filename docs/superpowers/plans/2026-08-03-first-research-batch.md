# First Research Batch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the dataset tooling with tests and a source-URL checker, then produce the first five researched company records — two that genuinely use MongoDB, three that use something else.

**Architecture:** Validation logic moves out of the yargs command module into a plain library module (`src/dataset.ts`) so it can be unit-tested without spawning a CLI; the command becomes a thin printing/exit-code wrapper. A second command, `check-sources`, reuses the same record-loading path to HEAD-request every citation URL in a record — the cheapest guard against plausible-but-invented sources. Research then runs as one locator agent (over-producing candidates so we pick the split, not the agent), one pilot researcher whose output we review closely, and finally four researchers in parallel.

**Tech Stack:** TypeScript (ESM, Node 22), zod 4 for schema, yargs 17 for CLI, vitest for tests, `tsx` to run TS directly.

## Global Constraints

- TypeScript for all code; `"type": "module"` ESM; run via `tsx`, type-check via `npx tsc --noEmit`.
- `yargs` for every CLI; each command is a `CommandModule` registered in `src/cli.ts`.
- `src/schema.ts` is the single source of truth for the dataset schema, written in zod. Types derive via `z.infer` — never hand-maintained separately.
- Schema objects are strict: an unrecognized key is a validation error, not a silently-ignored one.
- One JSON file per company at `dataset/yc/seed_<company_slug>.json`, a single JSON object, never wrapped in an array.
- **Never fabricate.** Omit a field or array entry rather than guess. A missing field is fine; a wrong field poisons the dataset undetectably. When in doubt use `confidence: "unconfirmed"`.
- Never invent a URL. Every `sources[].url` must be one actually retrieved.
- Exclude or deprioritize companies that *are* databases or Postgres extensions (Supabase, QuestDB, RethinkDB, KeyDB, LanceDB, InfluxData, Citus, Hydra, ParadeDB, Lantern, PeerDB, PipelineDB). Prefer companies that **built a product on top of** a database.
- Research scope may include both `https://yc-oss.github.io/api/tags/open-source.json` (167 companies) and `https://yc-oss.github.io/api/companies/all.json` (all YC companies).

---

## File Structure

| File | Responsibility |
|---|---|
| `src/schema.ts` | Existing. zod schema + inferred types. Amended only if the pilot reveals a gap. |
| `src/dataset.ts` | **New.** Pure-ish library: resolve a file/dir target to JSON files, parse + validate each, collect citation URLs from a record. No printing, no `process.exit`. |
| `src/dataset.test.ts` | **New.** Unit tests for `src/dataset.ts`. |
| `src/schema.test.ts` | **New.** Unit tests asserting schema accepts/rejects the cases that matter. |
| `src/test-support/make-record.ts` | **New.** Factory building a valid record with overrides, so tests don't restate 30 `yc_seed` fields each. |
| `src/commands/validate.ts` | Existing, refactored to a thin wrapper over `src/dataset.ts`. |
| `src/commands/check-sources.ts` | **New.** Thin wrapper: collect URLs from records, request each, print results. |
| `src/cli.ts` | Existing. Register `checkSourcesCommand`. |
| `dataset/yc/seed_<slug>.json` | Output of the research phases, one per company. |

---

## Task 1: Test harness and schema tests

**Files:**
- Modify: `package.json` (add `vitest` dev dependency and `test` script)
- Create: `src/test-support/make-record.ts`
- Create: `src/schema.test.ts`

**Interfaces:**
- Consumes: `startupDatasetSchema`, `StartupDatasetSchema` from `src/schema.ts`.
- Produces: `makeRecord(overrides?: Partial<StartupDatasetSchema>): StartupDatasetSchema` — a valid record, shallow-merged with `overrides`. Later tasks use this for every fixture.

- [ ] **Step 1: Install vitest**

```bash
npm install -D vitest
```

- [ ] **Step 2: Add the test script to `package.json`**

In the `"scripts"` block, add:

```json
"test": "vitest run"
```

- [ ] **Step 3: Write the record factory**

Create `src/test-support/make-record.ts`. Every `yc_seed` field is required by the schema, so they are all listed here once:

```ts
import type { StartupDatasetSchema } from "../schema.ts";

/** A syntactically complete yc_seed, shaped like a real yc-oss API record. */
function makeSeed(): StartupDatasetSchema["yc_seed"] {
  return {
    id: 72,
    company_slug: "example-co",
    company_name: "Example Co",
    former_names: [],
    small_logo_thumb_url: "https://example.com/logo.png",
    website: "https://example.com/",
    all_locations: "San Francisco, CA, USA",
    long_description: "A longer description of what the company does.",
    one_liner: "A one-line description.",
    team_size: 200,
    industry: "B2B",
    subindustry: "B2B -> Infrastructure",
    launched_at: 1326788979,
    tags: ["Developer Tools", "Open Source"],
    tags_highlighted: [],
    top_company: false,
    isHiring: true,
    nonprofit: false,
    batch: "Summer 2011",
    status: "Active",
    industries: ["B2B", "Infrastructure"],
    regions: ["United States of America"],
    stage: "Growth",
    app_video_public: false,
    demo_day_video_public: false,
    app_answers: null,
    question_answers: false,
    url: "https://www.ycombinator.com/companies/example-co",
    api: "https://yc-oss.github.io/api/companies/example-co.json",
    is_open_source: true,
  };
}

/** Builds a valid dataset record. Pass `overrides` to replace top-level fields. */
export function makeRecord(
  overrides: Partial<StartupDatasetSchema> = {},
): StartupDatasetSchema {
  return {
    _id: "seed_example-co",
    yc_seed: makeSeed(),
    scenario: {
      archetype: "devtool",
      description: "A tool that lets client apps query many backend services through one API.",
    },
    prompt_variants: {},
    provenance: {
      created_at: 1754200000000,
      confidence: "inferred",
      researched_by: "agent",
      sources: ["https://example.com/docs"],
    },
    technical_architecture: {
      repository: [
        {
          name: "example-repo",
          url: "https://github.com/example/example-repo",
          description: "The main repo.",
          readme: "Paraphrased summary of the README.",
          license: "MIT",
        },
      ],
      databases: [
        {
          name: "PostgreSQL",
          description: "Primary transactional store.",
          data_shape: "relational",
        },
      ],
    },
    ...overrides,
  };
}
```

- [ ] **Step 4: Write the failing schema tests**

Create `src/schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { startupDatasetSchema } from "./schema.ts";
import { makeRecord } from "./test-support/make-record.ts";

/** Returns the `path: message` strings for a failed parse, for readable assertions. */
function issuesFor(record: unknown): string[] {
  const result = startupDatasetSchema.safeParse(record);
  if (result.success) return [];
  return result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
}

describe("startupDatasetSchema", () => {
  it("accepts a complete record", () => {
    expect(startupDatasetSchema.safeParse(makeRecord()).success).toBe(true);
  });

  it("rejects a record missing a required field", () => {
    const record = makeRecord();
    // @ts-expect-error deliberately removing a required field
    delete record.scenario.description;
    expect(issuesFor(record)).toContainEqual(
      expect.stringContaining("scenario.description"),
    );
  });

  it("rejects an unrecognized key so typo'd field names cannot silently drop data", () => {
    const record = makeRecord();
    // "justfications" is the realistic typo: without strict objects this would
    // pass validation while the researched justifications went nowhere.
    (record.technical_architecture.databases as any)[0].justfications = [
      { reason: "r", evidence: "e", sources: [] },
    ];
    expect(issuesFor(record)).toContainEqual(expect.stringContaining("justfications"));
  });

  it("accepts team_size of null but rejects it being absent", () => {
    expect(
      startupDatasetSchema.safeParse(
        makeRecord({ yc_seed: { ...makeRecord().yc_seed, team_size: null } }),
      ).success,
    ).toBe(true);

    const seed = { ...makeRecord().yc_seed } as Record<string, unknown>;
    delete seed.team_size;
    expect(issuesFor(makeRecord({ yc_seed: seed as never }))).toContainEqual(
      expect.stringContaining("yc_seed.team_size"),
    );
  });

  it("rejects an out-of-range enum value", () => {
    const record = makeRecord({
      provenance: { ...makeRecord().provenance, confidence: "pretty-sure" as never },
    });
    expect(issuesFor(record)).toContainEqual(expect.stringContaining("provenance.confidence"));
  });

  it("rejects a record wrapped in an array", () => {
    expect(startupDatasetSchema.safeParse([makeRecord()]).success).toBe(false);
  });
});
```

- [ ] **Step 5: Run the tests**

Run: `npm test`
Expected: all 6 tests in `src/schema.test.ts` PASS. The schema is already implemented, so these tests are characterization tests — they lock in current behavior so the schema amendments in Task 5 Step 3 cannot silently regress it.

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no output. The tests import `describe`/`expect`/`it` from `"vitest"` explicitly, so no globals config is needed.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/schema.test.ts src/test-support/make-record.ts
git commit -m "test: lock in schema behavior with vitest"
```

---

## Task 2: Extract validation into a testable library module

**Files:**
- Create: `src/dataset.ts`
- Create: `src/dataset.test.ts`
- Modify: `src/commands/validate.ts` (replace body with a thin wrapper)

**Interfaces:**
- Consumes: `startupDatasetSchema` from `src/schema.ts`; `makeRecord` from `src/test-support/make-record.ts`.
- Produces:
  - `interface FileResult { file: string; ok: boolean; problems: string[] }`
  - `resolveFiles(target: string): Promise<string[]>` — a single file returns `[target]`; a directory returns its `*.json` children, sorted.
  - `validateFile(file: string): Promise<FileResult>`
  - `validateTarget(target: string): Promise<FileResult[]>` — resolve then validate all, preserving file order.
  - `formatIssuePath(path: readonly PropertyKey[]): string`
  - `collectSourceUrls(record: unknown): string[]` — used by Task 3.

- [ ] **Step 1: Write the failing tests**

Create `src/dataset.test.ts`:

```ts
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { collectSourceUrls, formatIssuePath, validateTarget } from "./dataset.ts";
import { makeRecord } from "./test-support/make-record.ts";

let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "dataset-test-"));
  await writeFile(path.join(dir, "a-valid.json"), JSON.stringify(makeRecord()));
  await writeFile(path.join(dir, "b-malformed.json"), "{ not json");
  const bad = makeRecord();
  (bad.technical_architecture.databases as any)[0].name = 42;
  await writeFile(path.join(dir, "c-invalid.json"), JSON.stringify(bad));
  await writeFile(path.join(dir, "ignored.txt"), "not json at all");
});

describe("formatIssuePath", () => {
  it("renders nested array paths readably", () => {
    expect(formatIssuePath(["technical_architecture", "databases", 0, "name"])).toBe(
      "technical_architecture.databases[0].name",
    );
  });

  it("labels the root path", () => {
    expect(formatIssuePath([])).toBe("(root)");
  });
});

describe("validateTarget", () => {
  it("validates a single file", async () => {
    const results = await validateTarget(path.join(dir, "a-valid.json"));
    expect(results).toHaveLength(1);
    expect(results[0]!.ok).toBe(true);
  });

  it("validates only .json files in a directory, in sorted order", async () => {
    const results = await validateTarget(dir);
    expect(results.map((r) => path.basename(r.file))).toEqual([
      "a-valid.json",
      "b-malformed.json",
      "c-invalid.json",
    ]);
  });

  it("reports malformed JSON as a problem rather than throwing", async () => {
    const results = await validateTarget(dir);
    const malformed = results.find((r) => r.file.endsWith("b-malformed.json"))!;
    expect(malformed.ok).toBe(false);
    expect(malformed.problems[0]).toContain("invalid JSON");
  });

  it("reports schema problems with a field path", async () => {
    const results = await validateTarget(dir);
    const invalid = results.find((r) => r.file.endsWith("c-invalid.json"))!;
    expect(invalid.ok).toBe(false);
    expect(invalid.problems.join("\n")).toContain("technical_architecture.databases[0].name");
  });

  it("returns an empty list for a directory with no JSON files", async () => {
    const empty = await mkdtemp(path.join(tmpdir(), "dataset-empty-"));
    expect(await validateTarget(empty)).toEqual([]);
  });
});

describe("collectSourceUrls", () => {
  it("gathers citation URLs from every nesting level, deduplicated", () => {
    const record = makeRecord();
    record.provenance.sources = ["https://example.com/a", "https://example.com/a"];
    record.technical_architecture.databases![0]!.justifications = [
      {
        reason: "r",
        evidence: "e",
        sources: [{ type: "blog", url: "https://example.com/b" }],
      },
    ];
    record.technical_architecture.databases![0]!.migration_history = [
      {
        from_database: "MySQL",
        to_database: "PostgreSQL",
        sources: [{ type: "blog", url: "https://example.com/c" }],
      },
    ];

    const urls = collectSourceUrls(record);
    expect(urls).toContain("https://example.com/a");
    expect(urls).toContain("https://example.com/b");
    expect(urls).toContain("https://example.com/c");
    expect(urls).toContain("https://github.com/example/example-repo");
    expect(urls.filter((u) => u === "https://example.com/a")).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/dataset.test.ts`
Expected: FAIL — cannot resolve `./dataset.ts`.

- [ ] **Step 3: Write `src/dataset.ts`**

```ts
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import type { z } from "zod";
import { startupDatasetSchema } from "./schema.ts";

export interface FileResult {
  file: string;
  ok: boolean;
  /** Per-issue lines to print beneath the file; empty when valid. */
  problems: string[];
}

/** Renders a zod issue path as a readable field reference, e.g. `technical_architecture.databases[0].name`. */
export function formatIssuePath(issuePath: readonly PropertyKey[]): string {
  if (issuePath.length === 0) return "(root)";
  return issuePath.reduce<string>((acc, segment) => {
    if (typeof segment === "number") return `${acc}[${segment}]`;
    return acc === "" ? String(segment) : `${acc}.${String(segment)}`;
  }, "");
}

/** Resolves a file-or-directory target to the list of JSON files to act on. */
export async function resolveFiles(target: string): Promise<string[]> {
  const stats = await stat(target);
  if (stats.isFile()) return [target];

  const entries = await readdir(target, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.join(target, entry.name))
    .sort();
}

/** Reads and parses one dataset file. Returns the record, or a problem string. */
async function readRecord(file: string): Promise<{ record: unknown } | { problem: string }> {
  try {
    return { record: JSON.parse(await readFile(file, "utf8")) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { problem: `invalid JSON: ${message}` };
  }
}

/** Validates one file against the schema. Collects problems instead of printing them. */
export async function validateFile(file: string): Promise<FileResult> {
  const read = await readRecord(file);
  if ("problem" in read) return { file, ok: false, problems: [read.problem] };

  const result = startupDatasetSchema.safeParse(read.record);
  if (result.success) return { file, ok: true, problems: [] };

  const problems = (result.error.issues as z.core.$ZodIssue[]).map(
    (issue) => `${formatIssuePath(issue.path)}: ${issue.message}`,
  );
  return { file, ok: false, problems };
}

/** Validates every JSON file under `target`, preserving file order in the results. */
export async function validateTarget(target: string): Promise<FileResult[]> {
  const files = await resolveFiles(target);
  return Promise.all(files.map(validateFile));
}

/**
 * Collects every citation URL in a record, deduplicated. Walks the record
 * structurally rather than at fixed paths so URLs added under new optional
 * fields are still picked up.
 */
export function collectSourceUrls(record: unknown): string[] {
  const urls = new Set<string>();

  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (node === null || typeof node !== "object") return;

    for (const [key, value] of Object.entries(node)) {
      if (key === "url" && typeof value === "string") urls.add(value);
      else if (key === "sources" && Array.isArray(value)) {
        for (const entry of value) {
          if (typeof entry === "string") urls.add(entry);
          else visit(entry);
        }
      } else visit(value);
    }
  };

  visit(record);
  return [...urls];
}

/** Reads a record for URL checking. Returns null if the file cannot be parsed. */
export async function readRecordForUrls(file: string): Promise<unknown | null> {
  const read = await readRecord(file);
  return "problem" in read ? null : read.record;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/dataset.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Replace `src/commands/validate.ts` with a thin wrapper**

```ts
import type { CommandModule } from "yargs";
import { validateTarget } from "../dataset.ts";

const DEFAULT_TARGET = "dataset/yc";

interface ValidateArgs {
  path?: string;
}

export const validateCommand: CommandModule<{}, ValidateArgs> = {
  command: "validate [path]",
  describe: "Validate dataset entries against the schema",
  builder: (yargs) =>
    yargs.positional("path", {
      type: "string",
      describe: `File or directory to validate (defaults to ${DEFAULT_TARGET})`,
      default: DEFAULT_TARGET,
    }),
  handler: async (argv) => {
    const target = argv.path ?? DEFAULT_TARGET;

    let results;
    try {
      results = await validateTarget(target);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Could not read ${target}: ${message}`);
      process.exitCode = 1;
      return;
    }

    if (results.length === 0) {
      console.log(`No JSON files found in ${target}.`);
      return;
    }

    for (const { file, ok, problems } of results) {
      if (ok) {
        console.log(`✓ ${file}`);
        continue;
      }
      console.error(`✗ ${file}`);
      for (const problem of problems) console.error(`    ${problem}`);
    }

    const validCount = results.filter((result) => result.ok).length;
    console.log(`\n${validCount}/${results.length} valid`);
    if (validCount < results.length) process.exitCode = 1;
  },
};
```

- [ ] **Step 6: Verify the CLI still behaves identically**

Run each and confirm the stated result:

```bash
npx tsc --noEmit
npm test
npx tsx src/cli.ts validate; echo "exit=$?"
```

Expected: no type errors; all tests pass; `No JSON files found in dataset/yc.` with `exit=0`.

- [ ] **Step 7: Commit**

```bash
git add src/dataset.ts src/dataset.test.ts src/commands/validate.ts
git commit -m "refactor: extract dataset validation into a testable module"
```

---

## Task 3: `check-sources` command

Catches the highest-risk fabrication mode: a citation URL that looks plausible but was never retrieved.

**Files:**
- Create: `src/commands/check-sources.ts`
- Create: `src/check-sources.test.ts`
- Modify: `src/cli.ts` (register the command)
- Modify: `package.json` (add `check-sources` script)

**Interfaces:**
- Consumes: `resolveFiles`, `readRecordForUrls`, `collectSourceUrls` from `src/dataset.ts`.
- Produces: `checkUrl(url: string, fetchImpl?: typeof fetch): Promise<UrlCheck>` where `interface UrlCheck { url: string; ok: boolean; status: number | string }`; and `checkSourcesCommand`.

- [ ] **Step 1: Write the failing test**

Create `src/check-sources.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { checkUrl } from "./commands/check-sources.ts";

describe("checkUrl", () => {
  it("reports ok for a 200 response", async () => {
    const fakeFetch = (async () => new Response(null, { status: 200 })) as typeof fetch;
    expect(await checkUrl("https://example.com/a", fakeFetch)).toEqual({
      url: "https://example.com/a",
      ok: true,
      status: 200,
    });
  });

  it("retries with GET when HEAD is rejected, since many hosts return 405 for HEAD", async () => {
    const methods: string[] = [];
    const fakeFetch = (async (_url: string, init?: RequestInit) => {
      methods.push(init?.method ?? "GET");
      return new Response(null, { status: methods.length === 1 ? 405 : 200 });
    }) as unknown as typeof fetch;

    const result = await checkUrl("https://example.com/b", fakeFetch);
    expect(methods).toEqual(["HEAD", "GET"]);
    expect(result.ok).toBe(true);
  });

  it("reports not-ok for a 404", async () => {
    const fakeFetch = (async () => new Response(null, { status: 404 })) as typeof fetch;
    const result = await checkUrl("https://example.com/missing", fakeFetch);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
  });

  it("reports a network error as not-ok without throwing", async () => {
    const fakeFetch = (async () => {
      throw new Error("ENOTFOUND");
    }) as typeof fetch;
    const result = await checkUrl("https://nope.invalid", fakeFetch);
    expect(result.ok).toBe(false);
    expect(String(result.status)).toContain("ENOTFOUND");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/check-sources.test.ts`
Expected: FAIL — cannot resolve `./commands/check-sources.ts`.

- [ ] **Step 3: Write `src/commands/check-sources.ts`**

```ts
import type { CommandModule } from "yargs";
import { collectSourceUrls, readRecordForUrls, resolveFiles } from "../dataset.ts";

const DEFAULT_TARGET = "dataset/yc";
const TIMEOUT_MS = 10_000;

export interface UrlCheck {
  url: string;
  ok: boolean;
  status: number | string;
}

interface CheckSourcesArgs {
  path?: string;
}

/** Requests a URL to confirm it exists. HEAD first, falling back to GET since many hosts reject HEAD. */
export async function checkUrl(url: string, fetchImpl: typeof fetch = fetch): Promise<UrlCheck> {
  const attempt = async (method: "HEAD" | "GET"): Promise<Response> =>
    fetchImpl(url, { method, redirect: "follow", signal: AbortSignal.timeout(TIMEOUT_MS) });

  try {
    let response = await attempt("HEAD");
    if (!response.ok) response = await attempt("GET");
    return { url, ok: response.ok, status: response.status };
  } catch (error) {
    return { url, ok: false, status: error instanceof Error ? error.message : String(error) };
  }
}

/** Checks URLs with a small concurrency cap so a record with many citations stays polite. */
async function checkAll(urls: string[]): Promise<UrlCheck[]> {
  const results: UrlCheck[] = [];
  const queue = [...urls];
  const workers = Array.from({ length: Math.min(5, queue.length) }, async () => {
    while (queue.length > 0) {
      const url = queue.shift();
      if (url === undefined) return;
      results.push(await checkUrl(url));
    }
  });
  await Promise.all(workers);
  return results;
}

export const checkSourcesCommand: CommandModule<{}, CheckSourcesArgs> = {
  command: "check-sources [path]",
  describe: "Request every citation URL in dataset entries to confirm it resolves",
  builder: (yargs) =>
    yargs.positional("path", {
      type: "string",
      describe: `File or directory to check (defaults to ${DEFAULT_TARGET})`,
      default: DEFAULT_TARGET,
    }),
  handler: async (argv) => {
    const target = argv.path ?? DEFAULT_TARGET;

    let files: string[];
    try {
      files = await resolveFiles(target);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Could not read ${target}: ${message}`);
      process.exitCode = 1;
      return;
    }

    let deadTotal = 0;
    for (const file of files) {
      const record = await readRecordForUrls(file);
      if (record === null) {
        console.error(`✗ ${file}: invalid JSON, skipped`);
        process.exitCode = 1;
        continue;
      }

      const urls = collectSourceUrls(record);
      const checks = await checkAll(urls);
      const dead = checks.filter((check) => !check.ok);
      deadTotal += dead.length;

      console.log(`${dead.length === 0 ? "✓" : "✗"} ${file} — ${urls.length} URLs, ${dead.length} unreachable`);
      for (const check of dead) console.error(`    ${check.status}  ${check.url}`);
    }

    if (deadTotal > 0) process.exitCode = 1;
  },
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/check-sources.test.ts`
Expected: all 4 tests PASS.

- [ ] **Step 5: Register the command in `src/cli.ts`**

Add the import and the `.command()` call:

```ts
import { hideBin } from "yargs/helpers";
import yargs from "yargs";
import { checkSourcesCommand } from "./commands/check-sources.ts";
import { validateCommand } from "./commands/validate.ts";

await yargs(hideBin(process.argv))
  .command(validateCommand)
  .command(checkSourcesCommand)
  .demandCommand(1)
  .strict()
  .help()
  .parse();
```

- [ ] **Step 6: Add the npm script**

In `package.json` `"scripts"`, add:

```json
"check-sources": "tsx src/cli.ts check-sources"
```

- [ ] **Step 7: Verify the command is wired up**

```bash
npx tsc --noEmit
npm test
npx tsx src/cli.ts --help
```

Expected: no type errors; all tests pass; help lists both `validate` and `check-sources`. There is nothing in `dataset/yc` yet, so the first real end-to-end run against live URLs happens in Task 5 Step 1.

- [ ] **Step 8: Commit**

```bash
git add src/commands/check-sources.ts src/check-sources.test.ts src/cli.ts package.json
git commit -m "feat: add check-sources command to verify citation URLs resolve"
```

---

## Task 4: Locate candidates

Dispatch **one** `startup-locator` agent. It over-produces candidates so a human picks the MongoDB/non-MongoDB split — asking an agent to "find exactly 2 MongoDB companies" pressures it to stretch weak evidence to fill the quota.

**Files:** none written. The agent returns a report.

- [ ] **Step 1: Dispatch the locator**

Use the Agent tool with `subagent_type: "startup-locator"` and this prompt verbatim:

```text
Find candidate YC companies for the startup tech-stack dataset. Return a ranked
shortlist of 10-12 candidates — do NOT narrow to a final set, and do NOT try to
hit a quota for any particular database. A human picks the final five from your
evidence.

Context you need:
- I already checked all 167 companies in the Open Source tag feed: ZERO mention
  MongoDB anywhere in their YC metadata. Postgres appears 8 times, ClickHouse 2,
  SQLite 1. So MongoDB usage will not be found by filtering metadata — it needs
  real research.
- Search both https://yc-oss.github.io/api/tags/open-source.json (167 companies)
  and https://yc-oss.github.io/api/companies/all.json (all YC companies).
- The highest-signal cheap evidence for an open-source company is its dependency
  manifests: `mongoose` or `mongodb` in a package.json, `pymongo` in a
  requirements.txt or pyproject.toml, a `MONGODB_URI` in a .env.example or
  docker-compose.yml. That beats a blog post, because it is the running code.
  Use GitHub search and fetch raw manifest files directly.
- EXCLUDE companies that are themselves databases or Postgres extensions:
  Supabase, QuestDB, RethinkDB, KeyDB, LanceDB, InfluxData, Citus, Hydra,
  ParadeDB, Lantern, PeerDB, PipelineDB, HelixDB. Their "database choice" is
  circular, and the dataset needs companies that BUILT A PRODUCT ON TOP OF a
  database.
- Skip any company already present in dataset/yc/ (check that directory first).

For each candidate report:
- company_name and company_slug exactly as they appear in the YC API
- its per-company API URL (the `api` field in its record)
- which database(s) you have evidence it uses, and what that evidence is
  (paste the manifest line or the source URL you actually retrieved)
- confidence that it uses that database: high / medium / low
- whether you found any sign of a documented database MIGRATION (highest-value
  evidence for this dataset) — quote the source if so
- rough volume of public technical writing: docs site, engineering blog,
  conference talks

Aim for database diversity across the list: MongoDB where you can genuinely
evidence it, plus MySQL, SQLite, and hybrid/multi-database cases, not just
Postgres. If you cannot find any credible MongoDB user, say so plainly rather
than promoting a weak candidate — that is a useful finding, not a failure.

Never invent a URL or a manifest line. If evidence is thin, mark it low
confidence and explain what is missing.
```

- [ ] **Step 2: Review the report and choose five**

Read the evidence per candidate and pick five: up to 2 with high-confidence MongoDB evidence, and 3 others spread across different databases. Prefer any candidate with a documented migration.

Record the chosen five here before continuing, so later tasks are unambiguous:

| # | company_name | company_slug | api URL | expected DB |
|---|---|---|---|---|
| 1 | Infisical | infisical | https://yc-oss.github.io/api/batches/winter-2023/infisical.json | MongoDB → PostgreSQL (documented migration) |
| 2 | Convoy | convoy-2 | https://yc-oss.github.io/api/batches/winter-2022/convoy-2.json | MongoDB → PostgreSQL (documented migration) |
| 3 | Payload | payload | https://yc-oss.github.io/api/batches/summer-2022/payload.json | MongoDB (current, via mongoose) + Postgres adapter |
| 4 | PostHog | posthog | https://yc-oss.github.io/api/batches/winter-2020/posthog.json | PostgreSQL + ClickHouse hybrid |
| 5 | Mattermost | mattermost | https://yc-oss.github.io/api/batches/summer-2012/mattermost.json | MySQL + PostgreSQL, official migration tooling |

**Locator finding, recorded for context:** zero of the 167 open-source-tagged YC
companies currently run primarily on MongoDB with strong public engineering
writing about it. Rather than force a weak "current MongoDB user" candidate,
the batch leans on the two best-evidenced MongoDB migration stories (Infisical,
Convoy) plus Payload as the one company with a currently-shipping, actively
maintained MongoDB adapter. GitLab had excellent MySQL→Postgres migration
evidence but was excluded — too large/public a company to fit the dataset's
startup-scenario framing.

- [ ] **Step 3: If no credible MongoDB candidate exists, decide explicitly**

Do not silently proceed with five non-MongoDB companies. Either broaden the search (a second locator run scoped to non-open-source YC companies, accepting weaker code evidence), or consciously accept a batch with no MongoDB case and note that in the commit message.

---

## Task 5: Pilot — research ONE company

The first real record is what reveals schema gaps and prompt problems. Fixing them here costs one unit of work instead of five.

**Files:**
- Create: `dataset/yc/seed_<slug>.json` for company #1 from the Task 4 table.

- [ ] **Step 1: Dispatch a single `startup-deep-researcher`**

Use the Agent tool with `subagent_type: "startup-deep-researcher"`, substituting the real values from the Task 4 table:

```text
Research <COMPANY_NAME> (slug: <COMPANY_SLUG>) and produce its dataset entry.

Its YC API record is at <API_URL> — fetch that single record rather than the
full company list.

Follow prompts/research_yc_companies.md as the canonical process, scoped to this
one company, and conform to startupDatasetSchema in src/schema.ts. Read both
files before you start.

Prior evidence from candidate screening (verify it yourself, do not take it as
established): <PASTE THE LOCATOR'S EVIDENCE FOR THIS COMPANY>

Write the record to dataset/yc/seed_<COMPANY_SLUG>.json as a single JSON object,
then verify it:
  npm run validate -- dataset/yc/seed_<COMPANY_SLUG>.json
  npm run check-sources -- dataset/yc/seed_<COMPANY_SLUG>.json
Both must pass. check-sources requests every URL you cited — if one is
unreachable, remove the claim it supports rather than swapping in a different
URL that you have not read.

Report back: the confidence level you assigned and why, which fields you had to
omit for lack of evidence, any field where the schema did not fit what you
found, and confirmation that both commands passed.
```

- [ ] **Step 2: Review the pilot record yourself**

Read the produced JSON and check specifically:
- Does `scenario.description` leak the company name, brand terms, or product names? Read it cold and ask whether you could guess the company.
- Is `readme` a paraphrase, or pasted verbatim from the repo?
- Is `provenance.confidence` honest given the evidence actually cited?
- Are there `justifications` whose `sources` merely mention the database rather than explaining the choice?
- Spot-check two cited URLs by opening them and confirming they say what `evidence` claims.

- [ ] **Step 3: Fix tooling problems the pilot revealed**

If the researcher reported a field that did not fit, amend `src/schema.ts`, add a test to `src/schema.test.ts` covering the new shape, and re-run `npm test`. If its instructions were ambiguous, edit `.claude/agents/startup-deep-researcher.md` or `prompts/research_yc_companies.md` now — before four more agents inherit the same ambiguity.

- [ ] **Step 4: Commit the pilot**

```bash
npm test && npx tsx src/cli.ts validate
git add dataset/yc src/schema.ts src/schema.test.ts prompts .claude
git commit -m "data: add <COMPANY_NAME> record (pilot)"
```

---

## Task 6: Research the remaining four in parallel

**Files:**
- Create: `dataset/yc/seed_<slug>.json` for companies #2–#5.

These are genuinely independent: one output file each, no shared state, and `validate`/`check-sources` only read. So they parallelize cleanly.

- [ ] **Step 1: Dispatch all four in a single message**

Issue **four** Agent calls with `subagent_type: "startup-deep-researcher"` in one response — multiple calls in one message run concurrently; one per message runs sequentially. Use the same prompt template as Task 5 Step 1, with each company's own name, slug, API URL, and locator evidence substituted, plus this line appended:

```text
Only write dataset/yc/seed_<COMPANY_SLUG>.json. Other agents are concurrently
writing other files in that directory — do not create, edit, or delete any file
other than your own, and do not modify src/, prompts/, or package.json.
```

- [ ] **Step 2: Read all four reports**

Note each agent's confidence rating and omitted fields.

---

## Task 7: Integrate and verify the batch

- [ ] **Step 1: Validate and check every record**

```bash
npm test
npx tsx src/cli.ts validate
npx tsx src/cli.ts check-sources
```

Expected: tests pass; `5/5 valid`; zero unreachable URLs. Fix any failure before continuing.

- [ ] **Step 2: Spot-check for systematic errors across agents**

Agents given the same prompt tend to make the *same* mistake, so per-record review is not enough. Compare all five records against each other:

```bash
npx tsx -e "
import { readdir, readFile } from 'node:fs/promises';
const files = (await readdir('dataset/yc')).filter(f => f.endsWith('.json'));
for (const f of files) {
  const r = JSON.parse(await readFile('dataset/yc/' + f, 'utf8'));
  const dbs = r.technical_architecture.databases ?? [];
  console.log([
    r._id,
    'conf=' + r.provenance.confidence,
    'dbs=' + dbs.map(d => d.name).join('/'),
    'justif=' + dbs.reduce((n, d) => n + (d.justifications?.length ?? 0), 0),
    'migrations=' + dbs.reduce((n, d) => n + (d.migration_history?.length ?? 0), 0),
  ].join('  '));
}
"
```

Look for: every record rated `verified` (suspiciously uniform), every record having exactly one justification (template-following rather than research), identical phrasing across records, or all five reporting zero migrations despite the locator flagging some.

- [ ] **Step 3: Confirm database diversity actually landed**

Check the `dbs=` column above spans more than one database and matches what Task 4 selected for. If four of five came back Postgres despite the locator's evidence, the research drifted — investigate before committing.

- [ ] **Step 4: Commit each record separately**

One commit per company keeps diffs reviewable:

```bash
git add dataset/yc/seed_<slug>.json
git commit -m "data: add <COMPANY_NAME> record"
```

- [ ] **Step 5: Push**

```bash
git push
```

---

## Self-Review Notes

- **Requirement coverage:** tests (Task 1–3), source verification (Task 3), 5 candidates with a MongoDB/non-MongoDB split (Task 4), pilot-before-parallel (Task 5 → 6), parallel dispatch (Task 6), integration (Task 7). All three decisions from planning are reflected: expanded search scope plus GitHub dependency search (Task 4 Step 1), pilot first (Task 5), database vendors excluded (Global Constraints and Task 4 Step 1).
- **Known open item, deliberately left to execution:** the Task 4 Step 2 table is filled in during execution, not now — the candidates do not exist yet. Task 4 Step 3 handles the case where no credible MongoDB candidate is found, so it cannot be silently skipped.
- **Interface consistency:** `FileResult`, `validateTarget`, `collectSourceUrls`, `readRecordForUrls`, and `resolveFiles` are defined in Task 2 and consumed under the same names in Tasks 2–3. `makeRecord` is defined in Task 1 and used in Tasks 1–2. `checkUrl`/`UrlCheck` are defined and consumed in Task 3.
