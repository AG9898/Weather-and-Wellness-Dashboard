# HISTORICAL_WEATHER_BACKFILL.md — Open-Meteo Historical Weather Backfill

> Canonical spec for the Open-Meteo historical weather backfill feature (planned).
> This document defines the external data source, field mappings, precedence rules,
> timezone handling, DB writes, and idempotency guarantees.
>
> Related docs:
> - API contract: `docs/API.md` (Weather section — `POST /weather/backfill/historical`)
> - Schema: `docs/SCHEMA.md` (`weather_daily.sunshine_duration_hours`)
> - UBC EOS live ingest: `docs/WEATHER_INGESTION.md`

---

## Goal

The UBC EOS scraper (`POST /weather/ingest/ubc-eos`) only captures current-day conditions.
Legacy import data partially fills historical gaps with temperature and precipitation, but
leaves humidity and sunshine null. This backfill fetches all three missing focal-point variables
— **temperature, relative humidity, and sunshine duration** — from the Open-Meteo Archive API
for dates from 2025-01-01 onward, making the dashboard's weather trend graph continuous.

---

## Non-goals (explicit)

- Do not backfill dates before 2025-01-01 (outside study period).
- Do not overwrite temperature or precipitation sourced from the import feature.
- Do not replace UBC EOS live rows; they are the highest-quality data source.
- Do not store hourly data (daily aggregates only).
- Do not require an API key or any registration.

---

## Data Source

### Open-Meteo Archive API

| Property | Value |
|---|---|
| Endpoint | `https://archive-api.open-meteo.com/v1/archive` |
| Cost | Free; no API key required |
| Rate limit | 10 000 requests/day (entire 2025-to-present range = 1 request) |
| Data availability | Historical data from 1940; current data lagged ~2–5 days |
| Coverage | Global ERA5-based reanalysis; coordinates-based (no station selection) |

### Coordinates

**UBC main campus:** `latitude=49.2606`, `longitude=-123.2460`

This is approximately 2 km from UBC EOS weather station 3510 and is close enough for
daily aggregate temperature, humidity, precipitation, and sunshine comparisons.

---

## Timezone Handling

**Critical:** all `weather_daily` rows store dates as `date_local DATE` in `America/Vancouver`
(matching `study_days.date_local`). Open-Meteo is queried with `&timezone=America%2FVancouver`,
which makes its `daily.time` array return ISO date strings anchored to the local Vancouver
calendar day.

Example: a day that ends at `2025-01-15 08:00 UTC` is `2025-01-14` in UTC but `2025-01-15`
in `America/Vancouver` (UTC−8 in winter). Open-Meteo with `timezone=America/Vancouver`
returns it as `"2025-01-15"`, which matches our `date_local` exactly.

**Consequence:** the `daily.time` strings from Open-Meteo can be used directly as `date_local`
values. No timezone conversion is needed in the service code.

This is consistent with:
- UBC EOS ingest: `date_local` derived from `datetime.now(UTC)` converted to `America/Vancouver`.
- Import commits: sessions anchored to `date_local` in `America/Vancouver`.

---

## Request Format

Single HTTP GET to fetch all data in one call:

```
GET https://archive-api.open-meteo.com/v1/archive
  ?latitude=49.2606
  &longitude=-123.2460
  &start_date=2025-01-01
  &end_date=2026-03-03
  &daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean,
         relative_humidity_2m_mean,precipitation_sum,sunshine_duration
  &timezone=America%2FVancouver
```

### Response shape

```json
{
  "latitude": 49.2606,
  "longitude": -123.2460,
  "timezone": "America/Vancouver",
  "daily_units": {
    "time": "iso8601",
    "temperature_2m_mean": "°C",
    "temperature_2m_max": "°C",
    "temperature_2m_min": "°C",
    "relative_humidity_2m_mean": "%",
    "precipitation_sum": "mm",
    "sunshine_duration": "s"
  },
  "daily": {
    "time": ["2025-01-01", "2025-01-02", ...],
    "temperature_2m_mean": [2.0, 3.1, ...],
    "temperature_2m_max": [5.2, 6.0, ...],
    "temperature_2m_min": [-1.3, 0.5, ...],
    "relative_humidity_2m_mean": [82, 78, ...],
    "precipitation_sum": [3.1, 0.0, ...],
    "sunshine_duration": [0, 14400, ...]
  }
}
```

`sunshine_duration` is in **seconds**. Divide by 3600 to get hours.

---

## Field Mapping to `weather_daily`

| Open-Meteo variable | `weather_daily` column | Notes |
|---|---|---|
| `temperature_2m_mean` | `current_temp_c` | Daily mean (°C) |
| `temperature_2m_max` | `forecast_high_c` | Daily high (°C) |
| `temperature_2m_min` | `forecast_low_c` | Daily low (°C) |
| `relative_humidity_2m_mean` | `current_relative_humidity_pct` | Cast to `int` (0–100) |
| `precipitation_sum` | `current_precip_today_mm` | Daily total (mm) |
| `sunshine_duration` ÷ 3600 | `sunshine_duration_hours` | Hours of sunshine (0–24); new column |

