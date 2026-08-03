import type { CommandModule } from "yargs";
import { collectSourceUrls, readRecordForUrls, resolveFiles } from "../dataset.ts";

const DEFAULT_TARGET = "dataset/yc";
const TIMEOUT_MS = 10_000;

export interface UrlCheck {
  url: string;
  ok: boolean;
  status: number | string;
}

interface CheckSourcesArgs {
  path?: string;
}

/** Requests a URL to confirm it exists. HEAD first, falling back to GET since many hosts reject HEAD. */
export async function checkUrl(url: string, fetchImpl: typeof fetch = fetch): Promise<UrlCheck> {
  const attempt = async (method: "HEAD" | "GET"): Promise<Response> =>
    fetchImpl(url, { method, redirect: "follow", signal: AbortSignal.timeout(TIMEOUT_MS) });

  try {
    let response = await attempt("HEAD");
    if (!response.ok) response = await attempt("GET");
    return { url, ok: response.ok, status: response.status };
  } catch (error) {
    return { url, ok: false, status: error instanceof Error ? error.message : String(error) };
  }
}

/** Checks URLs with a small concurrency cap so a record with many citations stays polite. */
async function checkAll(urls: string[]): Promise<UrlCheck[]> {
  const results: UrlCheck[] = [];
  const queue = [...urls];
  const workers = Array.from({ length: Math.min(5, queue.length) }, async () => {
    while (queue.length > 0) {
      const url = queue.shift();
      if (url === undefined) return;
      results.push(await checkUrl(url));
    }
  });
  await Promise.all(workers);
  return results;
}

export const checkSourcesCommand: CommandModule<{}, CheckSourcesArgs> = {
  command: "check-sources [path]",
  describe: "Request every citation URL in dataset entries to confirm it resolves",
  builder: (yargs) =>
    yargs.positional("path", {
      type: "string",
      describe: `File or directory to check (defaults to ${DEFAULT_TARGET})`,
      default: DEFAULT_TARGET,
    }),
  handler: async (argv) => {
    const target = argv.path ?? DEFAULT_TARGET;

    let files: string[];
    try {
      files = await resolveFiles(target);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Could not read ${target}: ${message}`);
      process.exitCode = 1;
      return;
    }

    let deadTotal = 0;
    for (const file of files) {
      const record = await readRecordForUrls(file);
      if (record === null) {
        console.error(`✗ ${file}: invalid JSON, skipped`);
        process.exitCode = 1;
        continue;
      }

      const urls = collectSourceUrls(record);
      const checks = await checkAll(urls);
      const dead = checks.filter((check) => !check.ok);
      deadTotal += dead.length;

      console.log(`${dead.length === 0 ? "✓" : "✗"} ${file} — ${urls.length} URLs, ${dead.length} unreachable`);
      for (const check of dead) console.error(`    ${check.status}  ${check.url}`);
    }

    if (deadTotal > 0) process.exitCode = 1;
  },
};
