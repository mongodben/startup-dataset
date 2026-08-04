# Eval Dataset Export Design

**Goal:** Add a CLI command that maps a directory of seed files into a single YAML dataset file matching the shape consumed by `mongodb/ai-benchmarks`' coding-agent app-development benchmark.

## Target format

The consuming loader is
[`loadAppDevelopmentDataset.ts`](https://github.com/mongodb/ai-benchmarks/blob/main/packages/benchmarks/src/coding-agent-app-development/loadAppDevelopmentDataset.ts).
It reads a single YAML file containing a flat array and parses each entry as:

```ts
interface RawDatasetEntry {
  name: string;
  messages: Array<{ role: "user" | "system" | "assistant"; content: string }>;
  tags?: string[];
  metadata?: Record<string, unknown>;
}
```

`metadata` is blind-cast (`entry.metadata as unknown as AppDevelopmentMetadata`), so extra
keys are permitted and missing keys do not throw at load time. The nominal metadata type is:

```ts
{
  difficulty: "beginner" | "intermediate" | "advanced";  // required
  is_mongodb_optimal?: boolean;                          // optional
  category?: string;                                     // optional
} & Record<string, unknown>
```

### Conventions derived from the existing corpus

These were measured against all 104 entries in
`packages/benchmarks/datasets/app-development.yml`, not assumed:

- **`name`** is `` `[${difficulty}] ` `` followed by prompt text truncated to **80 characters**
  with `...` appended. Text at or under 80 characters is emitted verbatim with no ellipsis
  (8 of the 104 entries take this branch). Total name length therefore varies with the
  difficulty prefix — 94 for `[advanced]`/`[beginner]`, 98 for `[intermediate]`.
- **`messages`** is always a single entry with `role: user`. No system or assistant messages
  appear anywhere in the corpus.
- **`tags`** always includes `app-development` and the difficulty. A kebab-case category tag
  appears on the 51 entries that have a `category`. `mongodb-optimal` appears only where
  `is_mongodb_optimal` is `true`.
- **`metadata.category`** values are prose-style title case (`Content platform`,
  `E-commerce`, `Social media`), while the corresponding tag is kebab-case (`content-platform`,
  `e-commerce`, `social-media`).
- The corpus is deliberately balanced: 52 entries `is_mongodb_optimal: true`, 52 `false`.

## Mapping

One YAML entry per seed file, ordered by filename so output is byte-stable across runs.

| Target | Source |
|---|---|
| `messages[0].role` | Literal `user` |
| `messages[0].content` | `"Build me this app: " + scenario.description` |
| `name` | `` `[advanced] ` `` + `scenario.description` truncated to `NAME_MAX_CHARS` (80) + `...` |
| `tags` | `["app-development", "advanced", scenario.archetype]` |
| `metadata.difficulty` | Literal `"advanced"` |
| `metadata.category` | `scenario.archetype`, title-cased (`fintech-ledger` → `Fintech ledger`) |
| `metadata.archetype` | `scenario.archetype` verbatim (`fintech-ledger`) |
| `metadata.seed_id` | `_id` (e.g. `seed_infisical`) |

`scenario.archetype` is already kebab-case in our schema, so it needs no transformation to
serve as a tag and matches the upstream tag style directly.

### Worked example

For `dataset/yc/seed_infisical.json` (archetype `devtool`, description 475 characters):

```yaml
- name: "[advanced] A developer infrastructure platform for centrally storing and distributing sensi..."
  messages:
    - role: user
      content: "Build me this app: A developer infrastructure platform for centrally storing and distributing sensitive configuration values — credentials, API keys, connection strings, and certificates — across a team's applications, environments, and CI/CD pipelines. It supports versioning, point-in-time recovery, audit logging, and automatic rotation, and is offered both as a managed cloud service and as a self-hosted deployment for compliance-conscious customers who run it on their own infrastructure."
  tags:
    - app-development
    - advanced
    - devtool
  metadata:
    difficulty: advanced
    category: Devtool
    archetype: devtool
    seed_id: seed_infisical
```

### Decisions and rationale

**`name` derives from `scenario.description`, not from `messages[0].content`.** Upstream derives
the name from the prompt text, but our content all begins with the same 19-character
`"Build me this app: "` preamble. Truncating that at 80 characters would make every name share
its first 30 characters (`[advanced] Build me this app: …`), and `name` is the case identifier in
Braintrust's UI. Dropping the preamble from the name preserves the field's purpose at the cost of
a small, deliberate deviation from upstream's literal rule.

**`difficulty` is hardcoded `"advanced"`.** The field is required upstream and has no source in
`src/schema.ts`. Every seed describes a real production system, so a uniform `advanced` is more
honest than synthesising a gradient from a proxy like team size or database count. Consequence:
our cases contribute no difficulty spread, so difficulty-sliced comparisons will not
meaningfully include them.

**`is_mongodb_optimal` is omitted.** The field is optional upstream. Deriving it mechanically
from `data_shape` would get the most interesting cases backwards — Infisical and Convoy both
measurably left MongoDB, Medplum deliberately keeps document-shaped FHIR data in Postgres, and
Vanta stayed on MongoDB after explicitly evaluating alternatives. Labelling it properly needs a
per-company, evidence-backed judgement, which is deferred rather than guessed. The
`mongodb-optimal` tag is correspondingly omitted.

**`seed_id` is included in metadata** so every generated case can be joined back to its seed
record, and through it to the full research evidence (justifications, migration history, source
URLs). Metadata is not sent to the model, so this adds traceability without leaking company
identity into the prompt.

**`archetype` is included alongside `category`, despite being redundant.** `category` exists to
satisfy upstream's field and follows its prose-style casing, which makes it a poor grouping key.
`archetype` carries our canonical kebab-case vocabulary unchanged, so downstream analysis can
group and filter on the same values the seed dataset uses without reversing the title-casing.

## Known limitations

Our generated prompts differ from the existing 104 on two measurable axes, both accepted
deliberately:

1. **Register.** Ours are analyst prose describing a company in the third person; theirs are
   imperative, naive-user requests (`Build a shopping cart application that saves…`).
2. **Length.** Our `scenario.description` values run 373–981 characters (mean ≈ 600), against
   roughly 200 characters for upstream prompts, so our content is 2–5× longer.

Anyone comparing results between our cases and the upstream 104 should treat these as potential
confounds rather than assuming the two subsets are drawn from the same distribution.

## File structure

| File | Responsibility |
|---|---|
| `src/eval-dataset.ts` | **New.** Pure mapping logic: `seedToEvalCase`, `mapDirToEvalDataset`, `truncateForName`, `titleCase`, and the `NAME_MAX_CHARS` constant. Reads seed files; performs no writing and no `process.exit`. |
| `src/eval-dataset.test.ts` | **New.** Unit tests for the mapping. |
| `src/commands/map-eval-dataset.ts` | **New.** Thin yargs `CommandModule`: resolves args, calls the library, serialises to YAML, writes the file, prints a summary. |
| `src/cli.ts` | Register `mapEvalDatasetCommand`. |
| `package.json` | Add `yaml` dependency and a `map-eval-dataset` script. |

This mirrors the split already established for `validate`: logic in a testable library module,
with the command module confined to CLI concerns.

### Interfaces

```ts
export const NAME_MAX_CHARS = 80;

export interface EvalCaseEntry {
  name: string;
  messages: Array<{ role: "user"; content: string }>;
  tags: string[];
  metadata: {
    difficulty: "advanced";
    category: string;
    archetype: string;
    seed_id: string;
  };
}

export function truncateForName(text: string): string;
export function titleCase(kebab: string): string;
export function seedToEvalCase(record: StartupDatasetSchema): EvalCaseEntry;
export function mapDirToEvalDataset(dir: string): Promise<EvalCaseEntry[]>;
```

## CLI

```
map-eval-dataset --dir-in <dir> --path-out <file>
```

Both arguments are required and take no defaults, since writing a dataset file is a
side-effecting operation that should be explicit about where it reads from and writes to.

Behaviour:

- Reads every `*.json` file in `--dir-in`, validating each against `startupDatasetSchema`.
- If any file fails validation, prints the failures and exits 1 without writing output, so a
  malformed seed can never produce a silently-wrong dataset.
- Serialises the mapped array to YAML and writes it to `--path-out`, creating parent
  directories if needed.
- Prints a count of cases written, and exits 0.

Reusing `startupDatasetSchema` for the validation step means the mapper cannot read fields that
the schema does not guarantee.

## Testing

Unit tests in `src/eval-dataset.test.ts`, using the existing `makeRecord` factory from
`src/test-support/make-record.ts`:

- `truncateForName` truncates text longer than 80 characters and appends `...`
- `truncateForName` returns text of exactly 80 characters unchanged, with no ellipsis
  (boundary case)
- `titleCase` converts `fintech-ledger` to `Fintech ledger` and leaves a single word capitalised
- `seedToEvalCase` produces the expected `content` with the `"Build me this app: "` prefix
- `seedToEvalCase` sets tags to `app-development`, `advanced`, and the archetype
- `seedToEvalCase` emits `seed_id` matching the record's `_id`
- `seedToEvalCase` emits `archetype` verbatim and `category` title-cased from the same source
- `seedToEvalCase` emits neither `is_mongodb_optimal` nor a `mongodb-optimal` tag
- `mapDirToEvalDataset` returns entries ordered by filename
- `mapDirToEvalDataset` rejects when a file in the directory fails schema validation

End-to-end verification, run manually once implemented: execute the command over the real
`dataset/yc` directory and parse the output back through the upstream `RawDatasetEntry` shape,
confirming all 18 cases round-trip with a `user` role, non-empty content, and a resolvable
`seed_id`.
