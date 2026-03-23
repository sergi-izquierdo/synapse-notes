import { describe, it, expect, vi } from "vitest";
import { GET } from "./route";

describe("GET /api/version", () => {
  it("returns name, version, and environment", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.name).toBe("synapse-notes");
    expect(body.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(body.environment).toBe("test");
  });

  it("reflects NODE_ENV value", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    const response = await GET();
    const body = await response.json();

    expect(body.environment).toBe("production");

    process.env.NODE_ENV = originalEnv;
  });
});
