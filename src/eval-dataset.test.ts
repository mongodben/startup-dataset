import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  NAME_MAX_CHARS,
  mapDirToEvalDataset,
  seedToEvalCase,
  titleCase,
  truncateForName,
} from "./eval-dataset.ts";
import { makeRecord } from "./test-support/make-record.ts";

/** Builds a record whose scenario carries the given archetype/description. */
function recordWith(archetype: string, description: string) {
  return makeRecord({ scenario: { archetype, description } });
}

describe("truncateForName", () => {
  it("truncates text longer than the limit and appends an ellipsis", () => {
    const long = "x".repeat(NAME_MAX_CHARS + 25);
    const result = truncateForName(long);
    expect(result).toBe("x".repeat(NAME_MAX_CHARS) + "...");
    expect(result).toHaveLength(NAME_MAX_CHARS + 3);
  });

  it("returns text of exactly the limit unchanged, with no ellipsis", () => {
    const exact = "y".repeat(NAME_MAX_CHARS);
    expect(truncateForName(exact)).toBe(exact);
  });

  it("returns short text unchanged", () => {
    expect(truncateForName("a short scenario")).toBe("a short scenario");
  });
});

describe("titleCase", () => {
  it("converts a kebab-case archetype to prose-style title case", () => {
    expect(titleCase("fintech-ledger")).toBe("Fintech ledger");
  });

  it("capitalizes a single-word archetype", () => {
    expect(titleCase("devtool")).toBe("Devtool");
  });

  it("handles multiple hyphens", () => {
    expect(titleCase("healthtech-workflow-saas")).toBe("Healthtech workflow saas");
  });
});

describe("seedToEvalCase", () => {
  it("prefixes the description to build the user prompt", () => {
    const entry = seedToEvalCase(recordWith("devtool", "A tool for tracking widgets."));
    expect(entry.messages).toEqual([
      { role: "user", content: "Build me this app: A tool for tracking widgets." },
    ]);
  });

  it("derives the name from the description, not the prefixed content", () => {
    const entry = seedToEvalCase(recordWith("devtool", "A tool for tracking widgets."));
    expect(entry.name).toBe("[advanced] A tool for tracking widgets.");
    expect(entry.name).not.toContain("Build me this app:");
  });

  it("truncates the name for a long description", () => {
    const description = "z".repeat(NAME_MAX_CHARS + 40);
    const entry = seedToEvalCase(recordWith("devtool", description));
    expect(entry.name).toBe(`[advanced] ${"z".repeat(NAME_MAX_CHARS)}...`);
  });

  it("tags the case with app-development, the difficulty, and the archetype", () => {
    const entry = seedToEvalCase(recordWith("fintech-ledger", "A ledger."));
    expect(entry.tags).toEqual(["app-development", "advanced", "fintech-ledger"]);
  });

  it("emits archetype verbatim and category title-cased from the same source", () => {
    const entry = seedToEvalCase(recordWith("fintech-ledger", "A ledger."));
    expect(entry.metadata.archetype).toBe("fintech-ledger");
    expect(entry.metadata.category).toBe("Fintech ledger");
  });

  it("emits seed_id matching the record's _id", () => {
    const record = makeRecord({ _id: "seed_acme-co" });
    expect(seedToEvalCase(record).metadata.seed_id).toBe("seed_acme-co");
  });

  it("hardcodes difficulty to advanced", () => {
    expect(seedToEvalCase(makeRecord()).metadata.difficulty).toBe("advanced");
  });

  it("omits is_mongodb_optimal and the mongodb-optimal tag", () => {
    const entry = seedToEvalCase(makeRecord());
    expect(entry.metadata).not.toHaveProperty("is_mongodb_optimal");
    expect(entry.tags).not.toContain("mongodb-optimal");
  });
});

describe("mapDirToEvalDataset", () => {
  it("returns one entry per seed file, ordered by filename", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "eval-map-"));
    await writeFile(
      path.join(dir, "seed_b.json"),
      JSON.stringify(makeRecord({ _id: "seed_b" })),
    );
    await writeFile(
      path.join(dir, "seed_a.json"),
      JSON.stringify(makeRecord({ _id: "seed_a" })),
    );
    await writeFile(path.join(dir, "notes.txt"), "ignored");

    const cases = await mapDirToEvalDataset(dir);
    expect(cases.map((c) => c.metadata.seed_id)).toEqual(["seed_a", "seed_b"]);
  });

  it("rejects when a file in the directory fails schema validation", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "eval-map-bad-"));
    const bad = makeRecord() as Record<string, unknown>;
    delete bad.scenario;
    await writeFile(path.join(dir, "seed_bad.json"), JSON.stringify(bad));

    await expect(mapDirToEvalDataset(dir)).rejects.toThrow(/seed_bad\.json/);
  });
});
