import { hideBin } from "yargs/helpers";
import yargs from "yargs";
import { checkSourcesCommand } from "./commands/check-sources.ts";
import { validateCommand } from "./commands/validate.ts";

await yargs(hideBin(process.argv))
  .command(validateCommand)
  .command(checkSourcesCommand)
  .demandCommand(1)
  .strict()
  .help()
  .parse();
