import { describe, expect, it } from "vitest";

import {
  isIsoDate,
  readRequiredDateRange,
} from "@/lib/server/route-handler-validation";

describe("isIsoDate", () => {
  it("accepts YYYY-MM-DD values", () => {
    expect(isIsoDate("2026-03-12")).toBe(true);
  });

  it("rejects non-ISO date strings", () => {
    expect(isIsoDate("03/12/2026")).toBe(false);
  });
});

describe("readRequiredDateRange", () => {
  it("returns a missing-parameter error when either date is absent", () => {
    const result = readRequiredDateRange(
      new URLSearchParams({ date_from: "2026-03-01" })
    );

    expect(result).toEqual({
      ok: false,
      detail: "date_from and date_to are required",
    });
  });

  it("returns a format error when a date is not YYYY-MM-DD", () => {
    const result = readRequiredDateRange(
      new URLSearchParams({
        date_from: "2026-03-01",
        date_to: "03/12/2026",
      })
    );

    expect(result).toEqual({
      ok: false,
      detail: "date_from and date_to must be YYYY-MM-DD",
    });
  });

  it("returns an ordering error when enforceOrder is enabled", () => {
    const result = readRequiredDateRange(
      new URLSearchParams({
        date_from: "2026-03-12",
        date_to: "2026-03-01",
      }),
      { enforceOrder: true }
    );

    expect(result).toEqual({
      ok: false,
      detail: "date_from must not be after date_to",
    });
  });

  it("returns parsed dates when the range is valid", () => {
    const result = readRequiredDateRange(
      new URLSearchParams({
        date_from: "2026-03-01",
        date_to: "2026-03-12",
      }),
      { enforceOrder: true }
    );

    expect(result).toEqual({
      ok: true,
      value: {
        dateFrom: "2026-03-01",
        dateTo: "2026-03-12",
      },
    });
  });
});

