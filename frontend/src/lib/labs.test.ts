import { describe, expect, it } from "vitest";

import {
  ADMIN_DOCK_ITEMS,
  LAB_REGISTRY,
  buildDockItems,
  canAccessLab,
  normalizeLabSlug,
  resolveAvailableLabs,
  resolveInitialActiveLab,
} from "@/lib/labs";

describe("normalizeLabSlug", () => {
  it("recognizes known slugs case-insensitively", () => {
    expect(normalizeLabSlug("ww")).toBe("ww");
    expect(normalizeLabSlug("IHTT")).toBe("ihtt");
    expect(normalizeLabSlug(" ww ")).toBe("ww");
  });

  it("returns null for unknown or empty values", () => {
    expect(normalizeLabSlug("")).toBeNull();
    expect(normalizeLabSlug(null)).toBeNull();
    expect(normalizeLabSlug("psych")).toBeNull();
  });
});

describe("resolveAvailableLabs", () => {
  it("gives admins every lab", () => {
    expect(resolveAvailableLabs("admin", "ww")).toEqual(["ww", "ihtt"]);
    expect(resolveAvailableLabs("admin", "")).toEqual(["ww", "ihtt"]);
  });

  it("pins a regular RA to their single lab", () => {
    expect(resolveAvailableLabs("ra", "ihtt")).toEqual(["ihtt"]);
    expect(resolveAvailableLabs("ra", "ww")).toEqual(["ww"]);
  });

  it("falls back to the default lab for an unrecognized RA lab", () => {
    expect(resolveAvailableLabs("ra", "")).toEqual(["ww"]);
  });
});

describe("resolveInitialActiveLab", () => {
  it("starts a regular RA on their own lab regardless of stored value", () => {
    expect(resolveInitialActiveLab("ra", "ihtt", "ww")).toBe("ihtt");
    expect(resolveInitialActiveLab("ra", "ww", "ihtt")).toBe("ww");
  });

  it("restores an admin's stored lab when valid", () => {
    expect(resolveInitialActiveLab("admin", "ww", "ihtt")).toBe("ihtt");
  });

  it("defaults an admin to their own lab when storage is empty or invalid", () => {
    expect(resolveInitialActiveLab("admin", "ihtt", null)).toBe("ihtt");
    expect(resolveInitialActiveLab("admin", "ww", "bogus")).toBe("ww");
  });
});

describe("canAccessLab", () => {
  it("lets a matching RA in and keeps an out-of-lab RA out", () => {
    expect(canAccessLab("ra", "ww", "ww")).toBe(true);
    expect(canAccessLab("ra", "ihtt", "ihtt")).toBe(true);
    expect(canAccessLab("ra", "ihtt", "ww")).toBe(false);
    expect(canAccessLab("ra", "ww", "ihtt")).toBe(false);
  });

  it("lets admins into every lab", () => {
    expect(canAccessLab("admin", "ww", "ihtt")).toBe(true);
    expect(canAccessLab("admin", "", "ww")).toBe(true);
  });
});

describe("buildDockItems", () => {
  it("scopes the dock to the active lab for a regular RA", () => {
    const wwHrefs = buildDockItems("ww", "ra").map((item) => item.href);
    expect(wwHrefs).toEqual(["/dashboard", "/chat", "/misokinesia"]);

    const ihttHrefs = buildDockItems("ihtt", "ra").map((item) => item.href);
    // IHTT lands on Poffenberger as its dashboard; no chat or misokinesia.
    expect(ihttHrefs).toEqual(["/ihtt/poffenberger"]);
  });

  it("uses Dashboard as the IHTT landing label", () => {
    expect(LAB_REGISTRY.ihtt.items[0]).toMatchObject({
      href: "/ihtt/poffenberger",
      label: "Dashboard",
    });
  });

  it("appends admin items for admins only", () => {
    const adminHrefs = buildDockItems("ihtt", "admin").map((item) => item.href);
    ADMIN_DOCK_ITEMS.forEach((item) => {
      expect(adminHrefs).toContain(item.href);
    });
    const raHrefs = buildDockItems("ihtt", "ra").map((item) => item.href);
    ADMIN_DOCK_ITEMS.forEach((item) => {
      expect(raHrefs).not.toContain(item.href);
    });
  });
});