Fields not populated by this backfill (remain null or as-is):
`current_observed_at`, `current_wind_speed_kmh`, `current_wind_gust_kmh`,
`current_wind_dir_deg`, `current_pressure_kpa`, `forecast_precip_prob_pct`,
`forecast_precip_mm`, `forecast_condition_text`, `forecast_periods`, `structured_json`.

---

## Precedence Rules

For each date returned by Open-Meteo, the backfill checks the existing `weather_daily` row
(if any) for station 3510 by joining to `weather_ingest_runs` via `source_run_id`:

### Case A — No existing row

Insert a full `weather_daily` row with all 6 mapped fields above.
- Get-or-create a `study_days` row for `date_local` (same as live ingest).
- Insert one `weather_ingest_runs` audit row.
- Use `ON CONFLICT DO NOTHING` as an idempotency guard.
- Counted in `days_inserted`.

### Case B — Import-sourced row (`parser_version = "legacy-import-v1"`)

The import backfill already set `current_temp_c` and `current_precip_today_mm`.
Update **only null fields** using `COALESCE(existing_value, new_value)`:
- `current_relative_humidity_pct`
- `sunshine_duration_hours`
- `forecast_high_c`
- `forecast_low_c`

`current_temp_c` and `current_precip_today_mm` are **never overwritten**.
Insert one `weather_ingest_runs` audit row.
Counted in `days_enhanced`.

### Case C — Live UBC EOS row (`parser_version = "ubc-eos-v1"`)

Skip entirely. UBC EOS live data is the highest-fidelity source for the study.
Counted in `days_skipped`.

**Priority summary (highest to lowest):**
1. UBC EOS live ingest (`ubc-eos-v1`) — never touched
2. Legacy import temperature/precipitation (`legacy-import-v1`) — never overwritten
3. Open-Meteo historical backfill (`open-meteo-v1`) — fills all other gaps

---

## Audit Trail

One `weather_ingest_runs` row is written per **affected** day (Case A or B):

| Field | Value |
|---|---|
| `requested_via` | `"historical_api_backfill"` |
| `parser_version` | `"open-meteo-v1"` |
| `source_primary_url` | The Open-Meteo URL used for that batch call |
| `source_secondary_url` | `""` (no secondary source) |
| `parse_status` | `"success"` |
| `parsed_json` | Summary dict of the mapped day's values |
| `raw_html_primary` / `raw_html_secondary` | `null` (JSON API, no HTML) |

---

## Idempotency

- Case A insert uses `ON CONFLICT DO NOTHING` on `UNIQUE (station_id, study_day_id)`.
- Case B update uses `COALESCE` so re-running does not change already-populated columns.
- Running the backfill twice over the same date range returns `days_inserted=0, days_enhanced=0, days_skipped=N`.

---

## API Endpoint Summary

```
POST /weather/backfill/historical
Authorization: Bearer <supabase-jwt>   (LabMember required)
Content-Type: application/json

{
  "start_date": "2025-01-01",   // optional; defaults to 2025-01-01
  "end_date":   "2026-03-03",   // optional; defaults to today (America/Vancouver)
  "station_id": 3510            // optional; defaults to 3510
}
```

Response:

```json
{
  "days_inserted": 210,
  "days_enhanced": 109,
  "days_skipped": 3
}
```

Errors:
- `422` — `start_date > end_date`, or date range exceeds 400 days.
- `401` — missing or invalid JWT.
- `502` — Open-Meteo API returned a non-2xx response (with detail message).

---

## Schema Addition Required

Before deploying this feature, apply a migration to add the new column:

```sql
ALTER TABLE weather_daily
  ADD COLUMN sunshine_duration_hours DOUBLE PRECISION NULL;
```

Migration file: `backend/alembic/versions/20260303_000001_add_sunshine_duration.py`

See `docs/SCHEMA.md` — `weather_daily` table for the full column reference.

---

## Implementation Files

| File | Change |
|---|---|
| `backend/alembic/versions/20260303_000001_add_sunshine_duration.py` | New migration |
| `backend/app/models/weather.py` | Add `sunshine_duration_hours` to `WeatherDaily` ORM model |
| `backend/app/schemas/weather.py` | Add `sunshine_duration_hours: float \| None` to `WeatherDailyItem` |
| `backend/app/services/historical_weather_service.py` | New — Open-Meteo fetch + parse |
| `backend/app/services/historical_weather_backfill_service.py` | New — precedence logic + DB writes |
| `backend/app/routers/weather.py` | Add `POST /weather/backfill/historical` endpoint |
| `frontend/src/lib/api/index.ts` | Add `sunshine_duration_hours` to `WeatherDailyItem` TypeScript type |
| `frontend/src/lib/components/WeatherTrendChart.tsx` | Optional: add sunshine line to trend chart |
