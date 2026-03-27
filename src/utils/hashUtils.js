/** アプリ固有のソルト（レインボーテーブル攻撃対策） */
const SALT = 'bousai-map-v1';

/**
 * Firebase UID を SHA-256 で不可逆ハッシュ化する。
 * map_pins など公開コレクションへの書き込み時に uid の代わりに使用し、
 * 個人を特定できる情報（PII）が Firestore に残らないようにする。
 *
 * @param {string|null|undefined} uid
 * @returns {Promise<string|null>}
 */
export async function hashUid(uid) {
    if (!uid) return null;
    const data = new TextEncoder().encode(SALT + uid);
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}
