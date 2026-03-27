import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, storage } from '../firebase';
import {
    collection, addDoc, deleteDoc, doc, onSnapshot, query,
    updateDoc, arrayUnion, arrayRemove, getDocs, where, Timestamp
} from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';

/**
 * Firestoreのmap_pinsとsafetyReportsをリアルタイムで購読し、
 * ピンのCRUD操作を提供するカスタムフック。
 */
export const useMapData = () => {
    const { currentUser, currentUserHash } = useAuth();
    const [userPosts, setUserPosts] = useState([]);
    const [safetyReports, setSafetyReports] = useState([]);

    // map_pins のリアルタイムリスナー
    useEffect(() => {
        const q = query(collection(db, 'map_pins'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const pins = snapshot.docs.map((docSnap) => {
                const data = docSnap.data();
                return {
                    id: docSnap.id,
                    ...data,
                    visibility: data.visibility || 'public',
                    savedBy: Array.isArray(data.savedBy) ? data.savedBy : [],
                    thanks: Array.isArray(data.thanks) ? data.thanks : []
                };
            });
            setUserPosts(pins);
        }, (error) => {
            console.error('map_pins 取得エラー:', error);
        });
        return () => unsubscribe();
    }, []);

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

    /** map_pins を手動で最新取得（プルトゥリフレッシュ用） */
    const fetchLatestPins = async () => {
        try {
            const snapshot = await getDocs(query(collection(db, 'map_pins')));
            const pins = snapshot.docs.map((docSnap) => {
                const data = docSnap.data();
                return {
                    id: docSnap.id,
                    ...data,
                    visibility: data.visibility || 'public',
                    savedBy: Array.isArray(data.savedBy) ? data.savedBy : [],
                    thanks: Array.isArray(data.thanks) ? data.thanks : []
                };
            });
            setUserPosts(pins);
        } catch (error) {
            console.error('手動フェッチエラー:', error);
        }
    };

    /** ありがとう（💖）のトグル */
    const handleThanks = async (postId, currentThanks) => {
        if (!currentUser || !currentUserHash) return;
        const postRef = doc(db, 'map_pins', postId);
        const hasThanked = currentThanks?.includes(currentUserHash);
        try {
            await updateDoc(postRef, {
                thanks: hasThanked
                    ? arrayRemove(currentUserHash)
                    : arrayUnion(currentUserHash)
            });
        } catch (error) {
            console.error('thanks 更新エラー:', error);
        }
    };

    /** マイマップへの保存トグル */
    const handleSavePost = async (postId, currentSavedBy) => {
        if (!currentUser) {
            alert('「マイマップに保存」機能を利用するには、ログインが必要です。');
            return;
        }
        if (currentUser.isAnonymous) {
            alert('自分だけのマイマップ機能を利用するには、Googleアカウントでの本登録（無料）が必要です🐾\n（マイページより登録できます）');
            return;
        }
        if (!currentUserHash) return;
        const postRef = doc(db, 'map_pins', postId);
        const hasSaved = (currentSavedBy || []).includes(currentUserHash);
        try {
            await updateDoc(postRef, {
                savedBy: hasSaved
                    ? arrayRemove(currentUserHash)
                    : arrayUnion(currentUserHash)
            });
        } catch (error) {
            console.error('マイマップ保存トグルエラー:', error);
        }
    };

    /** 解決済みとしてマーク */
    const handleResolve = async (postId) => {
        if (!window.confirm('このスポットの状況は「解決済み（安全）」になりましたか？\n※マップ上の表示がグレーに変わります。')) return;
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

    return {
        userPosts,
        safetyReports,
        fetchLatestPins,
        handleThanks,
        handleSavePost,
        handleResolve,
        deletePost,
    };
};
