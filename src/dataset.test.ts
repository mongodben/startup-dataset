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
