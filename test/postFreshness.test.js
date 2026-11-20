import test from 'node:test';
import assert from 'node:assert/strict';
import {
    canCleanPin, canReconfirmPin, getPinPresentation, isLitterPin,
    isPostArchived, isSeasonalMemoActive, nextPinTransition, pinMatchesTag,
} from '../src/utils/postFreshness.js';

const timestamp = Date.UTC(2026, 0, 1);
const day = 24 * 60 * 60 * 1000;
const after48Hours = Date.UTC(2026, 0, 3);
const after14Days = Date.UTC(2026, 0, 15);
const alert = { type: 'danger', visibility: 'public', timestamp };
const firestoreTime = (time) => ({ toMillis: () => time });

test('通常の注意ピンは24時間で薄くなり、48時間を超えると記録に移る', () => {
    const post = { type: 'danger', timestamp };
    assert.equal(getPinPresentation(post, timestamp + day - 1).phase, 'fresh');
    assert.equal(getPinPresentation(post, timestamp + day).phase, 'faded');
    assert.equal(getPinPresentation(post, after48Hours).phase, 'faded');
    assert.equal(isPostArchived(post, 'all', after48Hours), false);
    assert.equal(isPostArchived(post, 'all', after48Hours + 1), true);
    assert.equal(isPostArchived(post, 'danger', after48Hours + 1), true);
});

test('従来の植物投稿は植物フィルターでのみ14日間まで控えめに表示する', () => {
    const post = { type: 'plant', timestamp };
    assert.equal(getPinPresentation(post, after48Hours + 1, 'plant').phase, 'faded');
    assert.equal(getPinPresentation(post, after14Days, 'plant').phase, 'faded');
    assert.equal(isPostArchived(post, 'plant', after14Days), false);
    assert.equal(isPostArchived(post, 'plant', after14Days + 1), true);
    assert.equal(isPostArchived(post, 'all', after48Hours + 1), true);
    assert.equal(isPostArchived({ type: 'danger', timestamp }, 'plant', after48Hours + 1), true);
    assert.equal(isPostArchived({ ...post, pinKind: 'alert' }, 'plant', after48Hours + 1), true);
});

test('投稿時刻が記録されていない場合は過去情報にしない', () => {
    assert.equal(isPostArchived({ type: 'danger' }, 'all', after14Days), false);
    assert.equal(isPostArchived({ type: 'danger', timestamp: 0 }, 'all', after14Days), false);
    for (const invalid of [undefined, null, 0, NaN, 'invalid']) {
        assert.deepEqual(getPinPresentation({ timestamp: invalid }, after14Days),
            { phase: 'faded', time: null, label: '日付不明' });
    }
    assert.deepEqual(getPinPresentation({ createdAt: firestoreTime(timestamp) }, after14Days),
        { phase: 'archived', time: timestamp, label: '投稿' });
});

test('再確認時刻から24時間ちょうどまで通常表示し、直後に記録に移る', () => {
    const confirmedAt = timestamp + day + 3 * 60 * 60 * 1000;
    for (const value of [confirmedAt, firestoreTime(confirmedAt)]) {
        const post = { ...alert, confirmedAt: value };
        assert.deepEqual(getPinPresentation(post, confirmedAt + day),
            { phase: 'fresh', time: confirmedAt, label: '再確認' });
        assert.deepEqual(getPinPresentation(post, confirmedAt + day + 1),
            { phase: 'archived', time: confirmedAt, label: '再確認' });
    }
});

test('端末の時計がずれていても、サーバーの作成時刻で表示と再確認期限をそろえる', () => {
    const pin = { ...alert, timestamp: after48Hours, createdAt: firestoreTime(timestamp) };
    assert.deepEqual(getPinPresentation(pin, timestamp + day),
        { phase: 'faded', time: timestamp, label: '投稿' });
    assert.equal(canReconfirmPin(pin, timestamp + day), true);
    assert.equal(canReconfirmPin(pin, after48Hours + 1), false);
    assert.equal(nextPinTransition(pin, timestamp), timestamp + day);
    assert.equal(getPinPresentation({ ...pin, createdAt: null }, after48Hours).time, after48Hours);
});

test('清掃完了は他の状態より優先し、24時間を過ぎても清掃時刻を記録に残す', () => {
    const cleanedAt = after48Hours;
    const post = { ...alert, pinKind: 'memo', resolved: true, confirmedAt: timestamp + day,
        cleanedAt: firestoreTime(cleanedAt), tags: ['冬'] };
    assert.deepEqual(getPinPresentation(post, cleanedAt + day),
        { phase: 'cleaned', time: cleanedAt, label: '清掃完了' });
    assert.deepEqual(getPinPresentation(post, cleanedAt + day + 1),
        { phase: 'archived', time: cleanedAt, label: '清掃完了' });
    assert.equal(isSeasonalMemoActive(post, cleanedAt + day + 1), false);
    const legacyResolved = getPinPresentation({ ...alert, resolved: true, confirmedAt: after48Hours }, after14Days);
    assert.equal(legacyResolved.phase, 'resolved');
    assert.equal(legacyResolved.time, timestamp);
});

test('目撃日時は投稿日時と区別し、感謝・保存は表示期限を延長しない', () => {
    const observedAt = timestamp - day;
    const post = { ...alert, observedAt, thanks: ['reader'], savedBy: ['reader'], updatedAt: after14Days };
    assert.deepEqual(getPinPresentation(post, timestamp),
        { phase: 'fresh', time: observedAt, label: '現地で見た日時' });
    assert.deepEqual(getPinPresentation(post, after48Hours + 1),
        { phase: 'archived', time: observedAt, label: '現地で見た日時' });
});

