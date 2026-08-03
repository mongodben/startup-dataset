import { z } from "zod";

/**
 * Single source of truth for the dataset schema. Types are derived from these
 * zod schemas via `z.infer` — never hand-maintained alongside them.
 *
 * Objects are strict: an unrecognized key is a validation error rather than a
 * silently-ignored one. For agent- or hand-authored records, a misspelled field
 * (`justfications`, `data_shapes`) would otherwise pass validation while leaving
 * the intended data missing, which is exactly the kind of quiet corruption this
 * dataset can least afford. If the YC API adds a field, that surfaces here as a
 * loud failure and `ycSeedSchema` should be extended to cover it.
 */

/** Mirrors the raw company object from the YC Open Source API
 * (https://yc-oss.github.io/api/tags/open-source.json), so no field is lost
 * between the source data and this dataset. Field names match the API's own
 * naming where practical; `company_slug`/`company_name` were kept from earlier
 * versions of this schema rather than renamed back to the API's `slug`/`name`. */
export const ycSeedSchema = z
  .strictObject({
    id: z.number().describe("YC's internal numeric company id"),
    company_slug: z.string(),
    company_name: z.string(),
    former_names: z
      .array(z.string())
      .describe("Prior names this company has been known by, e.g. rebrands or pivots"),
    small_logo_thumb_url: z.string(),
    website: z.string(),
    all_locations: z
      .string()
      .describe(
        'Free-text location string as YC displays it, e.g. "San Francisco, CA, USA; Remote"',
      ),
    long_description: z
      .string()
      .describe("Full company description, as opposed to the one_liner"),
    one_liner: z.string(),
    team_size: z
      .number()
      .nullable()
      .describe(
        "Headcount at time of last YC data refresh. Null if unknown — useful for sanity-checking a scenario's project_maturity against the real company's actual scale.",
      ),
    industry: z.string(),
    subindustry: z.string(),
    launched_at: z
      .number()
      .describe("Unix timestamp (seconds) of when the company launched on YC's site"),
    tags: z.array(z.string()),
    tags_highlighted: z
      .array(z.string())
      .describe("Subset of `tags` that YC visually highlights on the company's profile"),
    top_company: z.boolean(),
    isHiring: z.boolean(),
    nonprofit: z.boolean(),
    batch: z.string(),
    status: z
      .string()
      .describe(
        "Active | Acquired | Public | Inactive. An Acquired/Inactive company's stack may be frozen in time and shouldn't carry the same evidentiary weight as an Active one.",
      ),
    industries: z
      .array(z.string())
      .describe(
        "Same information as `industry`/`subindustry` but as a flat array, per the raw API shape",
      ),
    regions: z.array(z.string()),
    stage: z.string(),
    app_video_public: z.boolean(),
    demo_day_video_public: z.boolean(),
    app_answers: z.boolean().nullable(),
    question_answers: z.boolean(),
    url: z.string().describe("Link to the company's page on ycombinator.com"),
    api: z.string().describe("Link to this company's own record in the yc-oss API"),
    is_open_source: z
      .boolean()
      .describe(
        'Derived field, not from the raw API: true if "Open Source" appears in `tags`',
      ),
  })
  .describe(
    "Real YC company this document is seeded from, with the full raw API payload preserved",
  );

/** The anonymized app archetype derived from the seed company, injected into the prompt in place of the real company identity. */
export const scenarioSchema = z
  .strictObject({
    archetype: z
      .string()
      .describe("marketplace | saas-dashboard | devtool | fintech-ledger | social | ai-agent | ..."),
    description: z
      .string()
      .describe(
        "Anonymized product summary injected into the prompt — must not leak the real company name or stack.",
      ),
  })
  .describe(
    "Anonymized scenario derived from yc_seed, used to render the prompt without revealing company identity",
  );

/** A citable reference backing a claim — kept minimal and reusable across justifications and migration history. */
export const sourceSchema = z.strictObject({
  type: z
    .string()
    .describe(
      'e.g. "official-docs", "blog", "changelog", "conference-talk", "community-forum", "press"',
    ),
  url: z.string(),
});

/** A single claim explaining why a technical choice was made, paired with the sources backing it. Used to justify architecture decisions (e.g. why Postgres, why this framework) so the eval can later trace agent reasoning against real precedent. */
export const justificationSchema = z.strictObject({
  reason: z
    .string()
    .describe(
      'The claim itself, e.g. "chosen for relational integrity across bookings and payments"',
    ),
  evidence: z
    .string()
    .describe(
      "Paraphrased summary of the supporting evidence — don't paste verbatim passages",
    ),
  sources: z.array(sourceSchema).describe("One or more citations supporting `reason`/`evidence`"),
});

/**
 * A documented switch from one database to another. This is the highest-value
 * evidence type for the eventual win/loss analysis: a real company's public
 * account of *why* they moved is exactly the kind of claim-and-source material
 * the intelligence tool is meant to surface — except here it's ground truth,
 * not an AI's assertion.
 */
export const databaseMigrationSchema = z.strictObject({
  from_database: z.string(),
  to_database: z.string(),
  date: z.string().optional().describe("Approximate date or year, if known"),
  reason: z.string().optional().describe("Why they moved, if publicly documented"),
  evidence: z.string().optional(),
  sources: z.array(sourceSchema).optional(),
});

