# Startup Tech Stack Dataset

A dataset of real Y Combinator companies' publicly documented technical stacks — databases,
frameworks, hosting, and migration history — used as ground truth for evaluating why AI coding
agents do or don't recommend a given database.

## Layout

- `src/schema.ts` — the zod schema (and inferred TypeScript types) every dataset entry must conform to
- `dataset/yc/` — one JSON file per company (`seed_<slug>.json`)
- `prompts/` — prompts used to drive the research process that populates the dataset
