import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { deleteApp, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth';
import {
    and, arrayRemove, arrayUnion, collection, connectFirestoreEmulator, deleteDoc, doc, getDoc, getDocs,
    getFirestore, or, query, serverTimestamp, setDoc, Timestamp, updateDoc, where, writeBatch,
} from 'firebase/firestore';
import { hashUid } from '../src/utils/hashUtils.js';
import { cleanPin, reconfirmPin, thankCleanup } from '../src/services/pinActivity.js';

const projectId = 'demo-tsukuba-pet-bousai';
const runId = randomUUID();
const hour = 3_600_000;
const requireAdmin = createRequire(new URL('../functions/package.json', import.meta.url));
const { initializeApp: initializeAdmin, deleteApp: deleteAdmin } = requireAdmin('firebase-admin/app');
const { getFirestore: getAdminDb } = requireAdmin('firebase-admin/firestore');
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8086';
const adminApp = initializeAdmin({ projectId }, `pin-activity-${runId}`);
const admin = getAdminDb(adminApp);
const apps = [];
const pins = new Set();

async function client(name) {
    const app = initializeApp({ projectId, apiKey: 'demo-api-key' }, `${name}-${runId}`);
    apps.push(app);
    const auth = getAuth(app);
    connectAuthEmulator(auth, 'http://127.0.0.1:9106', { disableWarnings: true });
    const db = getFirestore(app);
    connectFirestoreEmulator(db, '127.0.0.1', 8086);
    const { user } = await signInAnonymously(auth);
    return { db, uid: user.uid };
}

function pinData(owner, overrides) {
    return {
        lat: 36.05, lng: 140.12, type: 'danger', title: '歩道の注意', note: '',
        date: '2026/11/20', timestamp: Date.now() - 30 * hour, ownerUid: owner.uid,
        visibility: 'public', resolved: false, thanks: [], savedBy: [], ...overrides,
    };
}

async function createPin(owner, name, overrides = {}) {
    const id = `${name}-${runId}`;
    pins.add(id);
    await setDoc(doc(owner.db, 'map_pins', id), pinData(owner, overrides));
    return id;
}

const pin = (user, id) => doc(user.db, 'map_pins', id);
const ledger = (user, id) => doc(user.db, 'pinCleanups', id);
const receipt = (user, id, uid = user.uid) => doc(ledger(user, id), 'thanks', uid);
const denied = (operation, message) => assert.rejects(operation, { code: 'permission-denied' }, message);

// UIを経由しない一括書き込みにも同じ条件が適用されることを確認する。
function writeCleanup(user, id, title, { cleanerUid = user.uid, cleanedAt = serverTimestamp() } = {}) {
    const batch = writeBatch(user.db);
    batch.update(pin(user, id), { resolved: true, cleanerUid, cleanedAt });
    batch.set(ledger(user, id), { title, cleanerUid, cleanedAt, thanksCount: 0 });
    return batch.commit();
}

function writeThanks(user, id, { uid = user.uid, thanksCount = 1, createdAt = serverTimestamp() } = {}) {
    const batch = writeBatch(user.db);
    batch.update(ledger(user, id), { thanksCount });
    batch.set(receipt(user, id, uid), { createdAt });
    return batch.commit();
}

try {
    const [owner, walker, neighbor] = await Promise.all(['owner', 'walker', 'neighbor'].map(client));
    const legacyTitle = 'ゴミが落ちてるよ';
    const legacyPrivate = `march-private-${runId}`;
    const legacyPublic = `march-public-${runId}`;
    // 3月の本番版が書いた uid / memberNumber 形式を、旧PWAからの投稿も含め再現する。
    const legacy = pinData(owner, { uid: owner.uid, memberNumber: 1, imagePath: 'map_pins/1773910000000.jpg' });
    delete legacy.ownerUid;
    pins.add(legacyPrivate);
    pins.add(legacyPublic);
    await setDoc(pin(owner, legacyPrivate), { ...legacy, visibility: 'private' });
    await setDoc(pin(owner, legacyPublic), { ...legacy, title: legacyTitle });
    const currentPrivate = await createPin(owner, 'current-private', { memberNumber: 1, visibility: 'private' });
    const earlyPublic = `beta-public-${runId}`;
    pins.add(earlyPublic);
    const earlyData = { ...legacy, legacyActivity: true };
    delete earlyData.uid;
    await admin.doc(`map_pins/${earlyPublic}`).set(earlyData);
    const profileQuery = query(collection(walker.db, 'map_pins'),
        and(where('visibility', '==', 'public'), where('memberNumber', '==', 1)));
    const attributed = await getDocs(profileQuery);
    assert.ok(attributed.docs.some(item => item.id === earlyPublic));
    assert.ok(!attributed.docs.some(item => item.id === currentPrivate || item.id === legacyPrivate));
    await denied(createPin(owner, 'invalid-marker', { legacyActivity: true }), '旧版実績の印は新規投稿に付けられない');
    await denied(updateDoc(pin(owner, legacyPublic), { legacyActivity: true }), '既存の投稿に旧版実績の印を追加できない');
    const ownProfile = admin.doc(`users/${walker.uid}`);
    await ownProfile.set({ memberNumber: 1 });
    try {
        await denied(updateDoc(pin(walker, earlyPublic), { resolved: true }), '隊員番号の一致は解決の権限にならない');
        await denied(deleteDoc(pin(walker, earlyPublic)), '隊員番号の一致は削除の権限にならない');
    } finally {
        await ownProfile.delete();
    }
    const ownFilter = or(where('ownerUid', '==', owner.uid), where('uid', '==', owner.uid));
    for (const filter of [ownFilter, and(ownFilter, where('visibility', '==', 'private'))]) {
        const snapshot = await getDocs(query(collection(owner.db, 'map_pins'), filter));
        assert.ok(snapshot.docs.some(item => item.id === legacyPrivate));
        assert.ok(snapshot.docs.some(item => item.id === currentPrivate));
    }
    await denied(getDoc(pin(walker, legacyPrivate)), '他人の旧形式非公開投稿を読めない');
    await denied(getDocs(query(collection(walker.db, 'map_pins'), where('uid', '==', owner.uid))), '他人に紐づく全投稿を取得できない');
    await denied(getDocs(query(collection(walker.db, 'map_pins'), where('memberNumber', '==', 1))), '隊員番号で非公開投稿を取得できない');
    await denied(setDoc(pin(walker, legacyPublic + '-new'), legacy), '他人のUIDを旧形式の投稿に指定できない');
    await denied(setDoc(pin(walker, legacyPublic + '-mixed'), { ...legacy, ownerUid: walker.uid }), '新旧形式で投稿者を偽装できない');
    await denied(updateDoc(pin(walker, legacyPublic), { uid: walker.uid }), '旧形式の投稿者を変更できない');
    await denied(deleteDoc(pin(walker, legacyPrivate)), '旧形式の投稿を削除できるのは本人');
    await updateDoc(pin(owner, legacyPrivate), { resolved: true });
    await deleteDoc(pin(owner, legacyPrivate));

    const alias = await hashUid(walker.uid);
    for (const field of ['thanks', 'savedBy']) {
        await updateDoc(pin(owner, legacyPublic), { [field]: arrayUnion(owner.uid) });
        await updateDoc(pin(walker, legacyPublic), { [field]: arrayUnion(walker.uid) });
        await denied(updateDoc(pin(walker, legacyPublic), { [field]: arrayUnion(alias) }), '新旧の識別子で同じ人を二重に数えない');
        await denied(updateDoc(pin(walker, legacyPublic), { [field]: arrayRemove(owner.uid) }), '他人の反応を取り消せない');
        await denied(updateDoc(pin(neighbor, legacyPublic), { [field]: [neighbor.uid] }), '他人の反応を置き換えられない');
        await updateDoc(pin(walker, legacyPublic), { [field]: arrayRemove(walker.uid) });
        await updateDoc(pin(walker, legacyPublic), { [field]: arrayUnion(alias) });
        await denied(updateDoc(pin(walker, legacyPublic), { [field]: arrayUnion(neighbor.uid) }), '他人の反応を追加できない');
        await admin.doc(`map_pins/${legacyPublic}`).update({ [field]: [owner.uid, walker.uid, alias] });
        await updateDoc(pin(walker, legacyPublic), { [field]: arrayRemove(walker.uid, alias) });
        assert.deepEqual((await getDoc(pin(owner, legacyPublic))).data()[field], [owner.uid], '既に混在した本人分だけを取り消す');
    }
    console.log('✓ 本番旧形式の公開・非公開ピンと隊員番号、本人の反応のみの切り替え');
    for (const overrides of [
        { pinKind: 'unknown' }, { tags: ['登録外'] }, { tags: '春' },
        { locationPrecision: 'unknown' }, { isLitter: 'true' }, { confirmedAt: serverTimestamp() },
        { observedAt: '今朝' }, { observedAt: Date.now() + hour },
        { createdAt: Timestamp.fromMillis(Date.now() - 30 * hour) }, { createdAt: Date.now() },
    ]) {
        await denied(createPin(owner, 'invalid', overrides), `投稿項目の検証 ${Object.keys(overrides)}`);
    }

    const legacyId = await createPin(owner, 'legacy', { title: legacyTitle });
    const observation = () => ({ confirmedAt: serverTimestamp() });
    const earlierSighting = await createPin(owner, 'earlier-sighting', {
        timestamp: Date.now(), observedAt: Date.now() - 30 * hour, locationPrecision: 'area',
    });
    assert.equal(await reconfirmPin(earlierSighting, walker.uid, walker.db), false, '投稿の表示期間は投稿日から計算する');
    await denied(updateDoc(pin(walker, earlierSighting), observation()), '古い目撃日時を入力しても投稿直後は再確認できない');
    const serverDated = await createPin(owner, 'server-dated', {
        createdAt: serverTimestamp(), timestamp: Date.now() - 30 * hour, observedAt: Date.now() - 31 * hour,
    });
    assert.ok((await getDoc(pin(owner, serverDated))).data().createdAt instanceof Timestamp);
    assert.equal(await reconfirmPin(serverDated, walker.uid, walker.db), false, 'サーバーの作成時刻を優先する');
    await denied(updateDoc(pin(walker, serverDated), observation()), '端末の時刻が古くても公開直後は再確認できない');
    for (const [ageHours, eligible] of [[30, true], [49, false]]) {
        // 過去のサーバー作成時刻はテスト用管理クライアントからのみ用意する。
        const id = `server-${ageHours}h-${runId}`;
        pins.add(id);
        await admin.doc(`map_pins/${id}`).set(pinData(owner, {
            createdAt: new Date(Date.now() - ageHours * hour), timestamp: Date.now(), observedAt: Date.now(),
        }));
        assert.equal(await reconfirmPin(id, walker.uid, walker.db), eligible, `公開から${ageHours}時間の再確認`);
        if (!eligible) await denied(updateDoc(pin(walker, id), observation()), 'サーバー作成時刻から48時間を過ぎた投稿は対象外');
    }
    await denied(updateDoc(pin(walker, legacyId), { confirmedAt: Timestamp.fromMillis(1) }), '再確認日時はサーバーが付ける');
    await denied(updateDoc(pin(walker, legacyId), { ...observation(), title: '変更' }), '再確認と同時に本文を変更できない');
    const encounters = await Promise.all([walker, neighbor].map(user => reconfirmPin(legacyId, user.uid, user.db)));
    assert.deepEqual(encounters.sort(), [false, true], '同時の「まだあった」は一度だけ有効');
    assert.ok((await getDoc(pin(owner, legacyId))).data().confirmedAt instanceof Timestamp);
    assert.equal(await reconfirmPin(legacyId, walker.uid, walker.db), false);
    await denied(updateDoc(pin(walker, legacyId), observation()), '再送で時刻を延長できない');

    for (const [name, overrides] of [
        ['fresh', { timestamp: Date.now() - 23 * hour }],
        ['past', { timestamp: Date.now() - 49 * hour }],
        ['private', { visibility: 'private' }], ['memo', { pinKind: 'memo' }],
        ['legacy-other', { type: 'others' }], ['private-alert', { type: 'plant', pinKind: 'alert', visibility: 'private' }],
    ]) {
        const id = await createPin(owner, name, overrides);
        assert.equal(await reconfirmPin(id, owner.uid, owner.db), false, name);
        await denied(updateDoc(pin(owner, id), observation()), `${name}は再確認の対象外`);
    }
    for (const [name, overrides] of [
        ['legacy-plant', { type: 'plant' }], ['plant-alert', { type: 'plant', pinKind: 'alert' }],
        ['other-alert', { type: 'others', pinKind: 'alert' }],
    ]) {
        const id = await createPin(owner, name, overrides);
        assert.equal(await reconfirmPin(id, walker.uid, walker.db), true, `${name}の再確認`);
    }
    console.log('✓ 投稿の入力条件と、新旧の注意ピンの再確認期間・同時操作');

    for (const [name, overrides] of [
        ['non-litter', {}], ['explicit-false', { title: legacyTitle, isLitter: false }],
        ['private-litter', { title: legacyTitle, visibility: 'private' }],
        ['memo-litter', { pinKind: 'memo', title: legacyTitle }],
        ['other-type', { type: 'plant', title: legacyTitle }],
    ]) {
        const id = await createPin(owner, name, overrides);
        assert.equal(await cleanPin(id, owner.uid, owner.db), false, name);
        await denied(writeCleanup(owner, id, overrides.title ?? '歩道の注意'), `${name}は清掃の対象外`);
    }

    const newTitle = '空き缶が落ちています';
    const id = await createPin(owner, 'new-litter', {
        title: newTitle, isLitter: true, pinKind: 'alert', tags: ['地域', '秋'], locationPrecision: 'point',
    });
    await updateDoc(pin(walker, id), { thanks: arrayUnion(walker.uid) });
    await denied(updateDoc(pin(walker, id), { resolved: true, cleanedAt: serverTimestamp(), cleanerUid: walker.uid }), '清掃記録とピンがそろう');
    await denied(setDoc(ledger(walker, id), { title: newTitle, cleanerUid: walker.uid, cleanedAt: serverTimestamp(), thanksCount: 0 }), '清掃記録単独で作れない');
    await denied(writeCleanup(walker, id, '別のタイトル'), '清掃対象のタイトルと一致する');
    await denied(writeCleanup(walker, id, newTitle, { cleanerUid: owner.uid }), '清掃した人に帰属する');
    await denied(writeCleanup(walker, id, newTitle, { cleanedAt: Timestamp.fromMillis(1) }), '清掃日時はサーバーが付ける');

    const cleaners = [walker, neighbor];
    const cleaned = await Promise.all(cleaners.map(user => cleanPin(id, user.uid, user.db)));
    assert.equal(cleaned.filter(Boolean).length, 1, '二人の同時清掃は一件の活動になる');
    const cleaner = cleaners[cleaned.indexOf(true)];
    const other = cleaners[cleaned.indexOf(false)];
    const cleanedPin = (await getDoc(pin(owner, id))).data();
    const activity = (await getDoc(ledger(cleaner, id))).data();
    assert.equal(cleanedPin.cleanerUid, cleaner.uid);
    assert.equal(cleanedPin.resolved, true);
    assert.deepEqual(cleanedPin.thanks, [walker.uid]);
    assert.equal(activity.cleanerUid, cleaner.uid);
    assert.equal(activity.title, newTitle);
    assert.ok(activity.cleanedAt.isEqual(cleanedPin.cleanedAt));
    assert.equal(activity.thanksCount, 0);
    assert.equal(await cleanPin(id, cleaner.uid, cleaner.db), false);
    await denied(updateDoc(pin(owner, id), { resolved: false }), '清掃済みを元に戻せない');
    await denied(updateDoc(ledger(cleaner, id), { cleanerUid: other.uid }), '実績を付け替えられない');
    await denied(deleteDoc(ledger(cleaner, id)), '実績を削除できない');
    assert.equal(await cleanPin(legacyId, walker.uid, walker.db), true, '旧クイック投稿からも清掃できる');
    console.log('✓ 清掃の適格性、既存の感謝の保持、同時操作の重複防止');

    assert.equal(await thankCleanup(id, cleaner.uid, cleaner.db), false);
    await denied(writeThanks(cleaner, id), '自分自身の清掃にお礼できない');
    await denied(updateDoc(ledger(owner, id), { thanksCount: 1 }), 'お礼の件数だけ変更できない');
    await denied(setDoc(receipt(owner, id), { createdAt: serverTimestamp() }), '受領記録だけ作れない');
    await denied(writeThanks(owner, id, { uid: other.uid }), '別の人のお礼を作れない');
    await denied(writeThanks(owner, id, { thanksCount: 2 }), '一人のお礼は一件');
    await denied(writeThanks(owner, id, { createdAt: Timestamp.fromMillis(1) }), 'お礼の日時はサーバーが付ける');
    const responses = await Promise.all([owner, owner, other].map(user => thankCleanup(id, user.uid, user.db)));
    assert.equal(responses.filter(Boolean).length, 2, '二人・三回のお礼は二件');
    assert.equal(await thankCleanup(id, owner.uid, owner.db), false);
    assert.ok((await getDoc(receipt(owner, id))).data().createdAt instanceof Timestamp);
    await denied(getDoc(receipt(other, id, owner.uid)), '他人のお礼の受領記録は非公開');
    await denied(deleteDoc(receipt(owner, id)), '受領記録は削除できない');
    assert.deepEqual((await getDoc(pin(owner, id))).data().thanks, [walker.uid]);

    await deleteDoc(pin(owner, id));
    await denied(getDoc(ledger(other, id)), '削除後のタイトルを第三者が読めない');
    const history = await getDocs(query(collection(cleaner.db, 'pinCleanups'), where('cleanerUid', '==', cleaner.uid)));
    assert.equal(history.docs.find(snap => snap.id === id)?.data().thanksCount, 2, '元の投稿を削除しても清掃実績とお礼は残る');
    console.log('✓ 清掃した人へのお礼、本人の受領記録、投稿削除後のマイページ履歴');
} finally {
    try {
        // この実行で採番した投稿と実績・受領記録だけ片付ける。
        await Promise.all([...pins].map(async id => {
            const cleanupRef = admin.doc(`pinCleanups/${id}`);
            const receipts = await cleanupRef.collection('thanks').get();
            const batch = admin.batch();
            receipts.forEach(snap => batch.delete(snap.ref));
            batch.delete(cleanupRef);
            batch.delete(admin.doc(`map_pins/${id}`));
            await batch.commit();
        }));
    } finally {
        await Promise.all([...apps.map(app => deleteApp(app)), deleteAdmin(adminApp)]);
    }
}
