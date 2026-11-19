import test from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_PIN_DRAFT, buildNewPin, quickPinDraft } from '../src/utils/pinDraft.js';

const position = { lat: 36.12345, lng: 140.12389 };
const user = { uid: 'author' };
const time = Date.UTC(2026, 10, 20, 1);

test('クイック投稿は位置を丸め、正確な目撃時刻は推測しない', () => {
    const pin = buildNewPin(quickPinDraft({ type: 'danger', title: 'ゴミが落ちてるよ' }), position, user, time);
    assert.deepEqual([pin.lat, pin.lng, pin.locationPrecision], [36.123, 140.124, 'area']);
    assert.equal(pin.isLitter, true);
    assert.equal(pin.observedAt, undefined);
});

test('非公開のメモは選んだ地点・複数タグ・明示した観察時刻を保存する', () => {
    const draft = { ...EMPTY_PIN_DRAFT, title: '並木', pinKind: 'memo', visibility: 'private',
        tags: ['地域', '秋'], observedLocal: '2026-11-19T09:00:00+09:00', isLitter: true };
    const pin = buildNewPin(draft, position, user, time);
    assert.equal(pin.lat, position.lat);
    assert.equal(pin.visibility, 'private');
    assert.deepEqual(pin.tags, ['地域', '秋']);
    assert.equal(pin.observedAt, Date.UTC(2026, 10, 19));
    assert.equal(pin.isLitter, false);
});
