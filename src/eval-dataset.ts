import { readFile } from "node:fs/promises";
import { formatIssuePath, resolveFiles } from "./dataset.ts";
import { startupDatasetSchema, type StartupDatasetSchema } from "./schema.ts";
import type { z } from "zod";

/**
 * Maps seed records to the YAML dataset shape consumed by mongodb/ai-benchmarks'
 * coding-agent app-development benchmark. See
 * docs/superpowers/specs/2026-08-04-eval-dataset-export-design.md for the format
 * conventions, which were measured against the upstream dataset rather than assumed.
 */

/** Upstream truncates prompt text at this length when building a case name. */
export const NAME_MAX_CHARS = 80;

/**
 * Every seed describes a real production system, so a uniform difficulty is more honest
 * than synthesizing a gradient from a proxy our schema doesn't actually carry.
 */
const DIFFICULTY = "advanced" as const;

/** Turns the scenario's descriptive prose into an imperative build request. */
const PROMPT_PREFIX = "Build me this app: ";

export interface EvalCaseEntry {
  name: string;
  messages: { role: "user"; content: string }[];
  tags: string[];
  metadata: {
    difficulty: typeof DIFFICULTY;
    category: string;
    archetype: string;
    seed_id: string;
  };
}

/** Truncates to NAME_MAX_CHARS with an ellipsis; text at or under the limit is returned as-is. */
export function truncateForName(text: string): string {
  return text.length > NAME_MAX_CHARS ? `${text.slice(0, NAME_MAX_CHARS)}...` : text;
}

/** Converts a kebab-case archetype to upstream's prose-style category casing. */
export function titleCase(kebab: string): string {
  const spaced = kebab.replace(/-/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Maps one validated seed record to a single eval case. */
export function seedToEvalCase(record: StartupDatasetSchema): EvalCaseEntry {
  const { archetype, description } = record.scenario;
  return {
    name: `[${DIFFICULTY}] ${truncateForName(description)}`,
    messages: [{ role: "user", content: PROMPT_PREFIX + description }],
    tags: ["app-development", DIFFICULTY, archetype],
    metadata: {
      difficulty: DIFFICULTY,
      category: titleCase(archetype),
      archetype,
      seed_id: record._id,
    },
  };
}

/**
 * Maps every seed file under `dir` to an eval case, ordered by filename so output is
 * byte-stable across runs. Rejects if any file is unparseable or fails schema validation —
 * a malformed seed must never silently produce a wrong dataset.
 */
export async function mapDirToEvalDataset(dir: string): Promise<EvalCaseEntry[]> {
  const files = await resolveFiles(dir);
  const cases: EvalCaseEntry[] = [];

  for (const file of files) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(await readFile(file, "utf8"));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`${file}: invalid JSON: ${message}`);
    }

    const result = startupDatasetSchema.safeParse(parsed);
    if (!result.success) {
      const problems = (result.error.issues as z.core.$ZodIssue[])
        .map((issue) => `${formatIssuePath(issue.path)}: ${issue.message}`)
        .join("; ");
      throw new Error(`${file}: failed schema validation: ${problems}`);
    }

    cases.push(seedToEvalCase(result.data));
  }

  return cases;
}
