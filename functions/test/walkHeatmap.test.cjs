const test = require('node:test');
const assert = require('node:assert/strict');

const {
  WALK_HEATMAP_CELL_SIZE_DEGREES,
  applyHeatmapCountDelta,
  getHeatmapCell,
  getIsoWeekId,
  shouldPublishHeatmapCell,
} = require('../lib/walkHeatmap.js');

test('正確な座標を約250mの同一セルへ丸める', () => {
  const first = getHeatmapCell(35.6722, 139.7364);
  const nearby = getHeatmapCell(35.6723, 139.7365);

  assert.equal(first.id, nearby.id);
  assert.equal(
    Math.abs(first.lat - 35.6722) <= WALK_HEATMAP_CELL_SIZE_DEGREES,
    true
  );
  assert.notEqual(first.lat, 35.6722);
  assert.notEqual(first.lng, 139.7364);
});

test('ISO週を年境界でも正しく求める', () => {
  assert.equal(getIsoWeekId(new Date('2026-07-19T00:00:00Z')), '2026-W29');
  assert.equal(getIsoWeekId(new Date('2021-01-01T00:00:00Z')), '2020-W53');
});

test('同じ利用者の連続記録は人数を増やさない', () => {
  const first = applyHeatmapCountDelta(0, 0, 0, 1);
  assert.deepEqual(first, {
    actionCount: 1,
    contributorCount: 1,
    contributorActionCount: 1,
  });

  const second = applyHeatmapCountDelta(
    first.actionCount,
    first.contributorCount,
    first.contributorActionCount,
    1
  );
  assert.deepEqual(second, {
    actionCount: 2,
    contributorCount: 1,
    contributorActionCount: 2,
  });
});

test('最後の記録を削除したときだけ人数を減らす', () => {
  const remaining = applyHeatmapCountDelta(5, 3, 2, -1);
  assert.deepEqual(remaining, {
    actionCount: 4,
    contributorCount: 3,
    contributorActionCount: 1,
  });

  const removed = applyHeatmapCountDelta(
    remaining.actionCount,
    remaining.contributorCount,
    remaining.contributorActionCount,
    -1
  );
  assert.deepEqual(removed, {
    actionCount: 3,
    contributorCount: 2,
    contributorActionCount: 0,
  });
});

test('3人以上になったセルだけを公開する', () => {
  assert.equal(shouldPublishHeatmapCell({
    actionCount: 4,
    contributorCount: 2,
    contributorActionCount: 1,
  }), false);
  assert.equal(shouldPublishHeatmapCell({
    actionCount: 5,
    contributorCount: 3,
    contributorActionCount: 1,
  }), true);
});