test('メモには観察時刻か投稿日を表示し、複数タグは個別に絞り込める', () => {
    const memo = { pinKind: 'memo', timestamp, tags: ['秋', '雨の日', '非対応タグ'] };
    assert.deepEqual(getPinPresentation(memo, after14Days),
        { phase: 'memo', time: timestamp, label: 'メモの投稿日' });
    assert.deepEqual(getPinPresentation({ ...memo, observedAt: timestamp - day }, after14Days),
        { phase: 'memo', time: timestamp - day, label: '現地で見た日時' });
    assert.equal(pinMatchesTag(memo, 'all'), true);
    assert.equal(pinMatchesTag(memo, '雨の日'), true);
    assert.equal(pinMatchesTag(memo, '秋'), true);
    assert.equal(pinMatchesTag(memo, '地域'), false);
    assert.equal(pinMatchesTag(memo, '非対応タグ'), false);
    assert.equal(pinMatchesTag({ ...memo, tags: '春' }, '春'), false);
});

test('次回の表示更新は目撃時刻に左右されず、各境界で状態が変わる', () => {
    const post = { ...alert, observedAt: timestamp - day };
    const transitions = [
        [post, timestamp, 'all', timestamp + day],
        [post, after48Hours, 'all', after48Hours + 1],
        [{ ...post, confirmedAt: after48Hours + 0.5 }, after48Hours + day, 'all', after48Hours + day + 1],
        [{ ...post, cleanedAt: after48Hours }, after48Hours, 'all', after48Hours + day + 1],
        [{ type: 'plant', timestamp }, after48Hours, 'plant', after14Days + 1],
    ];
    for (const [pin, now, filter, expected] of transitions) {
        assert.equal(nextPinTransition(pin, now, filter), expected);
        assert.notEqual(getPinPresentation(pin, expected - 1, filter).phase,
            getPinPresentation(pin, expected, filter).phase);
    }
    assert.equal(nextPinTransition(post, after14Days), null);
    assert.equal(nextPinTransition({ type: 'danger' }, after48Hours), null);
    assert.equal(nextPinTransition({ ...alert, pinKind: 'memo' }, timestamp), null);
});

test('季節メモは日本時間の月で切り替わり、地域・雨の日だけのメモは記録に残る', () => {
    const memo = { pinKind: 'memo', timestamp };
    for (const [month, season, previous] of [[3, '春', '冬'], [6, '夏', '春'], [9, '秋', '夏'], [12, '冬', '秋']]) {
        const boundary = Date.UTC(2027, month - 1, 1) - 9 * 60 * 60 * 1000;
        assert.equal(isSeasonalMemoActive({ ...memo, tags: [previous] }, boundary - 1), true);
        assert.equal(isSeasonalMemoActive({ ...memo, tags: [previous] }, boundary), false);
        assert.equal(isSeasonalMemoActive({ ...memo, tags: ['雨の日', season] }, boundary), true);
    }
    assert.equal(isSeasonalMemoActive({ ...memo, tags: ['地域', '雨の日'] }, timestamp), false);
    assert.equal(isSeasonalMemoActive({ ...alert, tags: ['冬'] }, timestamp), false);
});

test('再確認は公開の注意ピンで、薄くなった24〜48時間の間だけ受け付ける', () => {
    assert.equal(canReconfirmPin(alert, timestamp + day - 1), false);
    assert.equal(canReconfirmPin(alert, timestamp + day), true);
    assert.equal(canReconfirmPin(alert, after48Hours), true);
    assert.equal(canReconfirmPin(alert, after48Hours + 1), false);
    assert.equal(canReconfirmPin({ ...alert, timestamp: null, createdAt: firestoreTime(timestamp) }, after48Hours), true);
    assert.equal(canReconfirmPin({ ...alert, timestamp: null }, after48Hours), false);
    assert.equal(canReconfirmPin({ ...alert, confirmedAt: timestamp + day }, after48Hours), false);
    assert.equal(canReconfirmPin({ ...alert, type: 'plant' }, after48Hours), true);
    assert.equal(canReconfirmPin({ ...alert, type: 'plant' }, after48Hours + 1), false);
    assert.equal(canReconfirmPin({ ...alert, type: 'others' }, after48Hours), false);
    assert.equal(canReconfirmPin({ ...alert, type: 'others', pinKind: 'alert' }, after48Hours), true);
});

test('清掃報告は期限を設けず明示されたゴミまたは旧クイック投稿で受け付ける', () => {
    const litter = { ...alert, title: 'ゴミが落ちてるよ' };
    assert.equal(canCleanPin(litter), true);
    assert.equal(canCleanPin({ ...litter, isLitter: false }), false);
    assert.equal(isLitterPin({ title: 'ゴミが落ちてるよ？' }), false);
    assert.equal(canCleanPin({ ...alert, isLitter: true, confirmedAt: after48Hours }), true);
    assert.equal(canCleanPin({ ...litter, type: 'plant', pinKind: 'alert' }), false);
    for (const changes of [{ visibility: 'private' }, { type: 'others' }, { resolved: true },
        { cleanedAt: timestamp }, { pinKind: 'memo' }, { pinKind: 'unknown' }]) {
        assert.equal(canCleanPin({ ...litter, ...changes }), false);
        assert.equal(canReconfirmPin({ ...litter, ...changes }, after48Hours), false);
    }
});
