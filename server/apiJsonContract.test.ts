import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApiApp } from "./_core/apiApp";
import { ensureJsonApiResponse } from "../client/src/lib/guardedFetch";

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  server = createServer(createApiApp());
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not allocate API test port.");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

describe("tRPC JSON error contract", () => {
  it("returns a structured JSON 401 rather than an HTML page for a protected request without a session", async () => {
    const response = await fetch(`${baseUrl}/api/trpc/warehouse.requests.list?input=${encodeURIComponent(JSON.stringify({ json: null }))}`);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(body).toMatchObject({ error: { json: { data: { code: "UNAUTHORIZED", httpStatus: 401 } } } });
  });

  it("normalizes an unexpected HTML response into the tRPC JSON error shape", async () => {
    const normalized = await ensureJsonApiResponse(new Response("<html><head></head></html>", { status: 502, headers: { "content-type": "text/html" } }));
    const body = await normalized.json();

    expect(normalized.headers.get("content-type")).toContain("application/json");
    expect(normalized.status).toBe(502);
    expect(body[0]).toMatchObject({ error: { json: { data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 502 } } } });
  });
});
