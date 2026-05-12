import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: { access_token: "test-token" } },
        error: null,
      })),
      signOut: vi.fn(),
    },
  },
}));

import {
  acceptInvitation,
  ApiError,
  createUserInvitation,
  getAdminUsers,
  resendUserInvitation,
  revokeAdminUserAccess,
  revokeUserInvitation,
  updateAdminUser,
} from "@/lib/api";
import {
  getInviteActivationCopy,
  getInviteActivationErrorState,
} from "@/lib/invitation-ui";

function readFrontendFile(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("admin invitation API wrappers", () => {
  it("accepts app-owned invite tokens through the public backend endpoint", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({
        email: "ra@example.com",
        role: "ra",
        lab_name: "ww",
        supabase_user_id: "user-1",
        status: "accepted",
      })
    );

    await expect(
      acceptInvitation({ token: "raw-invite-token-value", password: "password123" })
    ).resolves.toMatchObject({ status: "accepted", email: "ra@example.com" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/auth/invitations/accept",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: "raw-invite-token-value",
          password: "password123",
        }),
      })
    );
  });

  it("exposes typed admin user-management wrappers with RA auth headers", async () => {
    fetchMock
      .mockResolvedValueOnce(Response.json({ users: [], invitations: [] }))
      .mockResolvedValueOnce(Response.json({ invitation_id: "invite-1" }))
      .mockResolvedValueOnce(Response.json({ invitation_id: "invite-1" }))
      .mockResolvedValueOnce(Response.json({ invitation_id: "invite-1" }))
      .mockResolvedValueOnce(Response.json({ id: "user-1" }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    await getAdminUsers();
    await createUserInvitation({
      email: "ra@example.com",
      role: "ra",
      lab_name: "ww",
    });
    await resendUserInvitation("invite/1");
    await revokeUserInvitation("invite/1");
    await updateAdminUser("user/1", { role: "admin", lab_name: "ww" });
    await revokeAdminUserAccess("user/1");

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8000/admin/users",
      expect.objectContaining({
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-token",
        },
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:8000/admin/users/invitations/invite%2F1/resend",
      expect.objectContaining({ method: "POST" })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      6,
      "http://localhost:8000/admin/users/user%2F1/revoke-access",
      expect.objectContaining({ method: "POST" })
    );
  });
});

describe("set-password invite activation states", () => {
  it("maps backend invite failures to user-safe states", () => {
    expect(getInviteActivationErrorState(new ApiError(404, "missing"))).toBe(
      "invalid"
    );
    expect(getInviteActivationErrorState(new ApiError(410, "expired"))).toBe(
      "expired"
    );
    expect(getInviteActivationErrorState(new ApiError(409, "used"))).toBe(
      "unavailable"
    );
    expect(getInviteActivationErrorState(new ApiError(502, "activation failed"))).toBe(
      "delivery_error"
    );
  });

  it("renders clear copy for missing, invalid, expired, used, delivery, and success states", () => {
    expect(getInviteActivationCopy("missing").body).toContain("full invite link");
    expect(getInviteActivationCopy("invalid").title).toContain("invalid");
    expect(getInviteActivationCopy("expired").body).toContain("expired");
    expect(getInviteActivationCopy("unavailable").body).toContain("revoked");
    expect(getInviteActivationCopy("unavailable").body).toContain("accepted");
    expect(getInviteActivationCopy("delivery_error").body).toContain(
      "activation could not be completed"
    );
    expect(getInviteActivationCopy("success").body).toContain("Sign in");
  });

  it("submits through the typed wrapper and keeps normal login routing after activation", () => {
    const source = readFrontendFile("src/app/set-password/page.tsx");

    expect(source).toContain("acceptInvitation");
    expect(source).toContain('router.replace("/login")');
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toContain("supabase.auth.updateUser");
  });
});
