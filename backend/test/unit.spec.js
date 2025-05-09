// test/unit.spec.js
import {
  env,
  createExecutionContext,
  waitOnExecutionContext,
} from "cloudflare:test";
import { describe, it, expect } from "vitest";
import worker from "../src/index.js";

const IncomingRequest = Request;

describe("Hello World worker", () => {
  it("responds with Hello World!", async () => {
    const request = new IncomingRequest("http://example.com/");
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("Hello World!");
  });

  it("responds with not found for /404", async () => {
    const request = new IncomingRequest("http://example.com/404");
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not found");
  });
});
