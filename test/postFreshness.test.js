import test from 'node:test';
import assert from 'node:assert/strict';
import { isPostArchived } from '../src/utils/postFreshness.js';

const timestamp = Date.UTC(2026, 0, 1);
const after48Hours = Date.UTC(2026, 0, 3);
const after14Days = Date.UTC(2026, 0, 15);

test('危険投稿は48時間ちょうどまで新着扱いで、超えると過去情報になる', () => {
    const post = { type: 'danger', timestamp };
    assert.equal(isPostArchived(post, 'all', after48Hours), false);
    assert.equal(isPostArchived(post, 'all', after48Hours + 1), true);
    assert.equal(isPostArchived(post, 'danger', after48Hours + 1), true);
});

test('植物投稿に14日間の表示期限を適用するのは植物フィルターだけ', () => {
    const post = { type: 'plant', timestamp };
    assert.equal(isPostArchived(post, 'plant', after14Days), false);
    assert.equal(isPostArchived(post, 'plant', after14Days + 1), true);
    assert.equal(isPostArchived(post, 'all', after48Hours + 1), true);
    assert.equal(isPostArchived({ type: 'danger', timestamp }, 'plant', after48Hours + 1), true);
});

test('投稿時刻が記録されていない場合は過去情報にしない', () => {
    assert.equal(isPostArchived({ type: 'danger' }, 'all', after14Days), false);
    assert.equal(isPostArchived({ type: 'danger', timestamp: 0 }, 'all', after14Days), false);
});
