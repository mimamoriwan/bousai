import assert from 'node:assert/strict';
import test from 'node:test';
import { selectVisibleMapPins } from '../src/utils/visibleMapPins.js';

const now = Date.UTC(2026, 3, 12, 0);
const day = 86_400_000;
const base = { visibility: 'public', type: 'danger', timestamp: now - day * 3 };
function select(posts, options = {}) {
    return selectVisibleMapPins(posts, {
        activeMapLayer: 'public', uid: 'me', userHash: 'my-hash', filter: 'all', recordView: false, tags: [], now,
        ...options,
    }).map(({ post }) => post.id);
}

test('live and records show the correct phases, including cleared and legacy resolved pins', () => {
    const posts = [
        { ...base, id: 'archived' },
        { ...base, id: 'confirmed', confirmedAt: now - 100 },
        { ...base, id: 'cleaned', resolved: true, cleanedAt: now - 200, cleanerUid: 'cleaner' },
        { ...base, id: 'old-cleanup', resolved: true, cleanedAt: now - day - 1, cleanerUid: 'cleaner' },
        { ...base, id: 'old-resolution', resolved: true },
        { ...base, id: 'unknown', timestamp: null },
        { ...base, id: 'private', visibility: 'private', ownerUid: 'me' },
    ];
    assert.deepEqual(select(posts), ['confirmed', 'cleaned', 'unknown']);
    assert.deepEqual(select(posts, { recordView: true }), ['old-cleanup', 'archived', 'old-resolution']);
});

test('all public memos are recorded, then condition tags narrow by intersection', () => {
    const memo = { ...base, pinKind: 'memo', timestamp: now };
    const posts = [
        { ...memo, id: 'spring-wet', tags: ['春', '雨の日'], type: 'shelter' },
        { ...memo, id: 'spring', tags: ['春'] },
        { ...memo, id: 'winter-wet', tags: ['冬', '雨の日'] },
    ];
    assert.deepEqual(select(posts), ['spring-wet', 'spring']);
    assert.deepEqual(select(posts, { recordView: true }), ['spring-wet', 'spring', 'winter-wet']);
    assert.deepEqual(select(posts, { recordView: true, tags: ['春', '雨の日'] }), ['spring-wet']);
});

test('MyMap keeps private owner records and saved public posts across their lifespan', () => {
    const posts = [
        { ...base, id: 'my-private', ownerUid: 'me', visibility: 'private' },
        { ...base, id: 'saved', ownerUid: 'other', savedBy: ['my-hash'] },
        { ...base, id: 'legacy-public-own', userHash: 'my-hash' },
        { ...base, id: 'other-private', visibility: 'private', ownerUid: 'other', savedBy: ['my-hash'], userHash: 'my-hash' },
        { ...base, id: 'other-public', userHash: 'stranger' },
    ];
    assert.deepEqual(select(posts, { activeMapLayer: 'myMap', recordView: true, tags: ['冬'] }),
        ['my-private', 'saved', 'legacy-public-own']);
    assert.deepEqual(select(posts, { activeMapLayer: 'myMap', uid: null }), []);
    assert.deepEqual(select(posts, { recordView: true }), ['saved', 'legacy-public-own', 'other-public']);
});
