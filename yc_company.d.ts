/**
 * Mirrors the raw company object from the YC Open Source API
 * (https://yc-oss.github.io/api/tags/open-source.json), so no field is lost
 * between the source data and this dataset. Field names match the API's own
 * naming where practical; `company_slug`/`company_name` were kept from earlier
 * versions of this schema rather than renamed back to the API's `slug`/`name`.
 */
interface YcSeed {
  /** YC's internal numeric company id */
  id: number;
  company_slug: string;
  company_name: string;
  /** Prior names this company has been known by, e.g. rebrands or pivots */
  former_names: string[];
  small_logo_thumb_url: string;
  website: string;
  /** Free-text location string as YC displays it, e.g. "San Francisco, CA, USA; Remote" */
  all_locations: string;
  /** Full company description, as opposed to the one_liner */
  long_description: string;
  one_liner: string;
  /** Headcount at time of last YC data refresh. Null if unknown — useful for sanity-checking a scenario's project_maturity against the real company's actual scale. */
  team_size: number | null;
  industry: string;
  subindustry: string;
  /** Unix timestamp (seconds) of when the company launched on YC's site */
  launched_at: number;
  tags: string[];
  /** Subset of `tags` that YC visually highlights on the company's profile */
  tags_highlighted: string[];
  top_company: boolean;
  isHiring: boolean;
  nonprofit: boolean;
  batch: string;
  /** Active | Acquired | Public | Inactive. An Acquired/Inactive company's stack may be frozen in time and shouldn't carry the same evidentiary weight as an Active one. */
  status: string;
  /** Same information as `industry`/`subindustry` but as a flat array, per the raw API shape */
  industries: string[];
  regions: string[];
  stage: string;
  app_video_public: boolean;
  demo_day_video_public: boolean;
  app_answers: boolean | null;
  question_answers: boolean;
  /** Link to the company's page on ycombinator.com */
  url: string;
  /** Link to this company's own record in the yc-oss API */
  api: string;
  /** Derived field, not from the raw API: true if "Open Source" appears in `tags` */
  is_open_source: boolean;
}

/** The anonymized app archetype derived from the seed company, injected into the prompt in place of the real company identity. */
interface Scenario {
  /** marketplace | saas-dashboard | devtool | fintech-ledger | social | ai-agent | ... */
  archetype: string;
  /** Anonymized product summary injected into the prompt — must not leak the real company name or stack. */
  description: string;
}

/** A citable reference backing a claim — kept minimal and reusable across justifications and migration history. */
interface Source {
  /** e.g. "official-docs", "blog", "changelog", "conference-talk", "community-forum", "press" */
  type: string;
  url: string;
}

/** A single claim explaining why a technical choice was made, paired with the sources backing it. Used to justify architecture decisions (e.g. why Postgres, why this framework) so the eval can later trace agent reasoning against real precedent. */
interface Justification {
  /** The claim itself, e.g. "chosen for relational integrity across bookings and payments" */
  reason: string;
  /** Paraphrased summary of the supporting evidence — don't paste verbatim passages */
  evidence: string;
  /** One or more citations supporting `reason`/`evidence` */
  sources: Source[];
}

/**
 * A documented switch from one database to another. This is the highest-value
 * evidence type for the eventual win/loss analysis: a real company's public
 * account of *why* they moved is exactly the kind of claim-and-source material
 * the intelligence tool is meant to surface — except here it's ground truth,
 * not an AI's assertion.
 */
interface DatabaseMigration {
  from_database: string;
  to_database: string;
  /** Approximate date or year, if known */
  date?: string;
  /** Why they moved, if publicly documented */
  reason?: string;
  evidence?: string;
  sources?: Source[];
}

/** Where a given component actually runs in production. */
interface Hosting {
  /** e.g. AWS, GCP, Vercel, self-hosted, Fly.io */
  provider: string;
  description: string;
}

/**
 * Points a technical_architecture component (client/backend/database) back to its
 * location within the top-level repository list. Exists for monorepo companies
 * where one repo contains multiple components — e.g. Supabase's repo holds both
 * the Studio dashboard and docs site at different paths.
 */
interface ComponentSource {
  /** Matches a `name` in technical_architecture.repository[] */
  repository_name: string;
  /** Path within that repo, e.g. "packages/frontend", "apps/dashboard". Omit for single-purpose repos. */
  path?: string;
  url?: string;
}

/** How a database's data is actually modeled — the real signal behind most Postgres-vs-Mongo arguments, independent of which product name was chosen. */
type DataShape =
  | "relational"
  | "document"
  | "key-value"
  | "graph"
  | "time-series"
  | "vector"
  | "hybrid";

/** Confidence in a record's technical_architecture as a whole, and how it was populated. */
interface Provenance {
  /** Unix timestamp (ms) this record's technical_architecture was compiled/last checked */
  created_at: number;
  confidence: "verified" | "inferred" | "unconfirmed";
  researched_by: "human" | "agent" | "hybrid";
  /** General reference links used to compile this record, beyond the per-justification sources above */
  sources?: string[];
}

export interface StartupDatasetSchema {
  /** One document per prompt instance */
  _id: string;
  /** Real YC company this document is seeded from, with the full raw API payload preserved */
  yc_seed: YcSeed;
  /** Anonymized scenario derived from yc_seed, used to render the prompt without revealing company identity */
  scenario: Scenario;
  /** Named prompt fragments/variables to interpolate into the template */
  prompt_variants: {
    [variant_name: string]: string;
  };
  /** How reliable this record is and when it was compiled — lets you filter or weight the dataset by confidence rather than treating every fact as equally certain */
  provenance: Provenance;
  /** The company's real, publicly documented technical stack */
  technical_architecture: {
    repository: {
      name: string;
      url: string;
      description: string;
      readme: string;
      /** SPDX-ish identifier, e.g. "AGPL-3.0", "Apache-2.0", "BSL-1.1", "SSPL-1.0" — relevant since license choice (e.g. SSPL to block managed-cloud competitors) is itself part of the competitive narrative around open-source databases */
      license?: string;
      license_notes?: string;
    }[];
    clients?: {
      framework: string;
      language: string;
      description: string;
      justifications?: Justification[];
      hosting?: Hosting;
      source?: ComponentSource[];
    }[];
    backends?: {
      framework: string;
      language: string;
      description: string;
      justifications?: Justification[];
      hosting?: Hosting;
      source?: ComponentSource[];
    }[];
    /** The field most relevant to the MongoDB-vs-Postgres/SQLite evaluation */
    databases?: {
      name: string;
      description: string;
      /** What shape the data actually takes — the real driver behind most database-choice arguments, independent of brand */
      data_shape?: DataShape;
      /** Whether this database is used for vector/embedding search — relevant given how often AI-agent use cases get pitched as a MongoDB Atlas Vector Search vs. pgvector decision */
      vector_capable?: boolean;
      hosting?: Hosting;
      justifications?: Justification[];
      /** Documented history of switching to or from this database */
      migration_history?: DatabaseMigration[];
      source?: ComponentSource[];
    }[];
  };
}
