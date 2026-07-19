import {
  FieldValue,
  Firestore,
  Timestamp,
} from "firebase-admin/firestore";
import {
  applyHeatmapCountDelta,
  getHeatmapCell,
  getIsoWeekId,
  shouldPublishHeatmapCell,
} from "./walkHeatmap.js";

export interface WalkActionDocument {
  uid?: unknown;
  lat?: unknown;
  lng?: unknown;
  createdAt?: unknown;
  timestamp?: unknown;
}

const getWalkActionDate = (data: WalkActionDocument): Date => {
  if (data.createdAt instanceof Timestamp) {
    return data.createdAt.toDate();
  }
  if (typeof data.timestamp === "number" && Number.isFinite(data.timestamp)) {
    return new Date(data.timestamp);
  }
  return new Date();
};

const sanitizeEventId = (eventId: string): string =>
  eventId.replace(/[^a-zA-Z0-9_-]/g, "_");

/**
 * 本人専用の正確なwalkActionsを、公開可能な週・約250mセルへ集約する。
 * UIDごとの内訳は非公開コレクションに分離し、公開セルには人数と件数だけを保存する。
 *
 * @returns 入力が有効で処理対象になった場合はtrue。不正な入力はfalse。
 */
export const updateWalkHeatmap = async (
  db: Firestore,
  data: WalkActionDocument,
  delta: 1 | -1,
  eventId: string
): Promise<boolean> => {
  if (
    typeof data.uid !== "string" || data.uid.length === 0 ||
    typeof data.lat !== "number" || typeof data.lng !== "number"
  ) {
    return false;
  }

  const cell = getHeatmapCell(data.lat, data.lng);
  const periodId = getIsoWeekId(getWalkActionDate(data));
  const publicAggregateRef = db.doc(
    `walkHeatmapPeriods/${periodId}/cells/${cell.id}`
  );
  const internalAggregateRef = db.doc(
    `_walkHeatmapAggregates/${periodId}_${cell.id}`
  );
  const contributionRef = db.doc(
    `_walkHeatmapContributions/${periodId}_${cell.id}/users/${data.uid}`
  );
  const eventRef = db.doc(
    `_walkHeatmapEvents/${sanitizeEventId(eventId)}`
  );

  await db.runTransaction(async (transaction) => {
    const [eventSnapshot, aggregateSnapshot, contributionSnapshot] =
      await Promise.all([
        transaction.get(eventRef),
        transaction.get(internalAggregateRef),
        transaction.get(contributionRef),
      ]);

    if (eventSnapshot.exists) return;

    const aggregate = aggregateSnapshot.data() ?? {};
    const contribution = contributionSnapshot.data() ?? {};
    const counts = applyHeatmapCountDelta(
      typeof aggregate.actionCount === "number" ? aggregate.actionCount : 0,
      typeof aggregate.contributorCount === "number" ? aggregate.contributorCount : 0,
      typeof contribution.actionCount === "number" ? contribution.actionCount : 0,
      delta
    );

    if (counts.actionCount === 0) {
      transaction.delete(internalAggregateRef);
      transaction.delete(publicAggregateRef);
    } else {
      const aggregateData = {
        periodId,
        cellId: cell.id,
        lat: cell.lat,
        lng: cell.lng,
        actionCount: counts.actionCount,
        contributorCount: counts.contributorCount,
        updatedAt: FieldValue.serverTimestamp(),
      };
      transaction.set(internalAggregateRef, aggregateData);
      if (shouldPublishHeatmapCell(counts)) {
        transaction.set(publicAggregateRef, aggregateData);
      } else {
        transaction.delete(publicAggregateRef);
      }
    }

    if (counts.contributorActionCount === 0) {
      transaction.delete(contributionRef);
    } else {
      transaction.set(contributionRef, {
        actionCount: counts.contributorActionCount,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    transaction.create(eventRef, {
      processedAt: FieldValue.serverTimestamp(),
      periodId,
      cellId: cell.id,
      delta,
    });
  });

  return true;
};
