import { useState } from 'react';
import { db } from '../../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { isBrowserOnline, OFFLINE_WRITE_MESSAGE } from '../../utils/networkStatus';

/** お散歩アクションの設定 */
const WALK_ACTIONS = [
    {
        type: 'sniff',
        label: 'くん活',
        emoji: '🐕',
        bg: '#FEF3C7',
        border: '#FDE68A',
        color: '#92400E',
    },
    {
        type: 'pee',
        label: 'おしっこ',
        emoji: '💧',
        bg: '#E0F2FE',
        border: '#BAE6FD',
        color: '#0369A1',
    },
    {
        type: 'poop',
        label: 'うんち',
        emoji: '💩',
        bg: '#F5F5F4',
        border: '#E7E5E4',
        color: '#57534E',
    },
    {
        type: 'mark',
        label: 'マーキング',
        emoji: '📍',
        bg: '#FFE4E6',
        border: '#FECDD3',
        color: '#BE123C',
    },
];

const getLocationFailureMessage = (error) => {
    if (!navigator.geolocation) {
        return 'この端末では位置情報を利用できません。';
    }
    if (error?.code === 1) {
        return '位置情報が許可されていません。端末の設定をご確認ください。';
    }
    if (error?.code === 3) {
        return '現在地を取得できませんでした。屋外などで、もう一度お試しください。';
    }
    return '現在地を取得できませんでした。もう一度お試しください。';
};

/**
 * お散歩記録コントローラー（カスタム fixed パネル）
 *
 * ボトムナビゲーションバー（64px）の真上に配置するため、
 * react-spring-bottom-sheet ではなく position:fixed で実装。
 *
 * ボタンを押すと、正確な位置を本人だけが読める `walkActions` に保存する。
 * 公開マップでは、将来このデータを集約・匿名化した情報だけを表示する。
 */
const WalkControllerSheet = ({ isOpen, onClose, onRequestMapSelection }) => {
    const { currentUser } = useAuth();
    const [recordingActionType, setRecordingActionType] = useState(null);

    const handleAction = async (actionType, label) => {
        if (!currentUser || recordingActionType) return;
        const { default: toast } = await import('react-hot-toast');
        if (!isBrowserOnline()) {
            toast.error(OFFLINE_WRITE_MESSAGE, { duration: 5000 });
            return;
        }
        setRecordingActionType(actionType);
        try {
            if (!navigator.geolocation) {
                throw new Error('Geolocation is unavailable');
            }

            const pos = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 8000,
                    maximumAge: 0,
                });
            });
            const { latitude: lat, longitude: lng } = pos.coords;

            await addDoc(collection(db, 'walkActions'), {
                uid: currentUser.uid,
                actionType,
                lat,
                lng,
                timestamp: Date.now(),
                createdAt: serverTimestamp(),
            });

            toast.success(`${label}を記録しました🐾`, { duration: 2500, icon: '📍' });
        } catch (err) {
            if (err?.code === 1 || err?.code === 2 || err?.code === 3 || !navigator.geolocation) {
                console.warn('位置情報取得エラー:', err);
                if (onRequestMapSelection) {
                    toast('現在地を取得できないため、地図から記録場所を選んでください。', { icon: '🗺️' });
                    onClose();
                    onRequestMapSelection({ actionType, label, locationError: err });
                } else {
                    toast.error(getLocationFailureMessage(err));
                }
            } else {
                console.error('お散歩アクション保存エラー:', err);
                toast.error('記録の保存に失敗しました。もう一度お試しください。');
            }
        } finally {
            setRecordingActionType(null);
        }
    };

    return (
        <div
            style={{
                position: 'fixed',
                left: 0,
                right: 0,
                /* ボトムナビ（64px）の真上に配置 */
                bottom: 64,
                zIndex: 10001,
                background: 'white',
                borderRadius: '20px 20px 0 0',
                boxShadow: '0 -4px 24px rgba(0, 0, 0, 0.18)',
                transform: isOpen ? 'translateY(0)' : 'translateY(110%)',
                transition: 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
                pointerEvents: isOpen ? 'auto' : 'none',
            }}
        >
            {/* ドラッグハンドル */}
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '10px' }}>
                <div style={{
                    width: '36px', height: '4px',
                    borderRadius: '2px', background: '#D1D5DB',
                }} />
            </div>

            {/* ヘッダー */}
            <div style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', padding: '8px 16px 4px',
            }}>
                <h3 style={{
                    margin: 0, fontSize: '1rem', color: '#1F2937',
                    display: 'flex', alignItems: 'center', gap: '6px',
                }}>
                    🐾 お散歩記録中...
                </h3>
                <button
                    onClick={onClose}
                    style={{
                        background: 'none', border: 'none',
                        fontSize: '1.5rem', lineHeight: 1,
                        cursor: 'pointer', color: '#6B7280', padding: '4px',
                    }}
                >×</button>
            </div>

            {/* ボタングリッド */}
            <div style={{
                padding: '8px 16px 16px',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '10px',
            }}>
                {WALK_ACTIONS.map((action) => (
                    <button
                        key={action.type}
                        onClick={() => handleAction(action.type, action.label)}
                        disabled={Boolean(recordingActionType)}
                        aria-busy={recordingActionType === action.type}
                        style={{
                            padding: '16px 8px',
                            borderRadius: '16px',
                            background: action.bg,
                            border: `1px solid ${action.border}`,
                            color: action.color,
                            fontWeight: 'bold',
                            fontSize: '1.1rem',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '8px',
                            boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                            cursor: recordingActionType ? 'default' : 'pointer',
                            opacity: recordingActionType && recordingActionType !== action.type ? 0.5 : 1,
                        }}
                    >
                        <span style={{ fontSize: '2rem' }}>
                            {recordingActionType === action.type ? '⏳' : action.emoji}
                        </span>
                        {recordingActionType === action.type ? '記録中...' : action.label}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default WalkControllerSheet;
