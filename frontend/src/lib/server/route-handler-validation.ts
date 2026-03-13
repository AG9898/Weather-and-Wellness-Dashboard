export interface RouteDateRange {
  dateFrom: string;
  dateTo: string;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): boolean {
  return ISO_DATE_RE.test(value);
}

export function readRequiredDateRange(
  searchParams: URLSearchParams,
  options: { enforceOrder?: boolean } = {}
): { ok: true; value: RouteDateRange } | { ok: false; detail: string } {
  const dateFrom = searchParams.get("date_from") ?? "";
  const dateTo = searchParams.get("date_to") ?? "";

  if (!dateFrom || !dateTo) {
    return {
      ok: false,
      detail: "date_from and date_to are required",
    };
  }

  if (!isIsoDate(dateFrom) || !isIsoDate(dateTo)) {
    return {
      ok: false,
      detail: "date_from and date_to must be YYYY-MM-DD",
    };
  }

  if (options.enforceOrder && dateFrom > dateTo) {
    return {
      ok: false,
      detail: "date_from must not be after date_to",
    };
  }

  return {
    ok: true,
    value: { dateFrom, dateTo },
  };
}
