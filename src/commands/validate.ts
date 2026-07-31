import type { CommandModule } from "yargs";

interface ValidateArgs {
  path?: string;
}

// TODO: implement the `validate` command:
// - `path` defaults to "dataset/yc" (validate every *.json file in that dir);
//   if it points at a single file, validate just that file.
// - For each file: read + JSON.parse it, run startupDatasetSchema.safeParse.
// - On failure, print the file path plus each zod issue's field path + message.
// - Print a summary at the end (e.g. "12/14 valid").
// - Exit with code 1 if any file failed validation, 0 otherwise.
export const validateCommand: CommandModule<{}, ValidateArgs> = {
  command: "validate [path]",
  describe: "Validate dataset entries against the schema",
  builder: (yargs) =>
    yargs.positional("path", {
      type: "string",
      describe: "File or directory to validate (defaults to dataset/yc)",
    }),
  handler: async (_argv) => {
    throw new Error("not implemented");
  },
};
