import { hideBin } from "yargs/helpers";
import yargs from "yargs";
import { validateCommand } from "./commands/validate.ts";

// TODO: as more CLI utilities are added (e.g. for the research step), register
// their command modules here with another .command(...) call.

await yargs(hideBin(process.argv))
  .command(validateCommand)
  .demandCommand(1)
  .strict()
  .help()
  .parse();