/** Where a given component actually runs in production. */
export const hostingSchema = z
  .strictObject({
    provider: z.string().describe("e.g. AWS, GCP, Vercel, self-hosted, Fly.io"),
    description: z.string(),
  })
  .describe("Where a given component actually runs in production.");

/**
 * Points a technical_architecture component (client/backend/database) back to its
 * location within the top-level repository list. Exists for monorepo companies
 * where one repo contains multiple components — e.g. Supabase's repo holds both
 * the Studio dashboard and docs site at different paths.
 */
export const componentSourceSchema = z.strictObject({
  repository_name: z.string().describe("Matches a `name` in technical_architecture.repository[]"),
  path: z
    .string()
    .optional()
    .describe(
      'Path within that repo, e.g. "packages/frontend", "apps/dashboard". Omit for single-purpose repos.',
    ),
  url: z.string().optional(),
});

/** How a database's data is actually modeled — the real signal behind most Postgres-vs-Mongo arguments, independent of which product name was chosen. */
export const dataShapeSchema = z
  .enum(["relational", "document", "key-value", "graph", "time-series", "vector", "hybrid"])
  .describe(
    "How a database's data is actually modeled — the real signal behind most Postgres-vs-Mongo arguments, independent of which product name was chosen.",
  );

/** Confidence in a record's technical_architecture as a whole, and how it was populated. */
export const provenanceSchema = z
  .strictObject({
    created_at: z
      .number()
      .describe(
        "Unix timestamp (ms) this record's technical_architecture was compiled/last checked",
      ),
    confidence: z.enum(["verified", "inferred", "unconfirmed"]),
    researched_by: z.enum(["human", "agent", "hybrid"]),
    sources: z
      .array(z.string())
      .optional()
      .describe(
        "General reference links used to compile this record, beyond the per-justification sources above",
      ),
  })
  .describe(
    "How reliable this record is and when it was compiled — lets you filter or weight the dataset by confidence rather than treating every fact as equally certain",
  );

export const repositorySchema = z.strictObject({
  name: z.string(),
  url: z.string(),
  description: z.string(),
  readme: z.string(),
  license: z
    .string()
    .optional()
    .describe(
      'SPDX-ish identifier, e.g. "AGPL-3.0", "Apache-2.0", "BSL-1.1", "SSPL-1.0" — relevant since license choice (e.g. SSPL to block managed-cloud competitors) is itself part of the competitive narrative around open-source databases',
    ),
  license_notes: z.string().optional(),
});

/** Shared shape for the client and backend component lists. */
const componentSchema = z.strictObject({
  framework: z.string(),
  language: z.string(),
  description: z.string(),
  justifications: z.array(justificationSchema).optional(),
  hosting: hostingSchema.optional(),
  source: z.array(componentSourceSchema).optional(),
});

export const clientSchema = componentSchema;
export const backendSchema = componentSchema;

export const databaseSchema = z.strictObject({
  name: z.string(),
  description: z.string(),
  data_shape: dataShapeSchema
    .optional()
    .describe(
      "What shape the data actually takes — the real driver behind most database-choice arguments, independent of brand",
    ),
  vector_capable: z
    .boolean()
    .optional()
    .describe(
      "Whether this database is used for vector/embedding search — relevant given how often AI-agent use cases get pitched as a MongoDB Atlas Vector Search vs. pgvector decision",
    ),
  hosting: hostingSchema.optional(),
  justifications: z.array(justificationSchema).optional(),
  migration_history: z
    .array(databaseMigrationSchema)
    .optional()
    .describe("Documented history of switching to or from this database"),
  source: z.array(componentSourceSchema).optional(),
});

export const technicalArchitectureSchema = z
  .strictObject({
    repository: z.array(repositorySchema),
    clients: z.array(clientSchema).optional(),
    backends: z.array(backendSchema).optional(),
    databases: z
      .array(databaseSchema)
      .optional()
      .describe("The field most relevant to the MongoDB-vs-Postgres/SQLite evaluation"),
  })
  .describe("The company's real, publicly documented technical stack");

export const startupDatasetSchema = z.strictObject({
  _id: z.string().describe("One document per prompt instance"),
  yc_seed: ycSeedSchema,
  scenario: scenarioSchema,
  prompt_variants: z
    .record(z.string(), z.string())
    .describe("Named prompt fragments/variables to interpolate into the template"),
  provenance: provenanceSchema,
  technical_architecture: technicalArchitectureSchema,
});

export type YcSeed = z.infer<typeof ycSeedSchema>;
export type Scenario = z.infer<typeof scenarioSchema>;
export type Source = z.infer<typeof sourceSchema>;
export type Justification = z.infer<typeof justificationSchema>;
export type DatabaseMigration = z.infer<typeof databaseMigrationSchema>;
export type Hosting = z.infer<typeof hostingSchema>;
export type ComponentSource = z.infer<typeof componentSourceSchema>;
export type DataShape = z.infer<typeof dataShapeSchema>;
export type Provenance = z.infer<typeof provenanceSchema>;
export type Repository = z.infer<typeof repositorySchema>;
export type TechnicalArchitecture = z.infer<typeof technicalArchitectureSchema>;
export type StartupDatasetSchema = z.infer<typeof startupDatasetSchema>;
