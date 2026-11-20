import test from 'node:test';
import assert from 'node:assert/strict';
import { collectActivityPosts, summarizeProfileActivity } from '../src/utils/profileActivity.js';

test('隊員番号だけの旧公開投稿を本人の活動に一度だけ足し、非公開・他人・無印の投稿は除く', () => {
    const old = { id: 'old', legacyActivity: true, visibility: 'public', memberNumber: 1, thanks: ['w'] };
    const current = { id: 'current', uid: 'me', memberNumber: 1, visibility: 'public', thanks: ['a', 'b'] };
    const owned = [current, { ...current, id: 'misattributed', ownerUid: 'other' }];
    const archive = [old, current, { ...old, id: 'current' }, { ...old, id: 'stranger', memberNumber: 2 },
        { ...old, id: 'unsigned', legacyActivity: false }, { ...old, id: 'private', visibility: 'private' },
        { ...old, id: 'other-uid', uid: 'other' }];
    const posts = collectActivityPosts(owned, archive, 'me', 1);
    assert.deepEqual(posts, [old, current]);
    assert.equal(summarizeProfileActivity(posts, []).postThanks, 3);
    assert.deepEqual(collectActivityPosts(owned, archive, 'me', null), [current]);
});

test('同じ場所の投稿と清掃をそれぞれ記録し、感謝を行動別に集計する', () => {
    const posts = [{ id: 'west-gate', title: '西口のごみ', timestamp: 100, thanks: ['a', 'b'] }];
    const cleanups = [{
        id: 'west-gate', title: '西口のごみ', cleanedAt: { toMillis: () => 200 }, thanksCount: 3,
    }];
    const result = summarizeProfileActivity(posts, cleanups);
    assert.equal(result.postThanks, 2);
    assert.equal(result.cleanupThanks, 3);
    assert.deepEqual(result.recent.map(row => [row.key, row.thanks]), [['cleanup-west-gate', 3], ['post-west-gate', 2]]);
});

test('元のピンがない清掃も活動として残り、最新5件より古い感謝も集計に含める', () => {
    const cleanups = Array.from({ length: 6 }, (_, index) => ({
        id: String(index), cleanedAt: { toMillis: () => index + 1 }, thanksCount: 2,
    }));
    const result = summarizeProfileActivity([], cleanups);
    assert.equal(result.cleanupThanks, 12);
    assert.deepEqual(result.recent.map(row => row.key), ['cleanup-5', 'cleanup-4', 'cleanup-3', 'cleanup-2', 'cleanup-1']);
});
