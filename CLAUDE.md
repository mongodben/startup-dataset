# CLAUDE.md

This is a Node.js project written in TypeScript.

- Use TypeScript for all code in this repo.
- Use `yargs` for every command-line interface — this project will have more than one CLI utility over time, and they should all follow the same yargs-based command structure.
- `src/schema.ts` is the single source of truth for the dataset schema, written in zod. TypeScript types are derived from it via `z.infer`, not hand-maintained separately.
