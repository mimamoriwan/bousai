import { db } from '../../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';

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

/**
 * お散歩記録コントローラー（カスタム fixed パネル）
 *
 * ボトムナビゲーションバー（64px）の真上に配置するため、
 * react-spring-bottom-sheet ではなく position:fixed で実装。
 *
 * ボタンを押すと：
 *   1. Firestore の `walkActions` コレクションに点データを保存（プライベートログ）
 *   2. Firestore の `map_pins` コレクションにも保存（マップ表示用）
 */
const WalkControllerSheet = ({ isOpen, onClose }) => {
    const { currentUser, currentUserHash } = useAuth();

    const handleAction = async (actionType, label) => {
        if (!navigator.geolocation) {
            const { default: toast } = await import('react-hot-toast');
            toast.error('位置情報が取得できません。設定を確認してください。');
            return;
        }

        const { default: toast } = await import('react-hot-toast');
        toast.success(`${label}を記録しました🐾`, { duration: 2500, icon: '📍' });

        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const { latitude: lat, longitude: lng } = pos.coords;
                const now = Date.now();

                const walkActionData = {
                    uid: currentUser?.uid ?? null,
                    actionType,
                    lat,
                    lng,
                    timestamp: now,
                    createdAt: serverTimestamp(),
                };

                const mapPinData = {
                    lat,
                    lng,
                    type: `walk_${actionType}`,
                    title: label,
                    note: '',
                    date: new Date().toLocaleDateString(),
                    timestamp: now,
                    imageUrl: null,
                    imagePath: null,
                    resolved: false,
                    thanks: [],
                    savedBy: [],
                    visibility: 'public',
                    userHash: currentUserHash ?? null,
                };

                try {
                    await Promise.all([
                        addDoc(collection(db, 'walkActions'), walkActionData),
                        addDoc(collection(db, 'map_pins'), mapPinData),
                    ]);
                } catch (err) {
                    console.error('お散歩アクション保存エラー:', err);
                    toast.error('記録の保存に失敗しました。');
                }
            },
            (err) => {
                console.warn('位置情報取得エラー:', err);
            },
            { enableHighAccuracy: true, timeout: 8000 }
        );
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
                            cursor: 'pointer',
                        }}
                    >
                        <span style={{ fontSize: '2rem' }}>{action.emoji}</span>
                        {action.label}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default WalkControllerSheet;
