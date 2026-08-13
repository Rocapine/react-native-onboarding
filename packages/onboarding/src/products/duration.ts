// Store-standard ISO-8601 subscription periods only: P1W / P1M / P3M / P1Y / P7D.
// Time components (PT1H) are not subscription periods and are rejected rather
// than silently coerced — a wrong period would corrupt every per-period price.
const ISO_PERIOD = /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?$/;

const DAYS_PER = { year: 365, month: 30, week: 7, day: 1 } as const;

/** ISO-8601 period → whole days. `null` when unparseable or empty (bare "P"). */
export const parseIsoDuration = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  const m = ISO_PERIOD.exec(iso);
  if (!m) return null;
  const [, y, mo, w, d] = m;
  if (!y && !mo && !w && !d) return null;
  return (
    Number(y ?? 0) * DAYS_PER.year +
    Number(mo ?? 0) * DAYS_PER.month +
    Number(w ?? 0) * DAYS_PER.week +
    Number(d ?? 0) * DAYS_PER.day
  );
};
