import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import type { CommandModule } from "yargs";
import type { z } from "zod";
import { startupDatasetSchema } from "../schema.ts";

const DEFAULT_TARGET = "dataset/yc";

interface ValidateArgs {
  path?: string;
}

/** Renders a zod issue path as a readable field reference, e.g. `technical_architecture.databases[0].name`. */
function formatIssuePath(issuePath: readonly PropertyKey[]): string {
  if (issuePath.length === 0) return "(root)";
  return issuePath.reduce<string>((acc, segment) => {
    if (typeof segment === "number") return `${acc}[${segment}]`;
    return acc === "" ? String(segment) : `${acc}.${String(segment)}`;
  }, "");
}

/** Resolves a file-or-directory target to the list of JSON files to validate. */
async function resolveFiles(target: string): Promise<string[]> {
  const stats = await stat(target);
  if (stats.isFile()) return [target];

  const entries = await readdir(target, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.join(target, entry.name))
    .sort();
}

interface FileResult {
  file: string;
  ok: boolean;
  /** Per-issue lines to print beneath the file, empty when valid. */
  problems: string[];
}

/** Validates one file against the schema. Collects problems rather than printing them, so output stays in file order regardless of completion order. */
async function validateFile(file: string): Promise<FileResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { file, ok: false, problems: [`invalid JSON: ${message}`] };
  }

  const result = startupDatasetSchema.safeParse(parsed);
  if (result.success) return { file, ok: true, problems: [] };

  const problems = (result.error.issues as z.core.$ZodIssue[]).map(
    (issue) => `${formatIssuePath(issue.path)}: ${issue.message}`,
  );
  return { file, ok: false, problems };
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

    let files: string[];
    try {
      files = await resolveFiles(target);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Could not read ${target}: ${message}`);
      process.exitCode = 1;
      return;
    }

    if (files.length === 0) {
      console.log(`No JSON files found in ${target}.`);
      return;
    }

    const results = await Promise.all(files.map(validateFile));

    for (const { file, ok, problems } of results) {
      if (ok) {
        console.log(`✓ ${file}`);
        continue;
      }
      console.error(`✗ ${file}`);
      for (const problem of problems) console.error(`    ${problem}`);
    }

    const validCount = results.filter((result) => result.ok).length;
    console.log(`\n${validCount}/${files.length} valid`);
    if (validCount < files.length) process.exitCode = 1;
  },
};
