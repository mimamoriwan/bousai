import test from 'node:test';
import assert from 'node:assert/strict';
import { isBrowserOnline } from '../src/utils/networkStatus.js';

test('ブラウザがオフラインと明示した場合だけ保存を止める', () => {
    assert.equal(isBrowserOnline({ onLine: false }), false);
    assert.equal(isBrowserOnline({ onLine: true }), true);
});

test('navigatorを利用できない環境ではオンライン扱いにする', () => {
    assert.equal(isBrowserOnline(undefined), true);
});
