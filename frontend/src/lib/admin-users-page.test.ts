import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function readFrontendFile(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("admin user management page wiring", () => {
  it("gates /users to admins and keeps the route behind RA middleware", () => {
    const page = readFrontendFile("src/app/(ra)/users/page.tsx");
    const middleware = readFrontendFile("src/middleware.ts");
    const floatingChrome = readFrontendFile("src/lib/components/RAFloatingChrome.tsx");

    expect(page).toContain('role !== "admin"');
    expect(page).toContain('router.replace("/unauthorized")');
    expect(middleware).toContain('"/users/:path*"');
    expect(floatingChrome).toContain('href: "/users"');
    expect(floatingChrome).toContain('adminOnly: true');
  });

  it("uses typed admin API wrappers for every management action", () => {
    const page = readFrontendFile("src/app/(ra)/users/page.tsx");

    expect(page).toContain("getAdminUsers");
    expect(page).toContain("createUserInvitation");
    expect(page).toContain("updateAdminUser");
    expect(page).toContain("resendUserInvitation");
    expect(page).toContain("revokeUserInvitation");
    expect(page).toContain("revokeAdminUserAccess");
    expect(page).not.toMatch(/\bfetch\s*\(/);
  });

  it("keeps destructive actions confirmed and avoids browser-visible invite secrets", () => {
    const page = readFrontendFile("src/app/(ra)/users/page.tsx");

    expect(page).toContain("window.confirm");
    expect(page).not.toContain("token_hash");
    expect(page).not.toContain("raw token");
    expect(page).not.toContain("service-role");
  });
});
