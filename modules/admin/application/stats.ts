export type TrendDirection = "up" | "down" | "neutral";

function percentageDelta(current: number, previous: number): number {
  if (previous === 0) {
    return current === 0 ? 0 : 100;
  }
  return ((current - previous) / Math.abs(previous)) * 100;
}

function trendFromDelta(delta: number): TrendDirection {
  if (delta > 1) return "up";
  if (delta < -1) return "down";
  return "neutral";
}

export function buildDelta(current: number, previous: number): {
  delta: number;
  trend: TrendDirection;
} {
  const delta = Number(percentageDelta(current, previous).toFixed(1));
  return {
    delta,
    trend: trendFromDelta(delta),
  };
}
