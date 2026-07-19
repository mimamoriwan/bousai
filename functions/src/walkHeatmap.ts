export const WALK_HEATMAP_CELL_SIZE_DEGREES = 0.0025;
export const WALK_HEATMAP_MIN_CONTRIBUTORS = 3;

export interface HeatmapCell {
  id: string;
  lat: number;
  lng: number;
}

export interface HeatmapCounts {
  actionCount: number;
  contributorCount: number;
  contributorActionCount: number;
}

const assertCoordinate = (value: number, min: number, max: number): void => {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error("Invalid heatmap coordinate");
  }
};

/**
 * 正確な位置を約250m四方のセルへ丸める。
 * 公開データにはセル中心だけを保存し、元の座標は含めない。
 */
export const getHeatmapCell = (lat: number, lng: number): HeatmapCell => {
  assertCoordinate(lat, -90, 90);
  assertCoordinate(lng, -180, 180);

  const latIndex = Math.floor((lat + 90) / WALK_HEATMAP_CELL_SIZE_DEGREES);
  const lngIndex = Math.floor((lng + 180) / WALK_HEATMAP_CELL_SIZE_DEGREES);
  const centerLat = -90 + (latIndex + 0.5) * WALK_HEATMAP_CELL_SIZE_DEGREES;
  const centerLng = -180 + (lngIndex + 0.5) * WALK_HEATMAP_CELL_SIZE_DEGREES;

  return {
    id: `${latIndex}_${lngIndex}`,
    lat: Number(centerLat.toFixed(6)),
    lng: Number(centerLng.toFixed(6)),
  };
};

/** UTC基準のISO週ID（例: 2026-W29）を返す。 */
export const getIsoWeekId = (date: Date): string => {
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid heatmap date");
  }

  const utcDate = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  ));
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${utcDate.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
};

/**
 * セル全体と1人分の件数を同時に更新する。
 * 同じ利用者が複数回記録しても contributorCount は1人のままにする。
 */
export const applyHeatmapCountDelta = (
  actionCount: number,
  contributorCount: number,
  contributorActionCount: number,
  delta: 1 | -1
): HeatmapCounts => {
  const previousUserCount = Math.max(0, contributorActionCount);
  const nextUserCount = Math.max(0, previousUserCount + delta);
  const contributorDelta = previousUserCount === 0 && nextUserCount > 0
    ? 1
    : previousUserCount > 0 && nextUserCount === 0
      ? -1
      : 0;

  return {
    actionCount: Math.max(0, actionCount + delta),
    contributorCount: Math.max(0, contributorCount + contributorDelta),
    contributorActionCount: nextUserCount,
  };
};

export const shouldPublishHeatmapCell = (counts: HeatmapCounts): boolean =>
  counts.contributorCount >= WALK_HEATMAP_MIN_CONTRIBUTORS &&
  counts.actionCount >= counts.contributorCount;
