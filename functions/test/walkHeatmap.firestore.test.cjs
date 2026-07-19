const test = require('node:test');
const assert = require('node:assert/strict');
const { deleteApp, initializeApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { getHeatmapCell, getIsoWeekId } = require('../lib/walkHeatmap.js');
const { updateWalkHeatmap } = require('../lib/walkHeatmapStore.js');

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;

test('Firestore上で3人以上だけを公開し、削除時に非公開へ戻す', {
  skip: !emulatorHost,
}, async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const projectId = process.env.GCLOUD_PROJECT || 'demo-tsukuba-pet-bousai';
  const app = initializeApp({ projectId }, `walk-heatmap-integration-${suffix}`);
  const db = getFirestore(app);
  const lat = 35.6722;
  const lng = 139.7364;
  const createdAt = Timestamp.fromDate(new Date('2026-07-20T03:00:00Z'));
  const cell = getHeatmapCell(lat, lng);
  const periodId = getIsoWeekId(createdAt.toDate());
  const aggregateId = `${periodId}_${cell.id}`;
  const publicRef = db.doc(`walkHeatmapPeriods/${periodId}/cells/${cell.id}`);
  const internalRef = db.doc(`_walkHeatmapAggregates/${aggregateId}`);
  const userRefs = ['guest-a', 'guest-b', 'guest-c'].map((uid) =>
    db.doc(`_walkHeatmapContributions/${aggregateId}/users/${uid}`)
  );
  const eventIds = [
    `create-a1-${suffix}`,
    `create-a2-${suffix}`,
    `create-b-${suffix}`,
    `create-c-${suffix}`,
    `delete-c-${suffix}`,
  ];
  const eventRefs = eventIds.map((eventId) =>
    db.doc(`_walkHeatmapEvents/${eventId}`)
  );
  const actionFor = (uid) => ({
    uid,
    lat,
    lng,
    timestamp: createdAt.toMillis(),
    createdAt,
  });

  try {
    await updateWalkHeatmap(db, actionFor('guest-a'), 1, eventIds[0]);
    assert.equal((await publicRef.get()).exists, false);

    // 同じイベントが再配信されても、件数を重ねて加算しない。
    await updateWalkHeatmap(db, actionFor('guest-a'), 1, eventIds[0]);
    let internal = await internalRef.get();
    assert.equal(internal.data().actionCount, 1);
    assert.equal(internal.data().contributorCount, 1);

    // 同じ利用者の別記録は件数だけ増え、人数は増えない。
    await updateWalkHeatmap(db, actionFor('guest-a'), 1, eventIds[1]);
    internal = await internalRef.get();
    assert.equal(internal.data().actionCount, 2);
    assert.equal(internal.data().contributorCount, 1);
    assert.equal((await publicRef.get()).exists, false);

    await updateWalkHeatmap(db, actionFor('guest-b'), 1, eventIds[2]);
    assert.equal((await publicRef.get()).exists, false);

    await updateWalkHeatmap(db, actionFor('guest-c'), 1, eventIds[3]);
    const published = await publicRef.get();
    assert.equal(published.exists, true);
    assert.equal(published.data().actionCount, 4);
    assert.equal(published.data().contributorCount, 3);
    assert.equal(published.data().lat, cell.lat);
    assert.equal(published.data().lng, cell.lng);
    assert.notEqual(published.data().lat, lat);
    assert.notEqual(published.data().lng, lng);

    // 3人目の最後の記録を削除すると、公開しきい値未満へ戻る。
    await updateWalkHeatmap(db, actionFor('guest-c'), -1, eventIds[4]);
    assert.equal((await publicRef.get()).exists, false);
    internal = await internalRef.get();
    assert.equal(internal.data().actionCount, 3);
    assert.equal(internal.data().contributorCount, 2);
    assert.equal((await userRefs[2].get()).exists, false);
  } finally {
    await Promise.all([
      publicRef.delete().catch(() => {}),
      internalRef.delete().catch(() => {}),
      ...userRefs.map((ref) => ref.delete().catch(() => {})),
      ...eventRefs.map((ref) => ref.delete().catch(() => {})),
    ]);
    await deleteApp(app);
  }
});
