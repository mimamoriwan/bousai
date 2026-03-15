import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, useMapEvents } from 'react-leaflet';
import { db } from '../firebase';
import {
    collection, addDoc, doc, setDoc, serverTimestamp,
} from 'firebase/firestore';
import toast from 'react-hot-toast';
import { applyPrivacyFilter, totalRouteDistance } from '../utils/routeUtils';

// ──────────────────────────────────────────────────────────────
// マップクリックでポイントを追加するコンポーネント
// ──────────────────────────────────────────────────────────────
const ClickHandler = ({ onMapClick }) => {
    useMapEvents({
        click(e) {
            onMapClick([e.latlng.lat, e.latlng.lng]);
        },
    });
    return null;
};

// ──────────────────────────────────────────────────────────────
// RouteEditor
// Props:
//   currentUser  — Firebase User オブジェクト
//   onClose      — 閉じるときに呼ぶコールバック
//   editingRoute — 編集時は既存ルートオブジェクト、新規時は null
//                  { id, name, fullPath: [{lat,lng},...] }
// ──────────────────────────────────────────────────────────────
const RouteEditor = ({ currentUser, onClose, editingRoute = null }) => {
    const [points, setPoints] = useState([]); // [[lat,lng], ...]
    const [routeName, setRouteName] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [initialCenter, setInitialCenter] = useState([36.0834, 140.0766]);
    const [isLoading, setIsLoading] = useState(true);
    const mapRef = useRef(null);

    // 初期化：現在地取得 & 編集モードの場合は既存データをロード
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => setInitialCenter([pos.coords.latitude, pos.coords.longitude]),
                () => {},
                { enableHighAccuracy: true, timeout: 5000 }
            );
        }

        if (editingRoute) {
            // 編集モード: 既存ルートをロード
            setRouteName(editingRoute.name || '');
            const existingPoints = (editingRoute.fullPath || []).map(
                (p) => [p.lat, p.lng]
            );
            setPoints(existingPoints);
            // 既存ルートの始点を地図の中心にする
            if (existingPoints.length > 0) {
                setInitialCenter(existingPoints[0]);
            }
        }
        setIsLoading(false);
    }, [editingRoute]);

    const handleMapClick = (latlng) => {
        setPoints((prev) => [...prev, latlng]);
    };

    const handleUndo = () => {
        setPoints((prev) => prev.slice(0, -1));
    };

    const handleClear = () => {
        if (points.length === 0) return;
        if (window.confirm('描いたルートをすべてクリアしますか？')) {
            setPoints([]);
        }
    };

    const handleSave = async () => {
        if (!routeName.trim()) {
            toast.error('ルート名を入力してください🐾');
            return;
        }
        if (points.length < 2) {
            toast.error('ルートは2点以上必要です🐾');
            return;
        }

        setIsSaving(true);
        try {
            // fullPath: [[lat,lng]] → [{lat,lng}]
            const fullPath = points.map(([lat, lng]) => ({ lat, lng }));

            // プライバシーフィルター適用（両端150m切り落とし）
            const { publicPath, totalDistanceM, tooShort } = applyPrivacyFilter(fullPath, 150);

            if (tooShort) {
                toast('ルートが短いため、公開用パスは生成されません（プライバシー保護）。\nルートは保存されます。', {
                    icon: '⚠️',
                    duration: 5000,
                });
            }

            const routeData = {
                name: routeName.trim(),
                fullPath,
                publicPath,
                totalDistanceM: Math.round(totalDistanceM),
                updatedAt: Date.now(),
            };

            const routesRef = collection(db, 'users', currentUser.uid, 'routes');

            if (editingRoute?.id) {
                // 既存ルートの更新
                await setDoc(doc(routesRef, editingRoute.id), routeData, { merge: true });
            } else {
                // 新規ルートの追加
                await addDoc(routesRef, {
                    ...routeData,
                    createdAt: Date.now(),
                });
            }

            toast.success(`「${routeName.trim()}」を保存しました🐾`);
            onClose();
        } catch (err) {
            console.error('保存エラー:', err);
            toast.error('保存に失敗しました。もう一度お試しください。');
        } finally {
            setIsSaving(false);
        }
    };

    const canSave = routeName.trim().length > 0 && points.length >= 2 && !isSaving;

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9000,
            backgroundColor: 'rgba(0,0,0,0.75)',
            display: 'flex', flexDirection: 'column',
        }}>
            {/* ── ヘッダー ── */}
            <div style={{
                backgroundColor: 'white',
                padding: '12px 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                borderBottom: '1px solid #E5E7EB',
                flexShrink: 0,
            }}>
                <div>
                    <div style={{ fontWeight: 'bold', fontSize: '1rem' }}>
                        {editingRoute ? '✏️ ルートを編集' : '🗺️ 新しいルートを登録'}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#6B7280', marginTop: '2px' }}>
                        マップをタップしてルートを描いてください
                    </div>
                </div>
                <button
                    onClick={onClose}
                    style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#6B7280', padding: '4px' }}
                    aria-label="閉じる"
                >✕</button>
            </div>

            {/* ── マップ ── */}
            <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
                {isLoading ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', backgroundColor: '#F9FAFB' }}>
                        <div style={{ textAlign: 'center', color: '#6B7280' }}>読み込み中...🐾</div>
                    </div>
                ) : (
                    <MapContainer
                        center={initialCenter}
                        zoom={16}
                        style={{ width: '100%', height: '100%' }}
                        ref={mapRef}
                        zoomControl={true}
                    >
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        <ClickHandler onMapClick={handleMapClick} />

                        {/* 編集中のルート */}
                        {points.length >= 2 && (
                            <Polyline
                                positions={points}
                                pathOptions={{ color: '#22C55E', weight: 5, opacity: 0.9 }}
                            />
                        )}
                        {/* 始点・終点マーカー（疑似的にPolylineで表現） */}
                        {points.length >= 1 && (
                            <Polyline
                                positions={[points[0], points[0]]}
                                pathOptions={{ color: '#16A34A', weight: 12, opacity: 0.9, lineCap: 'round' }}
                            />
                        )}
                        {points.length >= 2 && (
                            <Polyline
                                positions={[points[points.length - 1], points[points.length - 1]]}
                                pathOptions={{ color: '#DC2626', weight: 12, opacity: 0.9, lineCap: 'round' }}
                            />
                        )}
                    </MapContainer>
                )}

                {/* ポイント数バッジ */}
                <div style={{
                    position: 'absolute', top: '12px', left: '50%', transform: 'translateX(-50%)',
                    backgroundColor: 'rgba(0,0,0,0.65)', color: 'white',
                    padding: '5px 12px', borderRadius: '20px', fontSize: '0.8rem',
                    zIndex: 1000, whiteSpace: 'nowrap', pointerEvents: 'none',
                }}>
                    {points.length === 0
                        ? 'マップをタップしてルートを描こう'
                        : `📍 ${points.length}ポイント`}
                </div>
            </div>

            {/* ── フッター（ルート名 + 操作ボタン） ── */}
            <div style={{
                backgroundColor: 'white',
                padding: '12px 16px',
                paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
                borderTop: '1px solid #E5E7EB',
                flexShrink: 0,
            }}>
                {/* ルート名入力 */}
                <div style={{ marginBottom: '10px' }}>
                    <input
                        type="text"
                        placeholder="ルート名を入力（例：いつもの公園コース）"
                        value={routeName}
                        onChange={(e) => setRouteName(e.target.value)}
                        maxLength={40}
                        style={{
                            width: '100%', padding: '10px 12px', borderRadius: '10px',
                            border: '1.5px solid #D1D5DB', fontSize: '0.95rem',
                            outline: 'none', boxSizing: 'border-box',
                            backgroundColor: '#F9FAFB',
                        }}
                        onFocus={(e) => e.target.style.borderColor = '#22C55E'}
                        onBlur={(e) => e.target.style.borderColor = '#D1D5DB'}
                    />
                </div>

                {/* Undo / Clear */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                    <button
                        onClick={handleUndo}
                        disabled={points.length === 0}
                        style={{
                            flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid #D1D5DB',
                            backgroundColor: points.length === 0 ? '#F9FAFB' : 'white',
                            color: points.length === 0 ? '#9CA3AF' : '#374151',
                            fontWeight: 'bold', cursor: points.length === 0 ? 'default' : 'pointer',
                            fontSize: '0.9rem',
                        }}
                    >
                        ↩ 1つ戻す
                    </button>
                    <button
                        onClick={handleClear}
                        disabled={points.length === 0}
                        style={{
                            flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid #D1D5DB',
                            backgroundColor: points.length === 0 ? '#F9FAFB' : '#FEF2F2',
                            color: points.length === 0 ? '#9CA3AF' : '#DC2626',
                            fontWeight: 'bold', cursor: points.length === 0 ? 'default' : 'pointer',
                            fontSize: '0.9rem',
                        }}
                    >
                        🗑 クリア
                    </button>
                </div>

                {/* 保存ボタン */}
                <button
                    onClick={handleSave}
                    disabled={!canSave}
                    style={{
                        width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
                        backgroundColor: canSave ? '#22C55E' : '#D1D5DB',
                        color: canSave ? 'white' : '#9CA3AF',
                        fontWeight: 'bold', fontSize: '1rem',
                        cursor: canSave ? 'pointer' : 'default',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        boxShadow: canSave ? '0 4px 6px rgba(34,197,94,0.3)' : 'none',
                        transition: 'background-color 0.2s',
                    }}
                >
                    {isSaving ? '保存中...' : '🐾 このルートを保存する'}
                </button>

                {/* プライバシーフィルターの説明 */}
                <p style={{ textAlign: 'center', fontSize: '0.7rem', color: '#9CA3AF', margin: '6px 0 0', lineHeight: 1.4 }}>
                    🔒 自宅バレ防止のため、始点・終点から約150mは自動的に非公開化されます
                </p>
            </div>
        </div>
    );
};

export default RouteEditor;
