# Research task: populate the YC open-source technical architecture dataset

## Objective

You will populate a dataset of real Y Combinator companies against `startupDatasetSchema` in `src/schema.ts` — the zod schema that is this project's single source of truth, where each field's `.describe()` explains what it's for. Each document describes one real company's actual, publicly documented technical stack — the database(s) it uses, why, and what it migrated from if anything. This dataset is ground truth for a separate evaluation of why AI coding agents do or don't recommend MongoDB; your job is only to produce accurate, well-sourced records of real companies, not to write or reason about that evaluation.

**The single most important rule: never fabricate.** If you can't find a fact, omit the field or array entry rather than guessing. A missing field is fine. A wrong field poisons the dataset in a way that's hard to detect later. When in doubt, mark it `unconfirmed` rather than `verified`.

## Company selection

- Source companies from the YC Open Source API: `https://yc-oss.github.io/api/tags/open-source.json` (162 companies as of this writing). You can also pull from `https://yc-oss.github.io/api/companies/all.json` if instructed to expand beyond open-source-tagged companies.
- `https://github.com/yc-oss/open-source-companies` is another good source — it's a curated, more actively-maintained subset of YC companies that are specifically OSS software (sourced from the same underlying tag feed, but worth checking as it may include repo links or framing the raw tag JSON doesn't).
- Populate `yc_seed` directly from that company's raw API record — copy every field the API returns, not a subset. Derive `is_open_source` yourself (true if `"Open Source"` appears in `tags`).
- Unless told otherwise, aim for a set that varies on database choice, not just Postgres. Actively look for companies known to use MongoDB, MySQL, SQLite, or multiple databases, in addition to the Postgres-heavy default you'll naturally encounter. Skew toward companies with substantial public engineering writing (docs sites, engineering blogs/handbooks, conference talks) since those are the ones you can actually source well — a company with no public technical writing should be skipped or left thin rather than filled in with inference.

## Research process, per company

For each company, work through these in order. Stop early if a company turns out to have too little public information to justify inclusion — note that and move to the next one rather than filling gaps with guesses.

1. **Repository discovery.** Find the company's GitHub org and its primary repo(s). Populate `technical_architecture.repository[]` — `name`, `url`, `description`, and a paraphrased (not verbatim-copied) summary of the README in `readme`. Check the repo's LICENSE file or SPDX badge for the `license` field; note in `license_notes` anything unusual (e.g. a relicense from a permissive to a source-available license like SSPL or BSL — this is itself a relevant data point, not just metadata).
2. **Architecture research.** Look for: official docs (architecture/deployment pages), an engineering blog or public handbook, conference talks (YouTube, conference sites), and the README/CONTRIBUTING files themselves. From these, populate `clients[]`, `backends[]`, and `databases[]` — framework, language, hosting provider, and for monorepos, the `source[]` path (e.g. `packages/frontend`).
3. **Database justification — the highest-priority field.** For each entry in `databases[]`, actively search for why that database was chosen: "{company} why {database}", "{company} database architecture", "{company} engineering blog database". Populate `justifications[]` with a paraphrased `reason` and `evidence`, and cite the actual page(s) you found it on in `sources[]`. Also populate `data_shape` (relational/document/key-value/graph/time-series/vector/hybrid) based on what the data actually looks like, not just the product's marketing category — and `vector_capable` if the company documents using this database for embeddings/vector search.
4. **Migration history — actively hunt for this, don't wait to stumble on it.** Specifically search "{company} migrated from", "{company} moved away from {database}", "{company} switched database", and check engineering blogs and Hacker News threads about the company. A documented migration (either direction, not just away-from-Mongo) is the single most valuable record you can add — it's real-world evidence of a database decision under real constraints, which is exactly what the downstream evaluation needs to compare AI-generated claims against. Populate `migration_history[]` with `from_database`, `to_database`, approximate `date`, `reason`, and `sources[]`. If you find no evidence of a migration, omit the field — do not assume "no migration" needs to be recorded as an empty array with a note.
5. **Scenario.** Write `scenario.archetype` and `scenario.description` as an anonymized paraphrase of what the product does — enough to generate a realistic app-building prompt later, with no company name, brand terms, or identifiable product names. Someone reading only `scenario` should not be able to guess the company from `yc_seed`.

## Sourcing standards

- Every `Source` needs a real URL you actually retrieved, not a plausible-looking one. Never invent a URL.
- Prefer this order when multiple sources exist: official docs > engineering blog/handbook > conference talk > changelog > community forum (e.g. Hacker News, Reddit) > press coverage. Use `type` to record which kind each source is (e.g. `"official-docs"`, `"blog"`, `"changelog"`, `"conference-talk"`, `"community-forum"`, `"press"`).
- Paraphrase everything in `evidence` and `readme` fields — summarize in your own words rather than pasting quoted passages, both for copyright reasons and because verbatim text bloats the dataset without adding signal.
- If a fact is well-known/obvious from the repo itself (e.g. "written in Go" from the repo's language stats) it doesn't need a citation — reserve `sources[]` for claims that required actual research (justifications, migrations, license history).

## Provenance and confidence

Every record needs a `provenance` block:

- `created_at`: current Unix timestamp in milliseconds.
- `researched_by`: `"agent"`.
- `confidence`: rate honestly.
  - `verified` — you found explicit, primary-source documentation for the core technical_architecture claims.
  - `inferred` — you're reasonably confident based on indirect evidence (e.g. a dependency file, a job posting referencing a stack) but no explicit statement.
  - `unconfirmed` — you filled in the field but couldn't find strong support; flag this rather than silently presenting it as fact.
- `sources`: general reference links used to compile the record, distinct from the per-justification sources above.

If a company as a whole is thin on public information, it's fine for the whole record to be `confidence: "unconfirmed"` with mostly-empty optional arrays — that's more useful than a fabricated `verified` record.

## Output format

- Write one JSON file per company to `dataset/yc/seed_<company_slug>.json`, each a single JSON object (not wrapped in an array) conforming exactly to `startupDatasetSchema` in `src/schema.ts`.
- `_id` should be a stable slug, e.g. `"seed_{company_slug}"`.
- Leave `scenario` fields present but don't over-invest in them — they're a placeholder for the downstream prompt-experiment mapping, not the research focus.
- Leave `prompt_variants` as an empty object `{}` — populating it is a separate downstream step, not part of this research task.
- Before returning, validate each file with the project CLI — `npm run validate -- dataset/yc/seed_<company_slug>.json` — and fix anything it reports. It checks types exactly (e.g. `launched_at` and `provenance.created_at` are numbers, not date strings; `team_size` is `number | null`, never omitted) and rejects unrecognized keys, so a misspelled field name fails rather than silently dropping the data.

## Before you submit, check

- [ ] Every `sources[].url` was actually visited, not guessed
- [ ] No `migration_history` entries were invented to "complete" a record
- [ ] `confidence` reflects what you actually found, not what would look best
- [ ] `scenario.description` doesn't leak the company's identity
- [ ] The company set isn't 100% Postgres — you actively looked for MongoDB/MySQL/SQLite/hybrid cases
- [ ] `npm run validate` passes for every file you wrote