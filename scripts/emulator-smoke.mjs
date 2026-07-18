import { deleteApp, initializeApp } from 'firebase/app';
import {
    connectAuthEmulator,
    getAuth,
    signInAnonymously,
} from 'firebase/auth';
import {
    arrayRemove,
    arrayUnion,
    collection,
    connectFirestoreEmulator,
    deleteDoc,
    doc,
    GeoPoint,
    getDoc,
    getDocs,
    getFirestore,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
} from 'firebase/firestore';
import {
    connectStorageEmulator,
    deleteObject,
    getDownloadURL,
    getStorage,
    ref,
    uploadBytes,
} from 'firebase/storage';

const projectId = 'demo-tsukuba-pet-bousai';
const config = {
    apiKey: 'demo-api-key',
    authDomain: `${projectId}.firebaseapp.com`,
    projectId,
    storageBucket: `${projectId}.firebasestorage.app`,
    appId: '1:000000000000:web:emulator-smoke',
};

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createClient = (name, withAuth = true) => {
    const app = initializeApp(config, `${name}-${suffix}`);
    const auth = getAuth(app);
    const db = getFirestore(app);
    const storage = getStorage(app);

    if (withAuth) {
        connectAuthEmulator(auth, 'http://127.0.0.1:9106', { disableWarnings: true });
    }
    connectFirestoreEmulator(db, '127.0.0.1', 8086);
    connectStorageEmulator(storage, '127.0.0.1', 9206);

    return { app, auth, db, storage };
};

const owner = createClient('owner');
const attacker = createClient('attacker');
const reader = createClient('reader', false);

const assertRejected = async (label, operation) => {
    try {
        await operation();
    } catch (error) {
        if (error.code === 'permission-denied' || error.code === 'storage/unauthorized') {
            console.log(`✓ ${label}`);
            return;
        }
        throw error;
    }
    throw new Error(`${label}: 拒否されるべき操作が成功しました。`);
};

const mapPinData = (uid, visibility) => ({
    lat: 35.6722,
    lng: 139.7364,
    type: 'danger',
    title: 'エミュレータ検証投稿',
    note: '本番データを使わない権限テスト',
    date: '2026/7/17',
    timestamp: Date.now(),
    imageUrl: null,
    imagePath: null,
    resolved: false,
    thanks: [],
    savedBy: [],
    visibility,
    userHash: `hash-${uid}`,
    ownerUid: uid,
});

let publicPinRef;
let privatePinRef;
let walkActionRef;
let invalidWalkActionRef;
let safetyReportRef;
let imageRef;

