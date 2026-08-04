# Startup Tech Stack Dataset

A dataset of real Y Combinator companies' publicly documented technical stacks — databases,
frameworks, hosting, and migration history — used as ground truth for evaluating why AI coding
agents do or don't recommend a given database.

## Layout

- `src/schema.ts` — the zod schema (and inferred TypeScript types) every dataset entry must conform to
- `dataset/yc/` — one JSON file per company (`seed_<slug>.json`)
- `dataset/eval/` — generated eval datasets derived from the seeds; do not edit by hand
- `prompts/research_yc_companies.md` — the research process and sourcing standards used to populate `dataset/yc/`
- `.claude/agents/` — subagents that do the research: `startup-locator` finds candidate companies, `startup-deep-researcher` researches one company and writes/validates its seed file
- `docs/superpowers/` — design specs and implementation plans for the tooling

## Setup

```bash
npm install
```

## Commands

```bash
npm test                 # unit tests
npm run validate         # validate seeds against the schema
npm run check-sources    # confirm every cited URL still resolves
npm run map-eval-dataset -- --dir-in dataset/yc --path-out dataset/eval/app-development.yml
```

`map-eval-dataset` converts the seed files into the YAML shape consumed by
[mongodb/ai-benchmarks](https://github.com/mongodb/ai-benchmarks)' coding-agent app-development
benchmark. See
[the design doc](docs/superpowers/specs/2026-08-04-eval-dataset-export-design.md) for the mapping
rules and their rationale.
