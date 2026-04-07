import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/route-handler-auth", () => ({
  requireRaBearerToken: vi.fn(),
}));

vi.mock("@/lib/server/route-handler-backend", () => ({
  fetchBackend: vi.fn(),
  throwIfBackendNotOk: vi.fn(async (response: Response) => {
    if (!response.ok) {
      throw new Error(`Backend /dashboard/study-window returned ${response.status}`);
    }
  }),
}));

import { fetchBackend } from "@/lib/server/route-handler-backend";
import { requireRaBearerToken } from "@/lib/server/route-handler-auth";
import { GET } from "./route";

describe("GET /api/ra/dashboard/study-window", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when auth fails", async () => {
    vi.mocked(requireRaBearerToken).mockResolvedValue({
      ok: false,
      response: NextResponse.json(
        { detail: "Missing Authorization header" },
        { status: 401, headers: { "x-ww-cache": "skip" } }
      ),
    });

    const response = await GET(
      new NextRequest("http://localhost/api/ra/dashboard/study-window")
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("x-ww-cache")).toBe("skip");
  });

  it("proxies the backend latest study day payload", async () => {
    vi.mocked(requireRaBearerToken).mockResolvedValue({ ok: true, token: "token" });
    vi.mocked(fetchBackend).mockResolvedValue(
      Response.json({ latest_study_day: "2026-03-11" })
    );

    const response = await GET(
      new NextRequest("http://localhost/api/ra/dashboard/study-window")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ latest_study_day: "2026-03-11" });
    expect(fetchBackend).toHaveBeenCalledOnce();
    expect(fetchBackend).toHaveBeenCalledWith("/dashboard/study-window", {
      token: "token",
      cache: "no-store",
    });
  });

  it("proxies null when the backend has no study days yet", async () => {
    vi.mocked(requireRaBearerToken).mockResolvedValue({ ok: true, token: "token" });
    vi.mocked(fetchBackend).mockResolvedValue(
      Response.json({ latest_study_day: null })
    );

    const response = await GET(
      new NextRequest("http://localhost/api/ra/dashboard/study-window")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ latest_study_day: null });
  });
});
