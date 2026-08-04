import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CommandModule } from "yargs";
import yaml from "yaml";
import { validateTarget } from "../dataset.ts";
import { mapDirToEvalDataset } from "../eval-dataset.ts";

interface MapEvalDatasetArgs {
  "dir-in": string;
  "path-out": string;
}

export const mapEvalDatasetCommand: CommandModule<{}, MapEvalDatasetArgs> = {
  command: "map-eval-dataset",
  describe: "Map a directory of seed files to a single YAML eval dataset file",
  builder: (yargs) =>
    yargs
      .option("dir-in", {
        type: "string",
        describe: "Directory of seed JSON files to read",
        demandOption: true,
      })
      .option("path-out", {
        type: "string",
        describe: "Path of the YAML dataset file to write",
        demandOption: true,
      }),
  handler: async (argv) => {
    const dirIn = argv["dir-in"];
    const pathOut = argv["path-out"];

    // Validate first so every problem is reported at once, rather than failing on
    // whichever bad file the mapper happens to reach first.
    let results;
    try {
      results = await validateTarget(dirIn);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Could not read ${dirIn}: ${message}`);
      process.exitCode = 1;
      return;
    }

    if (results.length === 0) {
      console.error(`No JSON files found in ${dirIn}; nothing to map.`);
      process.exitCode = 1;
      return;
    }

    const invalid = results.filter((result) => !result.ok);
    if (invalid.length > 0) {
      console.error(
        `Refusing to write ${pathOut}: ${invalid.length}/${results.length} seed file(s) failed validation.`,
      );
      for (const { file, problems } of invalid) {
        console.error(`✗ ${file}`);
        for (const problem of problems) console.error(`    ${problem}`);
      }
      process.exitCode = 1;
      return;
    }

    const cases = await mapDirToEvalDataset(dirIn);

    await mkdir(path.dirname(path.resolve(pathOut)), { recursive: true });
    // Upstream's dataset keeps each `name` on a single line and folds only the longer
    // `content` scalars; the default width of 80 would wrap names too.
    await writeFile(pathOut, yaml.stringify(cases, { lineWidth: 120 }), "utf8");

    console.log(`Wrote ${cases.length} eval case(s) to ${pathOut}`);
  },
};
