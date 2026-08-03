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
