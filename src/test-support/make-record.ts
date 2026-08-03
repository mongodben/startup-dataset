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
