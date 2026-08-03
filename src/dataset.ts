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
