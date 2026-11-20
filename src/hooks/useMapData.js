import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ownsPin, ownReactionIds } from '../utils/pinIdentity';
import { db, storage } from '../firebase';
import {
    collection, deleteDoc, doc, onSnapshot, or, query, runTransaction,
    updateDoc, arrayUnion, arrayRemove, getDocs, where, Timestamp
} from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';

function ownPinQuery(uid) {
    return query(collection(db, 'map_pins'), or(where('ownerUid', '==', uid), where('uid', '==', uid)));
}

/**
 * Firestoreのmap_pinsとsafetyReportsをリアルタイムで購読し、
 * ピンのCRUD操作を提供するカスタムフック。
 */
export const useMapData = () => {
    const { currentUser, currentUserHash } = useAuth();
    const [userPosts, setUserPosts] = useState([]);
    const [safetyReports, setSafetyReports] = useState([]);
    const [walkActionSnapshot, setWalkActionSnapshot] = useState({ uid: null, items: [] });
    const walkActions = currentUser && walkActionSnapshot.uid === currentUser.uid
        ? walkActionSnapshot.items
        : [];

    const normalizePins = (snapshot) => snapshot.docs.map((docSnap) => {
        const data = docSnap.data({ serverTimestamps: 'estimate' });
        return {
            id: docSnap.id,
            ...data,
            visibility: data.visibility || 'private',
            savedBy: Array.isArray(data.savedBy) ? data.savedBy : [],
            thanks: Array.isArray(data.thanks) ? data.thanks : []
        };
    });

    // 公開投稿と自分の投稿を購読し、両方に含まれる投稿はIDでまとめる
    useEffect(() => {
        let publicPins = [];
        let ownedPins = [];
        const syncPins = () => {
            const merged = new Map(
                [...publicPins, ...ownedPins].map((pin) => [pin.id, pin])
            );
            setUserPosts([...merged.values()]);
        };

        const publicQuery = query(
            collection(db, 'map_pins'),
            where('visibility', '==', 'public')
        );
        const unsubscribePublic = onSnapshot(publicQuery, (snapshot) => {
            publicPins = normalizePins(snapshot);
            syncPins();
        }, (error) => {
            console.error('公開map_pins 取得エラー:', error);
        });

        let unsubscribeOwned = () => {};
        if (currentUser) {
            unsubscribeOwned = onSnapshot(ownPinQuery(currentUser.uid), (snapshot) => {
                ownedPins = normalizePins(snapshot).filter(pin => ownsPin(pin, currentUser.uid));
                syncPins();
            }, (error) => {
                console.error('自分の非公開map_pins 取得エラー:', error);
            });
        }

        return () => {
            unsubscribePublic();
            unsubscribeOwned();
        };
    }, [currentUser]);

    // 正確な位置を含むお散歩アクションは、本人の記録だけを購読する
    useEffect(() => {
        if (!currentUser) return undefined;

        const ownActionsQuery = query(
            collection(db, 'walkActions'),
            where('uid', '==', currentUser.uid)
        );
        const unsubscribe = onSnapshot(ownActionsQuery, (snapshot) => {
            setWalkActionSnapshot({
                uid: currentUser.uid,
                items: snapshot.docs.map((docSnap) => ({
                    id: docSnap.id,
                    ...docSnap.data(),
                })),
            });
        }, (error) => {
            console.error('自分のお散歩記録取得エラー:', error);
        });

        return () => unsubscribe();
    }, [currentUser]);

    // safetyReports の過去6時間分をリアルタイムで取得
    useEffect(() => {
        const SIX_HOURS_AGO = Timestamp.fromMillis(Date.now() - 6 * 60 * 60 * 1000);
        const q = query(
            collection(db, 'safetyReports'),
            where('createdAt', '>=', SIX_HOURS_AGO)
        );
        const unsubscribe = onSnapshot(q, (snap) => {
            setSafetyReports(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        }, (err) => {
            console.error('safetyReports 取得エラー:', err);
        });
        return () => unsubscribe();
    }, []);

    /** map_pins と自分のお散歩記録を手動で最新取得（プルトゥリフレッシュ用） */
    const fetchLatestPins = async () => {
        try {
            const pinRequests = [getDocs(query(
                collection(db, 'map_pins'),
                where('visibility', '==', 'public')
            ))];
            if (currentUser) {
                pinRequests.push(getDocs(ownPinQuery(currentUser.uid)));
            }
            const [snapshots, walkSnapshot] = await Promise.all([
                Promise.all(pinRequests),
                currentUser
                    ? getDocs(query(
                        collection(db, 'walkActions'),
                        where('uid', '==', currentUser.uid)
                    ))
                    : Promise.resolve(null),
            ]);
            const merged = new Map(
                snapshots.flatMap(normalizePins)
                    .filter(pin => pin.visibility === 'public' || ownsPin(pin, currentUser?.uid))
                    .map(pin => [pin.id, pin])
            );
            setUserPosts([...merged.values()]);
            if (walkSnapshot) {
                setWalkActionSnapshot({
                    uid: currentUser.uid,
                    items: walkSnapshot.docs.map((docSnap) => ({
                        id: docSnap.id,
                        ...docSnap.data(),
                    })),
                });
            }
        } catch (error) {
            console.error('手動フェッチエラー:', error);
        }
    };

    // Toggle the desired state shown to the user. Read both identifier formats
    // inside the transaction so concurrent taps cannot create a second reaction.
    const toggleReaction = async (postId, field, displayed) => {
        const uid = currentUser?.uid;
        if (!uid || !currentUserHash) return;
        const postRef = doc(db, 'map_pins', postId);
        const shouldAdd = ownReactionIds(displayed, uid, currentUserHash).length === 0;
        try {
            await runTransaction(db, async transaction => {
                const snapshot = await transaction.get(postRef);
                if (!snapshot.exists()) return;
                const current = ownReactionIds(snapshot.data()[field], uid, currentUserHash);
                const alreadySet = current.length > 0;
                if (alreadySet === shouldAdd) return;
                const update = shouldAdd ? arrayUnion(currentUserHash) : arrayRemove(...current);
                transaction.update(postRef, { [field]: update });
            });
        } catch (error) {
            console.error('投稿への反応の更新に失敗しました:', error);
            alert('変更を保存できませんでした。接続を確認してもう一度お試しください。');
        }
    };

    const handleThanks = (postId, thanks) => toggleReaction(postId, 'thanks', thanks);
    const handleSavePost = (postId, savedBy) => toggleReaction(postId, 'savedBy', savedBy);

    /** 解決済みとしてマーク */
    const handleResolve = async (postId) => {
        if (!window.confirm('この投稿を解決済みにしますか？\n解決済みの投稿は「記録」で確認できます。')) return;
        try {
            await updateDoc(doc(db, 'map_pins', postId), { resolved: true });
        } catch (error) {
            console.error('解決済みマークエラー:', error);
        }
    };

    /** ピンの削除（Storage の画像も合わせて削除） */
    const deletePost = async (id, imagePath) => {
        if (!window.confirm('この投稿を削除しますか？')) return;
        try {
            await deleteDoc(doc(db, 'map_pins', id));
            if (imagePath) {
                await deleteObject(ref(storage, imagePath)).catch((err) => {
                    console.error('Storage 画像削除失敗:', err);
                });
            }
        } catch (error) {
            console.error('ピン削除エラー:', error);
            alert('投稿の削除に失敗しました。');
        }
    };

    /** 本人のお散歩アクションを削除 */
    const deleteWalkAction = async (id) => {
        if (!window.confirm('このお散歩記録を削除しますか？')) return;
        try {
            await deleteDoc(doc(db, 'walkActions', id));
        } catch (error) {
            console.error('お散歩記録削除エラー:', error);
            alert('お散歩記録の削除に失敗しました。');
        }
    };

    return {
        userPosts,
        safetyReports,
        walkActions,
        fetchLatestPins,
        handleThanks,
        handleSavePost,
        handleResolve,
        deletePost,
        deleteWalkAction,
    };
};
