import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeProfileActivity } from '../src/utils/profileActivity.js';

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
