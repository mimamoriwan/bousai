import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import {
    collection, getDocs, addDoc, serverTimestamp,
} from 'firebase/firestore';
import toast from 'react-hot-toast';

// ──────────────────────────────────────────────────────────────────────────────
// SafetyReportModal
// お散歩後の「異常なし（安全）」事後報告モーダル
//
// Props:
//   currentUser — Firebase User オブジェクト
//   onClose     — モーダルを閉じるコールバック
// ──────────────────────────────────────────────────────────────────────────────
const SafetyReportModal = ({ currentUser, onClose }) => {
    const navigate = useNavigate();
    const [routes, setRoutes] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedRouteId, setSelectedRouteId] = useState(null);

    // ユーザーの保存済みルートを取得
    useEffect(() => {
        const fetchRoutes = async () => {
            if (!currentUser || currentUser.isAnonymous) {
                setIsLoading(false);
                return;
            }
            try {
                const snap = await getDocs(
                    collection(db, 'users', currentUser.uid, 'routes')
                );
                const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
                list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
                setRoutes(list);
            } catch (err) {
                console.error('ルート取得エラー:', err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchRoutes();
    }, [currentUser]);

    // 安全報告を Firestore に保存
    const handleReport = async (route) => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        setSelectedRouteId(route.id);
        try {
            await addDoc(collection(db, 'safetyReports'), {
                userId: currentUser.uid,
                routeId: route.id,
                routeName: route.name,
                publicPath: route.publicPath || [],
                totalDistanceM: route.totalDistanceM || 0,
                createdAt: serverTimestamp(),
            });
            toast.success(`「${route.name}」の安全報告が完了しました🐾`, { duration: 4000 });
            onClose();
        } catch (err) {
            console.error('安全報告エラー:', err);
            toast.error('報告に失敗しました。もう一度お試しください。');
            setIsSubmitting(false);
            setSelectedRouteId(null);
        }
    };

    // 匿名ユーザー向けのメッセージ
    const isAnonymous = !currentUser || currentUser.isAnonymous;

    return (
        // オーバーレイ
        <div
            style={{
                position: 'fixed', inset: 0, zIndex: 3000,
                backgroundColor: 'rgba(0,0,0,0.6)',
                display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            }}
            onClick={onClose}
        >
            {/* モーダル本体 */}
            <div
                style={{
                    width: '100%', maxWidth: '500px',
                    backgroundColor: 'white',
                    borderTopLeftRadius: '20px', borderTopRightRadius: '20px',
                    padding: '24px 20px',
                    paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
                    animation: 'slideUp 0.25s ease-out',
                    maxHeight: '85vh', display: 'flex', flexDirection: 'column',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* ヘッダー */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#15803D' }}>
                            🟢 お散歩異常なし報告
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#6B7280', marginTop: '4px' }}>
                            今日歩いたコースに問題はありませんでしたか？
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#9CA3AF', padding: '4px', flexShrink: 0 }}
                        aria-label="閉じる"
                    >✕</button>
                </div>

                <div style={{ borderTop: '1px solid #E5E7EB', margin: '12px 0' }} />

                {/* コンテンツ */}
                <div style={{ overflowY: 'auto', flex: 1 }}>
                    {isLoading ? (
                        <div style={{ textAlign: 'center', padding: '32px', color: '#6B7280' }}>
                            読み込み中...
                        </div>
                    ) : isAnonymous ? (
                        // 匿名ユーザー向け
                        <div style={{ textAlign: 'center', padding: '16px' }}>
                            <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🔒</div>
                            <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                                この機能はGoogle登録ユーザー限定です
                            </div>
                            <div style={{ fontSize: '0.82rem', color: '#6B7280', marginBottom: '20px' }}>
                                安全報告機能を利用するには、マイページからGoogleアカウントで登録してください。
                            </div>
                            <button
                                onClick={() => { onClose(); navigate('/profile'); }}
                                style={{
                                    padding: '12px 24px', borderRadius: '12px', border: 'none',
                                    backgroundColor: '#22C55E', color: 'white',
                                    fontWeight: 'bold', fontSize: '0.95rem', cursor: 'pointer',
                                }}
                            >
                                マイページへ →
                            </button>
                        </div>
                    ) : routes.length === 0 ? (
                        // ルート未登録ユーザー向け
                        <div style={{ textAlign: 'center', padding: '16px' }}>
                            <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🗺️</div>
                            <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                                まだお散歩コースが登録されていません
                            </div>
                            <div style={{ fontSize: '0.82rem', color: '#6B7280', marginBottom: '20px', lineHeight: 1.5 }}>
                                まずはマイページから MYお散歩ルートを登録してね！<br />
                                登録したルートで安全報告ができるようになります🐾
                            </div>
                            <button
                                onClick={() => { onClose(); navigate('/profile'); }}
                                style={{
                                    padding: '12px 24px', borderRadius: '12px', border: 'none',
                                    backgroundColor: '#22C55E', color: 'white',
                                    fontWeight: 'bold', fontSize: '0.95rem', cursor: 'pointer',
                                    boxShadow: '0 4px 6px rgba(34,197,94,0.25)',
                                }}
                            >
                                🗺️ MYルートを登録しに行く
                            </button>
                        </div>
                    ) : (
                        // ルート一覧
                        <>
                            <div style={{ fontSize: '0.85rem', color: '#374151', fontWeight: 'bold', marginBottom: '12px' }}>
                                どのコースを歩きましたか？
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {routes.map((route) => {
                                    const isSelected = selectedRouteId === route.id;
                                    return (
                                        <button
                                            key={route.id}
                                            onClick={() => handleReport(route)}
                                            disabled={isSubmitting}
                                            style={{
                                                width: '100%',
                                                padding: '14px 16px',
                                                borderRadius: '12px',
                                                border: `2px solid ${isSelected ? '#22C55E' : '#D1FAE5'}`,
                                                backgroundColor: isSelected ? '#F0FDF4' : 'white',
                                                textAlign: 'left',
                                                cursor: isSubmitting ? 'default' : 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '12px',
                                                transition: 'all 0.15s',
                                                opacity: isSubmitting && !isSelected ? 0.5 : 1,
                                            }}
                                        >
                                            {/* アイコン */}
                                            <div style={{
                                                width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
                                                backgroundColor: '#DCFCE7',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '1.3rem',
                                            }}>
                                                {isSelected && isSubmitting ? '⏳' : '🟢'}
                                            </div>
                                            {/* テキスト */}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontWeight: 'bold', fontSize: '0.95rem', color: '#15803D', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {route.name}
                                                </div>
                                                <div style={{ fontSize: '0.72rem', color: '#6B7280', marginTop: '2px' }}>
                                                    {route.totalDistanceM ? `約${(route.totalDistanceM / 1000).toFixed(1)}km` : ''}
                                                    {route.publicPath?.length === 0 && (
                                                        <span style={{ color: '#F59E0B', marginLeft: '6px' }}>⚠️ 公開パスなし</span>
                                                    )}
                                                </div>
                                            </div>
                                            {/* 矢印 */}
                                            <div style={{ color: '#22C55E', flexShrink: 0 }}>›</div>
                                        </button>
                                    );
                                })}
                            </div>

                            <div style={{ marginTop: '16px', padding: '10px 12px', backgroundColor: '#F0FDF4', borderRadius: '10px', fontSize: '0.72rem', color: '#4B5563', lineHeight: 1.5 }}>
                                🔒 報告内容は自宅バレ防止フィルター適用済みの公開パスのみが記録されます。位置情報の精度は保護されています。
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SafetyReportModal;
