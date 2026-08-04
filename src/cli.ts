import { hideBin } from "yargs/helpers";
import yargs from "yargs";
import { checkSourcesCommand } from "./commands/check-sources.ts";
import { mapEvalDatasetCommand } from "./commands/map-eval-dataset.ts";
import { validateCommand } from "./commands/validate.ts";

await yargs(hideBin(process.argv))
  .command(validateCommand)
  .command(checkSourcesCommand)
  .command(mapEvalDatasetCommand)
  .demandCommand(1)
  .strict()
  .help()
  .parse();
