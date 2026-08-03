import { describe, expect, it } from "vitest";
import { checkUrl } from "./commands/check-sources.ts";

describe("checkUrl", () => {
  it("reports ok for a 200 response", async () => {
    const fakeFetch = (async () => new Response(null, { status: 200 })) as typeof fetch;
    expect(await checkUrl("https://example.com/a", fakeFetch)).toEqual({
      url: "https://example.com/a",
      ok: true,
      status: 200,
    });
  });

  it("retries with GET when HEAD is rejected, since many hosts return 405 for HEAD", async () => {
    const methods: string[] = [];
    const fakeFetch = (async (_url: string, init?: RequestInit) => {
      methods.push(init?.method ?? "GET");
      return new Response(null, { status: methods.length === 1 ? 405 : 200 });
    }) as unknown as typeof fetch;

    const result = await checkUrl("https://example.com/b", fakeFetch);
    expect(methods).toEqual(["HEAD", "GET"]);
    expect(result.ok).toBe(true);
  });

  it("reports not-ok for a 404", async () => {
    const fakeFetch = (async () => new Response(null, { status: 404 })) as typeof fetch;
    const result = await checkUrl("https://example.com/missing", fakeFetch);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
  });

  it("reports a network error as not-ok without throwing", async () => {
    const fakeFetch = (async () => {
      throw new Error("ENOTFOUND");
    }) as typeof fetch;
    const result = await checkUrl("https://nope.invalid", fakeFetch);
    expect(result.ok).toBe(false);
    expect(String(result.status)).toContain("ENOTFOUND");
  });
});