try {
    const ownerCredential = await signInAnonymously(owner.auth);
    const attackerCredential = await signInAnonymously(attacker.auth);
    const ownerUid = ownerCredential.user.uid;
    const attackerUid = attackerCredential.user.uid;
    console.log('✓ 匿名ゲスト認証');

    publicPinRef = doc(owner.db, 'map_pins', `public-${suffix}`);
    privatePinRef = doc(owner.db, 'map_pins', `private-${suffix}`);
    await setDoc(publicPinRef, mapPinData(ownerUid, 'public'));
    await setDoc(privatePinRef, mapPinData(ownerUid, 'private'));
    console.log('✓ 公開・非公開のゲスト投稿作成');

    const publicPin = await getDoc(doc(reader.db, 'map_pins', publicPinRef.id));
    if (!publicPin.exists()) throw new Error('公開投稿を未ログインで読めませんでした。');
    console.log('✓ 公開投稿の未ログイン読み取り');

    await assertRejected('非公開投稿の未ログイン読み取りを拒否', () =>
        getDoc(doc(reader.db, 'map_pins', privatePinRef.id))
    );
    const ownPrivatePin = await getDoc(privatePinRef);
    if (!ownPrivatePin.exists()) throw new Error('ゲスト本人が非公開投稿を読めませんでした。');
    console.log('✓ ゲスト本人の非公開投稿読み取り');
    await assertRejected('他のゲストによる非公開投稿の読み取りを拒否', () =>
        getDoc(doc(attacker.db, 'map_pins', privatePinRef.id))
    );
    await assertRejected('他人による解決済み変更を拒否', () =>
        updateDoc(doc(attacker.db, 'map_pins', publicPinRef.id), { resolved: true })
    );
    await assertRejected('他人による投稿削除を拒否', () =>
        deleteDoc(doc(attacker.db, 'map_pins', publicPinRef.id))
    );

    await updateDoc(doc(attacker.db, 'map_pins', publicPinRef.id), {
        thanks: arrayUnion(`hash-${attackerUid}`),
    });
    console.log('✓ ゲストによる「ありがとう」追加');

    const guestHash = `hash-${attackerUid}`;
    await updateDoc(doc(attacker.db, 'map_pins', publicPinRef.id), {
        savedBy: arrayUnion(guestHash),
    });
    const guestSavedPin = await getDoc(doc(attacker.db, 'map_pins', publicPinRef.id));
    if (!guestSavedPin.data()?.savedBy?.includes(guestHash)) {
        throw new Error('ゲストのマイマップ保存が反映されませんでした。');
    }
    console.log('✓ ゲストによるマイマップ保存');
    await updateDoc(doc(attacker.db, 'map_pins', publicPinRef.id), {
        savedBy: arrayRemove(guestHash),
    });
    console.log('✓ ゲストによるマイマップ保存解除');
    await assertRejected('未ログイン利用者によるマイマップ保存を拒否', () =>
        updateDoc(doc(reader.db, 'map_pins', publicPinRef.id), {
            savedBy: arrayUnion('unauthenticated-reader'),
        })
    );

    await updateDoc(publicPinRef, { resolved: true });
    console.log('✓ 投稿者本人による解決済み変更');

    await setDoc(doc(owner.db, 'users', ownerUid), {
        profile: { name: 'ゲスト検証犬' },
    });
    await assertRejected('他人のプロフィール書き換えを拒否', () =>
        setDoc(doc(attacker.db, 'users', ownerUid), {
            profile: { name: '不正な変更' },
        })
    );

    walkActionRef = doc(owner.db, 'walkActions', `walk-${suffix}`);
    await setDoc(walkActionRef, {
        uid: ownerUid,
        actionType: 'sniff',
        lat: 35.6722,
        lng: 139.7364,
        timestamp: Date.now(),
        createdAt: serverTimestamp(),
    });
    const savedWalkAction = await getDoc(walkActionRef);
    if (!savedWalkAction.exists()) throw new Error('本人のお散歩記録を読み取れませんでした。');
    console.log('✓ ゲストのお散歩記録作成と本人読み取り');
    const ownWalkActions = await getDocs(query(
        collection(owner.db, 'walkActions'),
        where('uid', '==', ownerUid)
    ));
    if (!ownWalkActions.docs.some((docSnap) => docSnap.id === walkActionRef.id)) {
        throw new Error('本人のお散歩記録一覧に作成済みデータがありません。');
    }
    console.log('✓ ゲスト本人のお散歩記録一覧');
    await assertRejected('他人によるお散歩記録読み取りを拒否', () =>
        getDoc(doc(attacker.db, 'walkActions', walkActionRef.id))
    );
    await assertRejected('他人によるお散歩記録一覧取得を拒否', () =>
        getDocs(query(
            collection(attacker.db, 'walkActions'),
            where('uid', '==', ownerUid)
        ))
    );
    await assertRejected('他人のお散歩記録削除を拒否', () =>
        deleteDoc(doc(attacker.db, 'walkActions', walkActionRef.id))
    );
    invalidWalkActionRef = doc(owner.db, 'walkActions', `invalid-${suffix}`);
    await assertRejected('未対応のお散歩アクション作成を拒否', () =>
        setDoc(invalidWalkActionRef, {
            uid: ownerUid,
            actionType: 'unknown',
            lat: 35.6722,
            lng: 139.7364,
            timestamp: Date.now(),
            createdAt: serverTimestamp(),
        })
    );
    invalidWalkActionRef = null;

    safetyReportRef = doc(owner.db, 'safetyReports', `spot-${suffix}`);
    await setDoc(safetyReportRef, {
        reportType: 'spot',
        location: new GeoPoint(35.672, 139.736),
        uid: ownerUid,
        createdAt: serverTimestamp(),
    });
    const publicSafetyReport = await getDoc(doc(reader.db, 'safetyReports', safetyReportRef.id));
    if (!publicSafetyReport.exists()) throw new Error('安全スポットを公開読み取りできませんでした。');
    console.log('✓ ゲストの安全スポット報告と公開読み取り');
    await assertRejected('他人による安全スポット削除を拒否', () =>
        deleteDoc(doc(attacker.db, 'safetyReports', safetyReportRef.id))
    );

    const onePixelPng = Uint8Array.from(Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z6C8AAAAASUVORK5CYII=',
        'base64'
    ));
    imageRef = ref(owner.storage, `map_pins/${ownerUid}/smoke-${suffix}.png`);
    await uploadBytes(imageRef, onePixelPng, { contentType: 'image/png' });
    await getDownloadURL(imageRef);
    console.log('✓ ゲスト画像の本人領域への保存');

    await assertRejected('他人の画像領域への保存を拒否', () =>
        uploadBytes(
            ref(attacker.storage, `map_pins/${ownerUid}/blocked-${suffix}.png`),
            onePixelPng,
            { contentType: 'image/png' }
        )
    );

    console.log('\nFirebase Emulatorの権限テストはすべて成功しました。');
} finally {
    if (imageRef) await deleteObject(imageRef).catch(() => {});
    if (invalidWalkActionRef) await deleteDoc(invalidWalkActionRef).catch(() => {});
    if (safetyReportRef) await deleteDoc(safetyReportRef).catch(() => {});
    if (walkActionRef) await deleteDoc(walkActionRef).catch(() => {});
    if (privatePinRef) await deleteDoc(privatePinRef).catch(() => {});
    if (publicPinRef) await deleteDoc(publicPinRef).catch(() => {});
    await Promise.all([
        deleteApp(owner.app),
        deleteApp(attacker.app),
        deleteApp(reader.app),
    ]);
}
