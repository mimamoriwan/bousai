import { useEffect, useRef, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { db } from '../firebase';
import { cleanPin, reconfirmPin, thankCleanup } from '../services/pinActivity';
import { isBrowserOnline, OFFLINE_WRITE_MESSAGE } from '../utils/networkStatus';

const actions = {
    reconfirm: { run: reconfirmPin, success: '再確認を記録しました。ここから24時間、地図にはっきり表示します。' },
    clean: { run: cleanPin, success: '清掃完了を記録しました。お掃除ありがとうございます。' },
    thank: { run: thankCleanup, success: '掃除した人に「ありがとう」を届けました。' },
};

export function usePinActions(uid, selectedPost) {
    const lock = useRef(false);
    const [busyPin, setBusyPin] = useState(null);
    const [receipt, setReceipt] = useState(null);
    const cleanupId = uid && selectedPost?.visibility === 'public' && selectedPost.cleanedAt
        && selectedPost.cleanerUid && selectedPost.cleanerUid !== uid ? selectedPost.id : null;
    useEffect(() => {
        if (!cleanupId) return undefined;
        return onSnapshot(doc(db, 'pinCleanups', cleanupId, 'thanks', uid), snap => {
            setReceipt({ uid, pinId: cleanupId, sent: snap.exists() });
        }, error => console.error('清掃へのお礼の取得に失敗しました', error));
    }, [cleanupId, uid]);

    const run = async (kind, post) => {
        if (lock.current) return;
        if (!uid) { toast.error('ゲスト情報を準備中です。少し待ってお試しください。'); return; }
        if (!isBrowserOnline()) { toast.error(OFFLINE_WRITE_MESSAGE); return; }
        lock.current = true;
        setBusyPin(post.id);
        try {
            const applied = await actions[kind].run(post.id, uid);
            if (applied) toast.success(actions[kind].success);
            else toast(kind === 'thank' ? '受付状況をご確認ください。' : '投稿の状態が変わりました。最新の表示をご確認ください。');
        } catch (error) {
            console.error('ピンの更新に失敗しました', error);
            toast.error('送信できませんでした。接続を確認して、もう一度お試しください。');
        } finally {
            lock.current = false;
            setBusyPin(null);
        }
    };
    const thankedPin = receipt?.uid === uid && receipt?.sent ? receipt.pinId : null;
    return { run, busyPin, thankedPin };
}
