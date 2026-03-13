import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import {
  extractBearerToken,
  requireRaBearerToken,
} from "@/lib/server/route-handler-auth";

describe("extractBearerToken", () => {
  it("returns the bearer token when present", () => {
    const request = new NextRequest("http://localhost/api/ra/dashboard", {
      headers: { Authorization: "Bearer test-token" },
    });

    expect(extractBearerToken(request)).toBe("test-token");
  });

  it("returns null when the header is missing", () => {
    const request = new NextRequest("http://localhost/api/ra/dashboard");

    expect(extractBearerToken(request)).toBeNull();
  });
});

describe("requireRaBearerToken", () => {
  it("returns a 401 response when the authorization header is missing", async () => {
    const request = new NextRequest("http://localhost/api/ra/dashboard");

    const result = await requireRaBearerToken(request, {
      failureCacheState: "skip",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected auth failure");
    }

    expect(result.response.status).toBe(401);
    expect(result.response.headers.get("x-ww-cache")).toBe("skip");
    await expect(result.response.json()).resolves.toEqual({
      detail: "Missing Authorization header",
    });
  });
});

