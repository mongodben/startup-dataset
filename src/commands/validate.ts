import type { CommandModule } from "yargs";
import { validateTarget } from "../dataset.ts";

const DEFAULT_TARGET = "dataset/yc";

interface ValidateArgs {
  path?: string;
}

export const validateCommand: CommandModule<{}, ValidateArgs> = {
  command: "validate [path]",
  describe: "Validate dataset entries against the schema",
  builder: (yargs) =>
    yargs.positional("path", {
      type: "string",
      describe: `File or directory to validate (defaults to ${DEFAULT_TARGET})`,
      default: DEFAULT_TARGET,
    }),
  handler: async (argv) => {
    const target = argv.path ?? DEFAULT_TARGET;

    let results;
    try {
      results = await validateTarget(target);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Could not read ${target}: ${message}`);
      process.exitCode = 1;
      return;
    }

    if (results.length === 0) {
      console.log(`No JSON files found in ${target}.`);
      return;
    }

    for (const { file, ok, problems } of results) {
      if (ok) {
        console.log(`✓ ${file}`);
        continue;
      }
      console.error(`✗ ${file}`);
      for (const problem of problems) console.error(`    ${problem}`);
    }

    const validCount = results.filter((result) => result.ok).length;
    console.log(`\n${validCount}/${results.length} valid`);
    if (validCount < results.length) process.exitCode = 1;
  },
};
