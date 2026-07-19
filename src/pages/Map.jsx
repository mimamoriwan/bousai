import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle } from 'react-leaflet';
import L from 'leaflet';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import shelters from '../data/shelters.json';
import { db, storage } from '../firebase';
import { collection, addDoc, serverTimestamp, GeoPoint } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';
import PullToRefresh from 'react-simple-pull-to-refresh';
import { BottomSheet } from 'react-spring-bottom-sheet';
import 'react-spring-bottom-sheet/dist/style.css';
import SafetyReportModal from '../components/SafetyReportModal';

// ── 切り出したモジュール ──
import { getMarkerIcon, shelterIcon } from '../constants/mapIcons';
import { useMapData } from '../hooks/useMapData';
import { useWalkHeatmap } from '../hooks/useWalkHeatmap';
import WalkControllerSheet from '../components/map/WalkControllerSheet';
import WalkHeatLayer from '../components/map/WalkHeatLayer';

const DEFAULT_LOCATION = [36.0834, 140.0766];
const toPublicSafetyCoordinate = (value) => Math.round(value * 1000) / 1000;
const WALK_ACTION_META = {
    sniff: { label: 'くん活', emoji: '🐕' },
    pee: { label: 'おしっこ', emoji: '💧' },
    poop: { label: 'うんち', emoji: '💩' },
    mark: { label: 'マーキング', emoji: '📍' },
};

const getLocationErrorMessage = (error) => {
    if (!navigator.geolocation) {
        return 'このブラウザは位置情報に対応していないため、つくば駅周辺を表示しています。';
    }
    if (error?.code === 1) {
        return '位置情報が許可されていないため、つくば駅周辺を表示しています。ブラウザの位置情報設定をご確認ください。';
    }
    if (error?.code === 3) {
        return '現在地の取得が時間切れになったため、つくば駅周辺を表示しています。';
    }
    return '現在地を取得できなかったため、つくば駅周辺を表示しています。';
};

// ─────────────────────────────────────────
// LocationMarker: 初期取得と再取得で共有する現在地ピン
// ─────────────────────────────────────────
const LocationMarker = ({ position }) => {
    const currentLocationIcon = L.divIcon({
        className: 'user-location-icon',
        html: '<div style="background-color: #2563EB; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 0 3px rgba(37,99,235,0.25), 0 2px 6px rgba(0,0,0,0.35);"></div>',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });

    if (!position) return null;

    const center = [position.lat, position.lng];
    const accuracy = Number.isFinite(position.accuracy) ? position.accuracy : null;

    return (
        <>
            {accuracy && (
                <Circle
                    center={center}
                    radius={Math.max(accuracy, 10)}
                    pathOptions={{
                        color: '#2563EB',
                        weight: 1,
                        opacity: 0.35,
                        fillColor: '#60A5FA',
                        fillOpacity: 0.12,
                    }}
                />
            )}
            <Marker position={center} icon={currentLocationIcon} zIndexOffset={10000}>
                <Popup>
                    <strong>現在地</strong>
                    {accuracy && <><br /><span>精度 約{Math.round(accuracy)}m</span></>}
                </Popup>
            </Marker>
        </>
    );
};

// ─────────────────────────────────────────
// ユーティリティ：相対時間のフォーマット
// ─────────────────────────────────────────
const getRelativeTime = (timestamp) => {
    if (!timestamp) return '日付不明';
    const now = new Date();
    const postDate = new Date(timestamp);
    const diffMins = Math.floor((now - postDate) / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60)  return diffMins <= 1 ? 'たった今' : `${diffMins}分前`;
    if (diffHours < 24) return `${diffHours}時間前`;
    if (diffDays === 1) return '昨日';
    if (diffDays < 7)   return `${diffDays}日前`;
    return `${postDate.getFullYear()}/${String(postDate.getMonth() + 1).padStart(2, '0')}/${String(postDate.getDate()).padStart(2, '0')}`;
};

// ─────────────────────────────────────────
// MapPage メインコンポーネント
// ─────────────────────────────────────────
const MapPage = () => {
    // ── Firestore データ & CRUD（カスタムフック） ──
    const {
        userPosts,
        safetyReports,
        walkActions,
        fetchLatestPins,
        handleThanks,
        handleSavePost,
        handleResolve,
        deletePost,
        deleteWalkAction,
    } = useMapData();
    const { cells: walkHeatmapCells, isLoading: isWalkHeatmapLoading } = useWalkHeatmap();

    // ── UI 状態 ──
    const [filter, setFilter] = useState('all');
    const [activeMapLayer, setActiveMapLayer] = useState('public');
    const [showArchived, setShowArchived] = useState(false);

    const [isSelectingLocation, setIsSelectingLocation] = useState(false);
    const [isSelectingSafetyLocation, setIsSelectingSafetyLocation] = useState(false);
    const [pendingWalkAction, setPendingWalkAction] = useState(null);
    const [showPostOptions, setShowPostOptions] = useState(false);
    const [tempPost, setTempPost] = useState(null);
    const [postForm, setPostForm] = useState({ type: 'danger', title: '', note: '', image: null, visibility: 'public' });
    const [isProcessingImage, setIsProcessingImage] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // クイック投稿
    const [showQuickPostSheet, setShowQuickPostSheet] = useState(false);
    const [quickPostStep, setQuickPostStep] = useState(1);
    const [quickPostData, setQuickPostData] = useState({ title: '', type: 'danger' });
    const [quickPostStatus, setQuickPostStatus] = useState('');
    const [showSuccessToast, setShowSuccessToast] = useState(false);

    // 安全報告 / お散歩記録
    const [showSafetyReport, setShowSafetyReport] = useState(false);
    const [isWalkRecording, setIsWalkRecording] = useState(false);

    // 表示モード
    const [displayMode, setDisplayMode] = useState('alert');

    // スポット安全報告ローディング
    const [isSpotReporting, setIsSpotReporting] = useState(false);
    const [isWalkActionSaving, setIsWalkActionSaving] = useState(false);
    const isSelectingWalkLocation = Boolean(pendingWalkAction);
    const isSelectingAnyLocation = isSelectingLocation || isSelectingSafetyLocation || isSelectingWalkLocation;

    const { currentUser, currentUserHash, memberNumber } = useAuth();

    const mapRef = useRef(null);
    const quickPostLockRef = useRef(false);
    const quickPostImageLockRef = useRef(false);
    const markerRefs = useRef(new Map());
    const walkMarkerRefs = useRef(new Map());
    const [activePostId, setActivePostId] = useState(null);
    const [isMinTimeElapsed, setIsMinTimeElapsed] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setIsMinTimeElapsed(true), 1500);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        document.body.classList.toggle('spot-registration-open', Boolean(tempPost));
        return () => document.body.classList.remove('spot-registration-open');
    }, [tempPost]);

    // 初期位置取得
    const [initialCenter, setInitialCenter] = useState(null);
    const [currentPosition, setCurrentPosition] = useState(null);
    const [isLoadingLocation, setIsLoadingLocation] = useState(true);
    const [isRefreshingLocation, setIsRefreshingLocation] = useState(false);
    const [locationMessage, setLocationMessage] = useState('');

    useEffect(() => {
        if (!navigator.geolocation) {
            setInitialCenter(DEFAULT_LOCATION);
            setLocationMessage(getLocationErrorMessage());
            setIsLoadingLocation(false);
            return;
        }

        let settled = false;
        const finishWithFallback = (error) => {
            if (settled) return;
            settled = true;
            setInitialCenter(DEFAULT_LOCATION);
            setLocationMessage(getLocationErrorMessage(error));
            setIsLoadingLocation(false);
        };
        const timeoutId = setTimeout(() => {
            finishWithFallback({ code: 3 });
        }, 6000);

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                if (settled) return;
                settled = true;
                clearTimeout(timeoutId);
                const position = {
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    accuracy: pos.coords.accuracy,
                };
                setInitialCenter([position.lat, position.lng]);
                setCurrentPosition(position);
                setLocationMessage('');
                setIsLoadingLocation(false);
            },
            (err) => {
                clearTimeout(timeoutId);
                console.warn(`Geolocation error (${err.code}): ${err.message}`);
                finishWithFallback(err);
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
        return () => {
            settled = true;
            clearTimeout(timeoutId);
        };
    }, []);

    const moveToCurrentLocation = () => {
        if (showQuickPostSheet) closeQuickPost();
        if (isRefreshingLocation) return;

        if (!navigator.geolocation) {
            setLocationMessage(getLocationErrorMessage());
            return;
        }

        setIsRefreshingLocation(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const position = {
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    accuracy: pos.coords.accuracy,
                };
                const center = [position.lat, position.lng];
                setInitialCenter(center);
                setCurrentPosition(position);
                setLocationMessage('');
                if (mapRef.current) {
                    mapRef.current.setView(center, 16, { animate: true, duration: 0.5 });
                }
                setIsRefreshingLocation(false);
            },
            (error) => {
                console.warn('現在地取得エラー:', error);
                setLocationMessage(getLocationErrorMessage(error));
                setIsRefreshingLocation(false);
            },
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
        );
    };

    const handleRefresh = async () => {
        await fetchLatestPins();
    };

    // ── 通常投稿フォームの送信 ──
    const handlePostSubmit = async (e) => {
        e.preventDefault();
        if (!tempPost || !currentUser) return;
        setIsSubmitting(true);
        try {
            let imageUrl = null;
            let imagePath = null;
            if (postForm.image) {
                const mimeTypeMatch = postForm.image.match(/data:(.*?);/);
                const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/jpeg';
                const ext = mimeType === 'image/webp' ? 'webp' : 'jpg';
                const filename = `map_pins/${currentUser.uid}/${Date.now()}.${ext}`;
                const storageRef = ref(storage, filename);
                await uploadString(storageRef, postForm.image, 'data_url');
                imageUrl = await getDownloadURL(storageRef);
                imagePath = filename;
            }

            await addDoc(collection(db, 'map_pins'), {
                lat: tempPost.lat,
                lng: tempPost.lng,
                type: postForm.type,
                title: postForm.title,
                note: postForm.note,
                date: new Date().toLocaleDateString(),
                timestamp: Date.now(),
                imageUrl,
                imagePath,
                resolved: false,
                thanks: [],
                savedBy: [],
                visibility: postForm.visibility || 'public',
                userHash: currentUserHash ?? null,
                ownerUid: currentUser.uid,
            });

            setTempPost(null);
            setIsSelectingLocation(false);
            setPostForm({ type: 'danger', title: '', note: '', image: null, visibility: 'public' });
            setIsProcessingImage(false);
        } catch (error) {
            console.error('投稿保存エラー:', error);
            alert('投稿の保存に失敗しました。もう一度お試しください。');
        } finally {
            setIsSubmitting(false);
        }
    };

    // ── クイック投稿の送信 ──
    const closeQuickPost = () => {
        if (quickPostLockRef.current || quickPostImageLockRef.current || isProcessingImage) return;
        setShowQuickPostSheet(false);
        setQuickPostStep(1);
        setQuickPostStatus('');
        setPostForm(prev => ({ ...prev, image: null }));
    };

    const startMapLocationSelection = ({ quickPost = null, image = null, locationError, notifyLocationFailure = false } = {}) => {
        setShowPostOptions(false);
        setShowQuickPostSheet(false);
        setQuickPostStep(1);
        setIsSelectingSafetyLocation(false);
        if (quickPost) {
            setPostForm(prev => ({
                ...prev,
                type: quickPost.type,
                title: quickPost.title,
                note: '',
                image,
                visibility: 'public',
            }));
        }
        setIsSelectingLocation(true);

        if (notifyLocationFailure) {
            setLocationMessage(getLocationErrorMessage(locationError));
            import('react-hot-toast').then(({ default: toast }) => {
                toast('現在地を取得できないため、地図から投稿場所を選んでください。', { icon: '🗺️' });
            });
        }
    };

    const persistSpotSafetyReport = async (lat, lng) => {
        if (!currentUser) throw new Error('Authenticated user is required');
        await addDoc(collection(db, 'safetyReports'), {
            reportType: 'spot',
            location: new GeoPoint(
                toPublicSafetyCoordinate(lat),
                toPublicSafetyCoordinate(lng)
            ),
            uid: currentUser.uid,
            createdAt: serverTimestamp(),
        });
        setDisplayMode('safety');
    };

    const showSpotSafetySuccess = () => {
        import('react-hot-toast').then(({ default: toast }) =>
            toast.success('安全を報告しました！ありがとうございます🐾', { duration: 3000 })
        );
    };

    const startSafetyLocationSelection = (locationError) => {
        setShowPostOptions(false);
        setShowQuickPostSheet(false);
        setIsSelectingLocation(false);
        setIsSelectingSafetyLocation(true);
        setLocationMessage(getLocationErrorMessage(locationError));
        import('react-hot-toast').then(({ default: toast }) => {
            toast('現在地を取得できないため、地図から安全な場所を選んでください。', { icon: '🗺️' });
        });
    };

    const handleCurrentSpotSafetyReport = async () => {
        setShowPostOptions(false);
        if (isSpotReporting) return;
        if (!navigator.geolocation) {
            startSafetyLocationSelection();
            return;
        }

        setIsSpotReporting(true);
        try {
            const pos = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 8000,
                    maximumAge: 0,
                });
            });
            await persistSpotSafetyReport(pos.coords.latitude, pos.coords.longitude);
            showSpotSafetySuccess();
        } catch (err) {
            if (err?.code === 1 || err?.code === 2 || err?.code === 3) {
                console.warn('安全スポットの位置情報取得エラー:', err);
                startSafetyLocationSelection(err);
            } else {
                console.error('スポット安全報告の保存エラー:', err);
                import('react-hot-toast').then(({ default: toast }) =>
                    toast.error('安全報告の保存に失敗しました。もう一度お試しください。')
                );
            }
        } finally {
            setIsSpotReporting(false);
        }
    };

    const handleSelectedSpotSafetyReport = async () => {
        if (!mapRef.current || isSpotReporting) return;
        const center = mapRef.current.getCenter();
        setIsSpotReporting(true);
        try {
            await persistSpotSafetyReport(center.lat, center.lng);
            setIsSelectingSafetyLocation(false);
            showSpotSafetySuccess();
        } catch (err) {
            console.error('選択した安全スポットの保存エラー:', err);
            import('react-hot-toast').then(({ default: toast }) =>
                toast.error('安全報告の保存に失敗しました。場所を確認してもう一度お試しください。')
            );
        } finally {
            setIsSpotReporting(false);
        }
    };

    const startWalkLocationSelection = ({ actionType, label, locationError }) => {
        setShowPostOptions(false);
        setShowQuickPostSheet(false);
        setIsSelectingLocation(false);
        setIsSelectingSafetyLocation(false);
        setPendingWalkAction({ actionType, label });
        setLocationMessage(getLocationErrorMessage(locationError));
    };

    const handleSelectedWalkAction = async () => {
        if (!mapRef.current || !currentUser || !pendingWalkAction || isWalkActionSaving) return;
        const center = mapRef.current.getCenter();
        setIsWalkActionSaving(true);
        try {
            await addDoc(collection(db, 'walkActions'), {
                uid: currentUser.uid,
                actionType: pendingWalkAction.actionType,
                lat: center.lat,
                lng: center.lng,
                timestamp: Date.now(),
                createdAt: serverTimestamp(),
            });
            const completedLabel = pendingWalkAction.label;
            setPendingWalkAction(null);
            setActiveMapLayer('myMap');
            setDisplayMode('alert');
            setFilter('walk');
            import('react-hot-toast').then(({ default: toast }) => {
                toast.success(`${completedLabel}を記録しました🐾`, { duration: 2500, icon: '📍' });
            });
        } catch (error) {
            console.error('選択したお散歩アクションの保存エラー:', error);
            import('react-hot-toast').then(({ default: toast }) => {
                toast.error('記録の保存に失敗しました。場所を確認してもう一度お試しください。');
            });
        } finally {
            setIsWalkActionSaving(false);
        }
    };

    const handleQuickPostSubmit = async (withPhoto = false, imageDataUrl = null) => {
        if (!currentUser || quickPostLockRef.current) return;
        quickPostLockRef.current = true;
        setIsSubmitting(true);
        setQuickPostStatus('現在地を確認中...');
        let uploadedImageRef = null;
        try {
            let lat, lng;
            try {
                const pos = await new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 5000 });
                });
                lat = pos.coords.latitude;
                lng = pos.coords.longitude;
            } catch (err) {
                console.warn('クイック投稿の位置取得失敗:', err);
                startMapLocationSelection({
                    quickPost: quickPostData,
                    image: withPhoto ? (imageDataUrl || postForm.image) : null,
                    locationError: err,
                    notifyLocationFailure: true,
                });
                return;
            }

            let imageUrl = null;
            let imagePath = null;
            const finalImage = imageDataUrl || postForm.image;
            if (withPhoto && finalImage) {
                setQuickPostStatus('写真を保存中...');
                const mimeTypeMatch = finalImage.match(/data:(.*?);/);
                const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/jpeg';
                const ext = mimeType === 'image/webp' ? 'webp' : 'jpg';
                const filename = `map_pins/${currentUser.uid}/${Date.now()}.${ext}`;
                const storageRef = ref(storage, filename);
                await uploadString(storageRef, finalImage, 'data_url');
                imageUrl = await getDownloadURL(storageRef);
                imagePath = filename;
                uploadedImageRef = storageRef;
            }

            setQuickPostStatus('投稿を保存中...');
            await addDoc(collection(db, 'map_pins'), {
                lat, lng,
                type: quickPostData.type,
                title: quickPostData.title,
                note: '',
                date: new Date().toLocaleDateString(),
                timestamp: Date.now(),
                imageUrl,
                imagePath,
                resolved: false,
                thanks: [],
                savedBy: [],
                visibility: 'public',
                userHash: currentUserHash ?? null,
                ownerUid: currentUser.uid,
            });

            setShowQuickPostSheet(false);
            setQuickPostStep(1);
            setPostForm(prev => ({ ...prev, image: null }));
            setShowSuccessToast(true);
            setTimeout(() => setShowSuccessToast(false), 3000);
        } catch (error) {
            console.error('クイック投稿エラー:', error);
            if (uploadedImageRef) {
                await deleteObject(uploadedImageRef).catch((cleanupError) => {
                    console.error('未使用画像の削除失敗:', cleanupError);
                });
            }
            const { default: toast } = await import('react-hot-toast');
            toast.error('投稿の保存に失敗しました。内容を保ったまま、もう一度お試しください。');
        } finally {
            quickPostLockRef.current = false;
            setIsSubmitting(false);
            setQuickPostStatus('');
        }
    };

    const isQuickPostBusy = isSubmitting || isProcessingImage;

    // ── 表示フィルタリング ──
    const displayPosts = userPosts.filter(post => {
        if (post.type === 'shelter' && filter !== 'shelter') return false;

        if (activeMapLayer === 'myMap') {
            if (!currentUser) return false;
            const isMine = Boolean(
                (currentUser && post.ownerUid === currentUser.uid)
                || (currentUserHash && post.userHash && post.userHash === currentUserHash)
            );
            const isSaved = Boolean(currentUserHash && post.savedBy?.includes(currentUserHash));
            if (!isMine && !isSaved) return false;
            if (filter !== 'all' && filter !== 'resolved') {
                if (filter === 'walk') {
                    if (!post.type.startsWith('walk') && post.type !== 'useful') return false;
                } else {
                    if (post.type !== filter) return false;
                }
            }
            if (filter === 'resolved' && !post.resolved) return false;
            return true;
        } else {
            if (post.visibility === 'private') return false;
            if (filter === 'all' && post.resolved) return false;
            if (filter === 'resolved' && !post.resolved) return false;
            if (filter !== 'all' && filter !== 'resolved' && post.resolved) return false;
            if (filter === 'walk' && !post.type.startsWith('walk') && post.type !== 'useful') return false;
            if (filter !== 'all' && filter !== 'resolved' && filter !== 'walk' && post.type !== filter && !post.type.startsWith(filter)) return false;

            const timeLimit = (filter === 'plant' && post.type === 'plant')
                ? 14 * 24 * 60 * 60 * 1000
                : 48 * 60 * 60 * 1000;
            const isOld = post.timestamp ? (Date.now() - post.timestamp > timeLimit) : false;
            if (!showArchived && isOld) return false;
            return true;
        }
    });

    const displayWalkActions = activeMapLayer === 'myMap'
        && (filter === 'all' || filter === 'walk')
        ? walkActions
        : [];

    const handleListPostClick = (post) => {
        const map = mapRef.current;
        if (map) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            const zoom = 16;
            const targetPoint = map.project([post.lat, post.lng], zoom);
            targetPoint.y -= 120;
            const targetLatLng = map.unproject(targetPoint, zoom);
            map.flyTo(targetLatLng, zoom, { animate: true, duration: 0.5 });
        }
        const marker = markerRefs.current.get(post.id);
        if (marker) {
            if (activePostId === post.id) {
                marker.closePopup();
                setActivePostId(null);
            } else {
                marker.openPopup();
                setActivePostId(post.id);
            }
        }
    };

    const handleWalkActionClick = (action) => {
        const map = mapRef.current;
        if (map) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            map.flyTo([action.lat, action.lng], 17, { animate: true, duration: 0.5 });
        }
        walkMarkerRefs.current.get(action.id)?.openPopup();
    };

    // ─────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────
    return (
        <div className="map-page" style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>

            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                {(isLoadingLocation || !isMinTimeElapsed) ? (
                    <div style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        height: '100%', backgroundColor: '#FFF7ED',
                        color: 'var(--color-primary)', padding: '20px', textAlign: 'center'
                    }}>
                        <img
                            src="/main-visual.png"
                            alt="みまもりWAN!!"
                            style={{
                                width: '100%', maxWidth: '350px',
                                borderRadius: '16px',
                                boxShadow: '0 8px 16px rgba(0,0,0,0.1)',
                                marginBottom: '24px',
                                animation: 'fadeIn 0.5s ease-in'
                            }}
                        />
                        <div className="initial-spinner" style={{ width: '30px', height: '30px', borderWidth: '3px', marginBottom: '12px' }}></div>
                        <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>つくばの安全マップを準備中...🐾</div>
                        <style>{`
                            @keyframes fadeIn {
                                from { opacity: 0; transform: translateY(10px); }
                                to { opacity: 1; transform: translateY(0); }
                        `}</style>
                    </div>
                ) : (
                    <>
                        {/* Action Menu (FAB) & Top Overlays */}
                        {!isSelectingAnyLocation && (
                            <>
                                {/* ── 表示モード切り替えタブ ── */}
                                <div style={{
                                    position: 'absolute',
                                    top: '12px',
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    zIndex: 1100,
                                    display: 'flex',
                                    backgroundColor: 'rgba(255,255,255,0.95)',
                                    borderRadius: '28px',
                                    padding: '4px',
                                    boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
                                    gap: '2px',
                                    backdropFilter: 'blur(8px)',
                                }}>
                                    <button
                                        onClick={() => setDisplayMode('alert')}
                                        style={{
                                            padding: '8px 12px',
                                            borderRadius: '24px',
                                            border: 'none',
                                            cursor: 'pointer',
                                            fontWeight: 'bold',
                                            fontSize: '0.85rem',
                                            whiteSpace: 'nowrap',
                                            transition: 'all 0.2s',
                                            backgroundColor: displayMode === 'alert' ? '#F59E0B' : 'transparent',
                                            color: displayMode === 'alert' ? 'white' : '#6B7280',
                                            boxShadow: displayMode === 'alert' ? '0 2px 6px rgba(245,158,11,0.4)' : 'none',
                                        }}
                                    >
                                        ⚠️ 注意
                                    </button>
                                    <button
                                        onClick={() => setDisplayMode('safety')}
                                        style={{
                                            padding: '8px 12px',
                                            borderRadius: '24px',
                                            border: 'none',
                                            cursor: 'pointer',
                                            fontWeight: 'bold',
                                            fontSize: '0.85rem',
                                            whiteSpace: 'nowrap',
                                            transition: 'all 0.2s',
                                            backgroundColor: displayMode === 'safety' ? '#10B981' : 'transparent',
                                            color: displayMode === 'safety' ? 'white' : '#6B7280',
                                            boxShadow: displayMode === 'safety' ? '0 2px 6px rgba(16,185,129,0.4)' : 'none',
                                        }}
                                    >
                                        🟢 安全
                                    </button>
                                    <button
                                        onClick={() => {
                                            setActiveMapLayer('public');
                                            setDisplayMode('activity');
                                        }}
                                        style={{
                                            padding: '8px 12px',
                                            borderRadius: '24px',
                                            border: 'none',
                                            cursor: 'pointer',
                                            fontWeight: 'bold',
                                            fontSize: '0.85rem',
                                            whiteSpace: 'nowrap',
                                            transition: 'all 0.2s',
                                            backgroundColor: displayMode === 'activity' ? '#F97316' : 'transparent',
                                            color: displayMode === 'activity' ? 'white' : '#6B7280',
                                            boxShadow: displayMode === 'activity' ? '0 2px 6px rgba(249,115,22,0.35)' : 'none',
                                        }}
                                    >
                                        🐾 にぎわい
                                    </button>
                                </div>

                                {displayMode === 'activity' && (
                                    <div
                                        role="status"
                                        style={{
                                            position: 'absolute', top: '66px', left: '12px', right: '12px',
                                            zIndex: 1090, backgroundColor: 'rgba(255,255,255,0.94)',
                                            border: '1px solid #FED7AA', borderRadius: '12px',
                                            boxShadow: '0 3px 10px rgba(0,0,0,0.12)', padding: '8px 10px',
                                            color: '#9A3412', fontSize: '0.72rem', lineHeight: 1.4,
                                            textAlign: 'center',
                                        }}
                                    >
                                        {isWalkHeatmapLoading
                                            ? '🐾 地域のお散歩傾向を集計中...'
                                            : walkHeatmapCells.length > 0
                                                ? '🐾 3人以上の記録を約250m単位でぼかして表示しています'
                                                : '🐾 まだ公開できる人数に達した地域はありません'}
                                    </div>
                                )}

                                {locationMessage && (
                                    <div
                                        role="status"
                                        style={{
                                            position: 'absolute', top: displayMode === 'activity' ? '122px' : '70px', left: '12px', right: '12px',
                                            zIndex: 1090, backgroundColor: 'rgba(255,255,255,0.96)',
                                            border: '1px solid #FDBA74', borderRadius: '12px',
                                            boxShadow: '0 3px 10px rgba(0,0,0,0.14)', padding: '9px 10px',
                                            display: 'flex', alignItems: 'center', gap: '8px',
                                            color: '#9A3412', fontSize: '0.75rem', lineHeight: 1.4,
                                        }}
                                    >
                                        <span aria-hidden="true">📍</span>
                                        <span style={{ flex: 1 }}>{locationMessage}</span>
                                        <button
                                            type="button"
                                            onClick={moveToCurrentLocation}
                                            disabled={isRefreshingLocation}
                                            style={{
                                                flexShrink: 0, border: '1px solid #FB923C', borderRadius: '9px',
                                                backgroundColor: '#FFF7ED', color: '#C2410C',
                                                padding: '6px 8px', fontWeight: 'bold', cursor: 'pointer',
                                            }}
                                        >
                                            {isRefreshingLocation ? '取得中…' : '再試行'}
                                        </button>
                                    </div>
                                )}

                                {/* 現在地へ戻る FAB */}
                                <div style={{ position: 'absolute', bottom: 'calc(25vh + 100px)', right: '20px', zIndex: 1000 }}>
                                    <button
                                        onClick={moveToCurrentLocation}
                                        disabled={isRefreshingLocation}
                                        aria-busy={isRefreshingLocation}
                                        style={{
                                            backgroundColor: 'white',
                                            color: 'var(--color-primary)',
                                            width: '50px', height: '50px',
                                            borderRadius: '50%',
                                            boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '1.6rem',
                                            transition: 'transform 0.1s, background-color 0.2s',
                                            cursor: 'pointer', border: 'none', padding: 0
                                        }}
                                        onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.9)'}
                                        onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                        onTouchStart={(e) => e.currentTarget.style.transform = 'scale(0.9)'}
                                        onTouchEnd={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                        title="現在地に戻る"
                                        aria-label="現在地に戻る"
                                    >
                                        {isRefreshingLocation ? (
                                            <span aria-hidden="true" style={{ fontSize: '1rem' }}>…</span>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="28px" height="28px" aria-hidden="true">
                                                <path d="M11 2h2v2.07A8.002 8.002 0 0 1 19.93 11H22v2h-2.07A8.002 8.002 0 0 1 13 19.93V22h-2v-2.07A8.002 8.002 0 0 1 4.07 13H2v-2h2.07A8.002 8.002 0 0 1 11 4.07V2Zm1 4a6 6 0 1 0 0 12 6 6 0 0 0 0-12Zm0 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z" />
                                            </svg>
                                        )}
                                    </button>
                                </div>

                                {/* 🐾 アクションメニュー FAB */}
                                <div style={{ position: 'absolute', bottom: 'calc(25vh + 30px)', right: '16px', zIndex: 1000 }}>
                                    <button
                                        onClick={() => {
                                            if (showQuickPostSheet) {
                                                closeQuickPost();
                                                return;
                                            }
                                            setShowPostOptions(!showPostOptions);
                                        }}
                                        className="btn"
                                        style={{
                                            backgroundColor: 'var(--color-primary)',
                                            color: 'white',
                                            width: '60px', height: '60px',
                                            borderRadius: '50%',
                                            boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '1.8rem',
                                            transition: 'background-color 0.3s, transform 0.2s',
                                            padding: 0
                                        }}
                                    >
                                        🐾
                                    </button>
                                </div>
                            </>
                        )}

                        {/* ── アクション選択シート ── */}
                        {showPostOptions && (
                            <div
                                style={{
                                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                                    backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 2000,
                                    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                                }}
                                onClick={() => setShowPostOptions(false)}
                            >
                                <div
                                    className="card"
                                    style={{
                                        width: '100%', maxWidth: '500px', margin: 0,
                                        borderBottomLeftRadius: 0, borderBottomRightRadius: 0,
                                        padding: 0,
                                        animation: 'slideUp 0.3s ease-out',
                                        maxHeight: '85dvh',
                                        display: 'flex', flexDirection: 'column', overflow: 'hidden',
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <div style={{ padding: '18px 20px 14px', flexShrink: 0, borderBottom: '1px solid #F3F4F6' }}>
                                        <h3 style={{ textAlign: 'center', margin: 0, fontSize: '1.05rem', color: '#374151' }}>アクションを選択</h3>
                                    </div>

                                    <div style={{
                                        overflowY: 'auto',
                                        WebkitOverflowScrolling: 'touch',
                                        overscrollBehaviorY: 'contain',
                                        flex: 1,
                                        padding: '10px 12px',
                                        paddingBottom: 'max(70px, env(safe-area-inset-bottom))',
                                    }}>
                                        <div style={{
                                            display: 'grid', gridTemplateColumns: '1fr 1fr',
                                            gap: '7px', marginBottom: '8px',
                                        }}>
                                            {/* 📍 現在地で報告 */}
                                            <button
                                                onClick={() => {
                                                    setShowPostOptions(false);
                                                    if (navigator.geolocation) {
                                                        navigator.geolocation.getCurrentPosition(
                                                            (pos) => setTempPost({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                                                            (err) => {
                                                                console.warn('Geolocation fallback:', err);
                                                                startMapLocationSelection({ locationError: err, notifyLocationFailure: true });
                                                            },
                                                            { enableHighAccuracy: true, timeout: 5000 }
                                                        );
                                                    } else {
                                                        startMapLocationSelection({ notifyLocationFailure: true });
                                                    }
                                                }}
                                                style={{
                                                    padding: '10px 8px', borderRadius: '12px', border: 'none',
                                                    backgroundColor: 'var(--color-primary)', color: 'white',
                                                    fontWeight: 'bold', cursor: 'pointer',
                                                    display: 'flex', flexDirection: 'row',
                                                    alignItems: 'center', justifyContent: 'center', gap: '6px',
                                                    boxShadow: '0 2px 6px rgba(255,111,0,0.3)',
                                                    fontSize: '0.78rem',
                                                }}
                                            >
                                                <span style={{ fontSize: '1.2rem' }}>📍</span>
                                                現在地で報告
                                            </button>

                                            {/* 🗺️ 地図から選ぶ */}
                                            <button
                                                onClick={() => startMapLocationSelection()}
                                                style={{
                                                    padding: '10px 8px', borderRadius: '12px',
                                                    backgroundColor: '#F3F4F6', color: '#1F2937',
                                                    border: '1px solid #E5E7EB', fontWeight: 'bold', cursor: 'pointer',
                                                    display: 'flex', flexDirection: 'row',
                                                    alignItems: 'center', justifyContent: 'center', gap: '6px',
                                                    fontSize: '0.78rem',
                                                }}
                                            >
                                                <span style={{ fontSize: '1.2rem' }}>🗺️</span>
                                                地図から選ぶ
                                            </button>

                                            {/* ⚡️ クイック投稿 */}
                                            <button
                                                onClick={() => { setShowPostOptions(false); setQuickPostStep(1); setShowQuickPostSheet(true); }}
                                                style={{
                                                    padding: '10px 8px', borderRadius: '12px',
                                                    backgroundColor: '#FFF7ED', color: '#EA580C',
                                                    border: '1px solid #FED7AA', fontWeight: 'bold', cursor: 'pointer',
                                                    display: 'flex', flexDirection: 'row',
                                                    alignItems: 'center', justifyContent: 'center', gap: '6px',
                                                    fontSize: '0.78rem',
                                                }}
                                            >
                                                <span style={{ fontSize: '1.2rem' }}>⚡️</span>
                                                クイック投稿
                                            </button>

                                            {/* 🟢 スポット安全報告 */}
                                            <button
                                                onClick={handleCurrentSpotSafetyReport}
                                                disabled={isSpotReporting}
                                                style={{
                                                    padding: '10px 8px', borderRadius: '12px',
                                                    backgroundColor: isSpotReporting ? '#D1FAE5' : '#ECFDF5',
                                                    color: '#065F46',
                                                    border: '1px solid #6EE7B7', fontWeight: 'bold',
                                                    cursor: isSpotReporting ? 'default' : 'pointer',
                                                    display: 'flex', flexDirection: 'row',
                                                    alignItems: 'center', justifyContent: 'center', gap: '6px',
                                                    fontSize: '0.78rem',
                                                }}
                                            >
                                                {isSpotReporting ? (
                                                    <>
                                                        <span style={{
                                                            width: '16px', height: '16px',
                                                            border: '2px solid rgba(6,95,70,0.3)',
                                                            borderTopColor: '#065F46',
                                                            borderRadius: '50%',
                                                            display: 'inline-block',
                                                            animation: 'spin 0.8s linear infinite',
                                                            flexShrink: 0,
                                                        }} />
                                                        取得中...
                                                    </>
                                                ) : (
                                                    <>
                                                        <span style={{ fontSize: '1.2rem' }}>🟢</span>
                                                        今ここ安全！
                                                    </>
                                                )}
                                            </button>

                                            {/* ✅ お散歩異常なし報告 */}
                                            <button
                                                onClick={() => { setShowPostOptions(false); setShowSafetyReport(true); }}
                                                style={{
                                                    padding: '10px 8px', borderRadius: '12px',
                                                    backgroundColor: '#F0FDF4', color: '#15803D',
                                                    border: '1px solid #86EFAC', fontWeight: 'bold', cursor: 'pointer',
                                                    display: 'flex', flexDirection: 'row',
                                                    alignItems: 'center', justifyContent: 'center', gap: '6px',
                                                    fontSize: '0.78rem',
                                                }}
                                            >
                                                <span style={{ fontSize: '1.2rem' }}>✅</span>
                                                お散歩異常なし
                                            </button>

                                            {/* 🐾 お散歩記録をはじめる（全幅） */}
                                            <button
                                                onClick={() => { setShowPostOptions(false); setIsWalkRecording(true); }}
                                                style={{
                                                    gridColumn: '1 / -1',
                                                    padding: '12px 8px', borderRadius: '12px',
                                                    backgroundColor: '#FCE7F3', color: '#BE185D',
                                                    border: '1px solid #FBCFE8', fontWeight: 'bold', cursor: 'pointer',
                                                    display: 'flex', flexDirection: 'row',
                                                    alignItems: 'center', justifyContent: 'center', gap: '8px',
                                                    fontSize: '0.9rem',
                                                    boxShadow: '0 2px 4px rgba(190, 24, 93, 0.15)',
                                                    marginTop: '4px'
                                                }}
                                            >
                                                <span style={{ fontSize: '1.4rem' }}>🐾</span>
                                                お散歩記録をはじめる
                                            </button>
                                        </div>

                                        {/* マップ表示設定 */}
                                        <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: '8px', marginBottom: '6px' }}>
                                            <div style={{ fontSize: '0.72rem', color: '#9CA3AF', marginBottom: '5px', fontWeight: 'bold', letterSpacing: '0.04em' }}>マップ表示設定</div>

                                            <div style={{
                                                display: 'flex', backgroundColor: '#E5E7EB',
                                                borderRadius: '8px', padding: '3px', marginBottom: '5px',
                                            }}>
                                                <button
                                                    onClick={() => setActiveMapLayer('public')}
                                                    style={{
                                                        flex: 1, padding: '7px 4px', borderRadius: '5px', border: 'none',
                                                        backgroundColor: activeMapLayer === 'public' ? '#FFFFFF' : 'transparent',
                                                        color: activeMapLayer === 'public' ? 'var(--color-primary)' : '#6B7280',
                                                        fontWeight: activeMapLayer === 'public' ? 'bold' : '600',
                                                        fontSize: '0.78rem', cursor: 'pointer',
                                                        boxShadow: activeMapLayer === 'public' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                                        transition: 'all 0.2s',
                                                    }}
                                                >🌍 みんなのマップ</button>
                                                <button
                                                    onClick={() => {
                                                        if (!currentUser) {
                                                            alert('ゲスト情報を準備中です。少し待ってからもう一度お試しください。');
                                                            return;
                                                        }
                                                        setActiveMapLayer('myMap');
                                                        setDisplayMode('alert');
                                                        setFilter('all');
                                                    }}
                                                    style={{
                                                        flex: 1, padding: '7px 4px', borderRadius: '5px', border: 'none',
                                                        backgroundColor: activeMapLayer === 'myMap' ? '#FFFFFF' : 'transparent',
                                                        color: activeMapLayer === 'myMap' ? 'var(--color-primary)' : '#6B7280',
                                                        fontWeight: activeMapLayer === 'myMap' ? 'bold' : '600',
                                                        fontSize: '0.78rem', cursor: 'pointer',
                                                        boxShadow: activeMapLayer === 'myMap' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                                        transition: 'all 0.2s',
                                                    }}
                                                >🗺️ マイマップ</button>
                                            </div>

                                            {activeMapLayer === 'myMap' && currentUser?.isAnonymous && (
                                                <div style={{
                                                    marginBottom: '6px', padding: '7px 9px', borderRadius: '8px',
                                                    backgroundColor: '#FFF7ED', color: '#9A3412',
                                                    fontSize: '0.7rem', lineHeight: 1.45,
                                                }}>
                                                    🐾 ゲスト記録はこの端末で確認できます。Google連携すると機種変更後も引き継げます。
                                                </div>
                                            )}

                                            {activeMapLayer === 'public' && (
                                                <button
                                                    onClick={() => setShowArchived(!showArchived)}
                                                    style={{
                                                        width: '100%', marginBottom: '5px',
                                                        backgroundColor: showArchived ? 'var(--color-primary)' : '#F3F4F6',
                                                        color: showArchived ? 'white' : '#4B5563',
                                                        border: 'none', borderRadius: '8px',
                                                        padding: '8px', fontSize: '0.78rem', fontWeight: 'bold',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                                                        cursor: 'pointer', transition: 'all 0.2s',
                                                    }}
                                                >
                                                    🕒 過去情報: {showArchived ? 'ON' : 'OFF'}
                                                </button>
                                            )}
                                        </div>

                                        <button
                                            onClick={() => setShowPostOptions(false)}
                                            style={{
                                                width: '100%', padding: '11px',
                                                borderRadius: '10px',
                                                backgroundColor: '#F9FAFB',
                                                border: '1.5px solid #D1D5DB',
                                                color: '#6B7280', fontWeight: 'bold',
                                                fontSize: '0.88rem', cursor: 'pointer',
                                                display: 'flex', alignItems: 'center',
                                                justifyContent: 'center', gap: '6px',
                                            }}
                                        >
                                            ✕ 閉じる
                                        </button>
                                    </div>
                                </div>
                                <style>{`
                                    @keyframes slideUp {
                                        from { transform: translateY(100%); }
                                        to { transform: translateY(0); }
                                    }
                                `}</style>
                            </div>
                        )}

                        {/* ── 地図から場所選択オーバーレイ ── */}
                        {isSelectingAnyLocation && (
                            <>
                                <div style={{
                                    position: 'absolute', top: '50%', left: '50%',
                                    transform: 'translate(-50%, -100%)',
                                    zIndex: 1500, pointerEvents: 'none',
                                    display: 'flex', flexDirection: 'column',
                                    alignItems: 'center', justifyContent: 'center',
                                    filter: 'drop-shadow(0px 4px 4px rgba(0,0,0,0.3))'
                                }}>
                                    <div style={{ fontSize: '3rem', lineHeight: '1' }}>
                                        {isSelectingSafetyLocation
                                            ? '🟢'
                                            : isSelectingWalkLocation
                                                ? (WALK_ACTION_META[pendingWalkAction.actionType]?.emoji || '🐾')
                                                : '📍'}
                                    </div>
                                </div>
                                <div style={{
                                    position: 'absolute', bottom: '30px', left: '50%',
                                    transform: 'translateX(-50%)', zIndex: 1000,
                                    display: 'flex', flexDirection: 'column', gap: '12px',
                                    width: '90%', maxWidth: '300px',
                                    paddingBottom: 'env(safe-area-inset-bottom)'
                                }}>
                                    <button
                                        className="btn card"
                                        style={{
                                            backgroundColor: isSelectingSafetyLocation
                                                ? '#16A34A'
                                                : isSelectingWalkLocation
                                                    ? '#BE185D'
                                                    : 'var(--color-primary)',
                                            color: 'white',
                                            fontWeight: 'bold', fontSize: '1.1rem', padding: '16px',
                                            borderRadius: '9999px', margin: 0, textAlign: 'center',
                                            border: 'none', boxShadow: '0 4px 12px rgba(249, 115, 22, 0.4)'
                                        }}
                                        onClick={async () => {
                                            if (isSelectingSafetyLocation) {
                                                await handleSelectedSpotSafetyReport();
                                            } else if (isSelectingWalkLocation) {
                                                await handleSelectedWalkAction();
                                            } else if (mapRef.current) {
                                                const center = mapRef.current.getCenter();
                                                setTempPost({ lat: center.lat, lng: center.lng });
                                            }
                                        }}
                                        disabled={isSpotReporting || isWalkActionSaving}
                                    >
                                        {isSpotReporting || isWalkActionSaving
                                            ? '報告中...'
                                            : isSelectingSafetyLocation
                                                ? '🟢 この場所を安全と報告'
                                                : isSelectingWalkLocation
                                                    ? `${WALK_ACTION_META[pendingWalkAction.actionType]?.emoji || '🐾'} この場所で${pendingWalkAction.label}を記録`
                                                : '📍 ここで決定'}
                                    </button>
                                    {(isSelectingSafetyLocation || isSelectingWalkLocation) && (
                                        <div style={{
                                            backgroundColor: 'rgba(255,255,255,0.95)', color: '#4B5563',
                                            fontSize: '0.78rem', lineHeight: 1.5, textAlign: 'center',
                                            padding: '8px 12px', borderRadius: '12px',
                                            boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                                        }}>
                                            {isSelectingSafetyLocation
                                                ? '🔒 公開位置は約100m単位にぼかして保存します'
                                                : '🔒 この正確な場所は、あなたのお散歩ノートだけに保存します'}
                                        </div>
                                    )}
                                    <button
                                        className="btn card"
                                        style={{
                                            backgroundColor: 'white', color: 'var(--color-text-sub)',
                                            fontWeight: 'bold', fontSize: '1rem', padding: '12px',
                                            borderRadius: '9999px', margin: 0, textAlign: 'center',
                                            border: 'none', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                                        }}
                                        onClick={() => {
                                            setIsSelectingLocation(false);
                                            setIsSelectingSafetyLocation(false);
                                            setPendingWalkAction(null);
                                        }}
                                    >
                                        キャンセル
                                    </button>
                                </div>
                            </>
                        )}

                        {/* ── 投稿フォームモーダル ── */}
                        {tempPost && (
                            <div
                                className="spot-registration-modal"
                                style={{
                                    position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 10000,
                                    display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
                                    overflowY: 'auto', WebkitOverflowScrolling: 'touch',
                                    padding: '16px',
                                    paddingTop: 'max(16px, env(safe-area-inset-top))',
                                    paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
                                    boxSizing: 'border-box'
                                }}
                                onTouchMove={(e) => e.stopPropagation()}
                                onTouchStart={(e) => e.stopPropagation()}
                                onTouchEnd={(e) => e.stopPropagation()}
                                onPointerDown={(e) => e.stopPropagation()}
                                onWheel={(e) => e.stopPropagation()}
                            >
                                <div
                                    className="card"
                                    style={{ width: '100%', maxWidth: '400px', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', maxHeight: 'calc(100dvh - 32px)', overflow: 'hidden' }}
                                    onTouchMove={(e) => e.stopPropagation()}
                                    onTouchStart={(e) => e.stopPropagation()}
                                    onTouchEnd={(e) => e.stopPropagation()}
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onWheel={(e) => e.stopPropagation()}
                                >
                                    <h3 style={{ padding: '16px 16px 0', margin: 0 }}>新規スポット登録</h3>
                                    <form onSubmit={handlePostSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto' }}>
                                        <div style={{ padding: '16px' }}>
                                            <div style={{ marginBottom: '10px' }}>
                                                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>種類</label>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                                    {[
                                                        { value: 'danger', label: '⚠️ 危険・注意' },
                                                        { value: 'walk',   label: '🐾 お散歩情報' },
                                                        { value: 'shelter',label: '🎒 防災・避難所' },
                                                        { value: 'plant',  label: '🌿 植物' },
                                                        { value: 'others', label: '💡 街の発見・その他' },
                                                    ].map(({ value, label }) => (
                                                        <label
                                                            key={value}
                                                            style={{
                                                                display: 'flex', alignItems: 'center', gap: '7px',
                                                                minHeight: '46px', padding: '8px 10px', boxSizing: 'border-box',
                                                                borderRadius: '10px', cursor: 'pointer',
                                                                border: postForm.type === value
                                                                    ? '2px solid var(--color-primary)'
                                                                    : '1px solid #D1D5DB',
                                                                backgroundColor: postForm.type === value ? '#FFF7ED' : '#FFFFFF',
                                                                color: postForm.type === value ? '#C2410C' : '#374151',
                                                                fontSize: '0.83rem', fontWeight: postForm.type === value ? 'bold' : '600',
                                                                lineHeight: 1.25,
                                                            }}
                                                        >
                                                            <input
                                                                type="radio" name="type" value={value}
                                                                checked={postForm.type === value}
                                                                onChange={e => setPostForm({ ...postForm, type: e.target.value })}
                                                                style={{ width: '17px', height: '17px', flexShrink: 0, accentColor: 'var(--color-primary)' }}
                                                            />
                                                            <span>{label}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                            <div style={{ marginBottom: '10px' }}>
                                                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>公開範囲</label>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                                        <input
                                                            type="radio" name="visibility" value="public"
                                                            checked={postForm.visibility === 'public'}
                                                            onChange={() => setPostForm({ ...postForm, visibility: 'public' })}
                                                            style={{ width: '18px', height: '18px', accentColor: 'var(--color-primary)' }}
                                                        />
                                                        <span style={{ fontSize: '0.95rem', fontWeight: postForm.visibility === 'public' ? 'bold' : 'normal' }}>
                                                            🌍 みんなに公開 <span style={{ fontSize: '0.8rem', color: '#6B7280', fontWeight: 'normal' }}>（48時間で消えます）</span>
                                                        </span>
                                                    </label>
                                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                                        <input
                                                            type="radio" name="visibility" value="private"
                                                            checked={postForm.visibility === 'private'}
                                                            onChange={() => setPostForm({ ...postForm, visibility: 'private' })}
                                                            style={{ width: '18px', height: '18px', accentColor: 'var(--color-primary)' }}
                                                        />
                                                        <span style={{ fontSize: '0.95rem', fontWeight: postForm.visibility === 'private' ? 'bold' : 'normal' }}>
                                                            🔒 自分だけ <span style={{ fontSize: '0.8rem', color: '#6B7280', fontWeight: 'normal' }}>（マイマップに残ります）</span>
                                                        </span>
                                                    </label>
                                                </div>
                                            </div>
                                            <div style={{ marginBottom: '10px' }}>
                                                <label style={{ display: 'block', fontWeight: 'bold' }}>タイトル</label>
                                                <input
                                                    type="text" className="input-field" required
                                                    value={postForm.title}
                                                    onChange={e => setPostForm({ ...postForm, title: e.target.value })}
                                                    placeholder="例：歩道が狭い、水飲み場あり"
                                                />
                                            </div>
                                            <div style={{ marginBottom: '10px' }}>
                                                <label style={{ display: 'block', fontWeight: 'bold' }}>詳細メモ</label>
                                                <textarea
                                                    className="input-field" rows="2"
                                                    value={postForm.note}
                                                    onChange={e => setPostForm({ ...postForm, note: e.target.value })}
                                                ></textarea>
                                            </div>
                                            <div style={{ marginBottom: '10px' }}>
                                                <label style={{ display: 'block', fontWeight: 'bold' }}>写真</label>
                                                <input
                                                    type="file" accept="image/*,.heic,.heif"
                                                    onChange={async (e) => {
                                                        const file = e.target.files[0];
                                                        if (file) {
                                                            setIsProcessingImage(true);
                                                            try {
                                                                const { compressImage } = await import('../utils/imageUtils');
                                                                const compressedDataUrl = await compressImage(file);
                                                                setPostForm(prev => ({ ...prev, image: compressedDataUrl }));
                                                            } catch (error) {
                                                                console.error('画像圧縮失敗', error);
                                                                alert('画像の処理に失敗しました。');
                                                            } finally {
                                                                setIsProcessingImage(false);
                                                            }
                                                        } else {
                                                            setPostForm(prev => ({ ...prev, image: null }));
                                                        }
                                                    }}
                                                    className="input-field"
                                                    style={{ padding: '8px' }}
                                                    disabled={isProcessingImage}
                                                />
                                                {isProcessingImage && (
                                                    <div style={{ marginTop: '10px', color: 'var(--color-primary)', fontSize: '0.9rem', fontWeight: 'bold' }}>
                                                        処理中... しばらくお待ち下さい (HEIC画像などは数秒かかります)
                                                    </div>
                                                )}
                                                {postForm.image && !isProcessingImage && (
                                                    <div style={{ marginTop: '10px' }}>
                                                        <img src={postForm.image} alt="Preview" style={{ width: '100%', maxHeight: '150px', objectFit: 'contain', borderRadius: '4px' }} />
                                                    </div>
                                                )}
                                            </div>
                                            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center', width: '100%' }}>
                                                <img
                                                    src="/toukou_botom.png"
                                                    alt="みまもりWANの仲間たち"
                                                    style={{ width: '100%', height: 'auto', borderRadius: '12px', objectFit: 'cover', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}
                                                />
                                            </div>
                                        </div>
                                        <div style={{
                                            position: 'sticky', bottom: 0, background: '#fff',
                                            padding: '12px 16px calc(12px + env(safe-area-inset-bottom))',
                                            display: 'flex', gap: '10px',
                                            borderTop: '1px solid #eee', zIndex: 10,
                                            boxShadow: '0 -4px 12px rgba(0,0,0,0.06)'
                                        }}>
                                            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setTempPost(null)} disabled={isSubmitting}>
                                                {isSelectingLocation ? '場所を選び直す' : 'キャンセル'}
                                            </button>
                                            <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={isProcessingImage || isSubmitting}>
                                                {isSubmitting ? '保存中...' : '登録'}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        )}

                        {/* ── マップ本体 ── */}
                        <MapContainer
                            center={initialCenter}
                            zoom={16}
                            scrollWheelZoom={true}
                            style={{ height: '100%', width: '100%', zIndex: 1 }}
                            ref={mapRef}
                        >
                            <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            />

                            {activeMapLayer === 'public' && displayMode === 'activity' && (
                                <WalkHeatLayer cells={walkHeatmapCells} />
                            )}

                            {/* 🟢 安全オーラ（安全ルートモード） */}
                            {displayMode === 'safety' && safetyReports.map((report) => {
                                if (report.publicPath && report.publicPath.length >= 2) {
                                    return (
                                        <Polyline
                                            key={report.id}
                                            positions={report.publicPath.map((p) => [p.lat, p.lng])}
                                            pathOptions={{ color: '#10B981', weight: 45, opacity: 0.09, lineCap: 'round', lineJoin: 'round' }}
                                        />
                                    );
                                }
                                if (report.reportType === 'spot' && report.location) {
                                    const lat = typeof report.location.latitude === 'number' ? report.location.latitude : report.location._lat;
                                    const lng = typeof report.location.longitude === 'number' ? report.location.longitude : report.location._long;
                                    if (!lat || !lng) return null;
                                    return (
                                        <Circle
                                            key={report.id}
                                            center={[lat, lng]}
                                            radius={70}
                                            pathOptions={{ fillColor: '#10B981', fillOpacity: 0.09, stroke: false }}
                                        />
                                    );
                                }
                                return null;
                            })}

                            <LocationMarker position={currentPosition} />

                            {/* ⚠️ 危険ピン（アラートモード） */}
                            {displayMode === 'alert' && (
                                <>
                                    {/* 公式避難所 */}
                                    {shelters.filter(() => filter === 'shelter').map(shelter => (
                                        <Marker key={shelter.id} position={[shelter.lat, shelter.lng]} icon={shelterIcon}>
                                            <Popup>
                                                <strong>{shelter.name}</strong><br />
                                                {shelter.address}<br />
                                                <span style={{
                                                    display: 'inline-block', marginTop: '4px',
                                                    padding: '2px 6px', borderRadius: '4px',
                                                    backgroundColor: shelter.pet_friendly ? 'var(--color-success)' : 'var(--color-text-sub)',
                                                    color: 'white', fontSize: '0.75rem'
                                                }}>
                                                    {shelter.pet_friendly ? 'ペット可' : 'ペット不可'}
                                                </span>
                                                {shelter.notes && <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>{shelter.notes}</div>}
                                            </Popup>
                                        </Marker>
                                    ))}

                                    {/* ユーザー投稿ピン */}
                                    {displayPosts.map(post => {
                                        const hasThanked = Boolean(currentUserHash && post.thanks?.includes(currentUserHash));
                                        const isOwner = Boolean(
                                            currentUser && post.ownerUid === currentUser.uid
                                        );
                                        const timeLimit = (filter === 'plant' && post.type === 'plant') ? 14 * 24 * 60 * 60 * 1000 : 48 * 60 * 60 * 1000;
                                        const isOld = post.timestamp ? (Date.now() - post.timestamp > timeLimit) : false;

                                        return (
                                            <Marker
                                                key={post.id}
                                                position={[post.lat, post.lng]}
                                                icon={getMarkerIcon(post)}
                                                opacity={isOld ? 0.5 : 1}
                                                ref={(ref) => {
                                                    if (ref) markerRefs.current.set(post.id, ref);
                                                    else markerRefs.current.delete(post.id);
                                                }}
                                                eventHandlers={{
                                                    click: () => {
                                                        setActivePostId(post.id);
                                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                                    },
                                                    popupclose: () => {
                                                        setTimeout(() => {
                                                            setActivePostId((currentActive) => {
                                                                if (!currentActive || currentActive === post.id) {
                                                                    const el = document.getElementById(`post-item-${post.id}`);
                                                                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                                    return null;
                                                                }
                                                                return currentActive;
                                                            });
                                                        }, 100);
                                                    }
                                                }}
                                            >
                                                <Popup>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                        <strong style={{ fontSize: '1.1rem', color: post.resolved ? '#9CA3AF' : 'inherit' }}>
                                                            {post.resolved ? <strike>{post.title}</strike> : post.title}
                                                        </strong>
                                                        {post.resolved && <span style={{ fontSize: '0.75rem', backgroundColor: '#9CA3AF', color: 'white', padding: '2px 6px', borderRadius: '12px' }}>解決済</span>}
                                                    </div>
                                                    <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '2px' }}>
                                                        投稿者：{post.memberNumber ? `みまもり隊員 No.${String(post.memberNumber).padStart(3, '0')}` : 'ゲスト隊員'}
                                                    </div>
                                                    <div style={{ fontSize: '0.8rem', color: '#9CA3AF' }}>{post.date}</div>
                                                    {post.imageUrl && (
                                                        <div style={{ margin: '8px 0', maxHeight: '150px', overflowY: 'auto', borderRadius: '4px', border: '1px solid #E5E7EB' }}>
                                                            <img src={post.imageUrl} alt="添付写真" style={{ width: '100%', display: 'block', objectFit: 'contain', opacity: post.resolved ? 0.6 : 1 }} />
                                                        </div>
                                                    )}
                                                    <div style={{ margin: '8px 0', fontSize: '0.9rem' }}>{post.note}</div>
                                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginTop: '12px', borderTop: '1px solid #eee', paddingTop: '8px' }}>
                                                        <button
                                                            onClick={() => handleThanks(post.id, post.thanks)}
                                                            style={{
                                                                background: hasThanked ? '#FDF2F8' : '#F3F4F6',
                                                                border: hasThanked ? '1px solid #FBCFE8' : '1px solid #E5E7EB',
                                                                color: hasThanked ? '#DB2777' : '#4B5563',
                                                                padding: '4px 8px', borderRadius: '16px', cursor: 'pointer',
                                                                fontSize: '0.85rem', flex: 1, display: 'flex',
                                                                justifyContent: 'center', alignItems: 'center', gap: '4px'
                                                            }}
                                                        >
                                                            💖 {post.thanks?.length || 0}
                                                        </button>
                                                        {isOwner && !post.resolved && (
                                                            <button
                                                                onClick={() => handleResolve(post.id)}
                                                                style={{
                                                                    background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#059669',
                                                                    padding: '4px 8px', borderRadius: '16px', cursor: 'pointer',
                                                                    fontSize: '0.85rem', flex: 1
                                                                }}
                                                            >
                                                                👍 解決済に
                                                            </button>
                                                        )}
                                                        {!isOwner && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleSavePost(post.id, post.savedBy);
                                                                }}
                                                                style={{
                                                                    background: (currentUserHash && post.savedBy?.includes(currentUserHash)) ? '#FEF3C7' : '#F3F4F6',
                                                                    border: (currentUserHash && post.savedBy?.includes(currentUserHash)) ? '1px solid #FCD34D' : '1px solid #E5E7EB',
                                                                    color: (currentUserHash && post.savedBy?.includes(currentUserHash)) ? '#D97706' : '#4B5563',
                                                                    padding: '4px 8px', borderRadius: '16px', cursor: 'pointer',
                                                                    fontSize: '0.85rem', flex: 1, display: 'flex',
                                                                    justifyContent: 'center', alignItems: 'center', gap: '4px'
                                                                }}
                                                            >
                                                                {(currentUserHash && post.savedBy?.includes(currentUserHash)) ? '🌟 保存済' : '⭐️ 保存'}
                                                            </button>
                                                        )}
                                                    </div>
                                                    {isOwner && <div style={{ textAlign: 'right', marginTop: '8px' }}>
                                                        <button
                                                            onClick={() => deletePost(post.id, post.imagePath)}
                                                            style={{ background: 'none', border: 'none', color: '#EF4444', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.75rem' }}
                                                        >
                                                            投稿を削除
                                                        </button>
                                                    </div>}
                                                </Popup>
                                            </Marker>
                                        );
                                    })}
                                </>
                            )}

                            {/* 本人だけに見える正確なお散歩アクション */}
                            {displayWalkActions.map((action) => {
                                const actionMeta = WALK_ACTION_META[action.actionType] || {
                                    label: 'お散歩記録',
                                    emoji: '🐾',
                                };
                                return (
                                    <Marker
                                        key={`walk-action-${action.id}`}
                                        position={[action.lat, action.lng]}
                                        icon={getMarkerIcon({ type: `walk_${action.actionType}` })}
                                        ref={(ref) => {
                                            if (ref) walkMarkerRefs.current.set(action.id, ref);
                                            else walkMarkerRefs.current.delete(action.id);
                                        }}
                                    >
                                        <Popup>
                                            <div style={{ minWidth: '150px' }}>
                                                <strong style={{ fontSize: '1rem' }}>
                                                    {actionMeta.emoji} {actionMeta.label}
                                                </strong>
                                                <div style={{ marginTop: '5px', color: '#6B7280', fontSize: '0.78rem' }}>
                                                    {getRelativeTime(action.timestamp)}
                                                </div>
                                                <div style={{ marginTop: '8px', color: '#047857', fontSize: '0.72rem' }}>
                                                    🔒 この正確な場所は自分だけに表示されています
                                                </div>
                                                <button
                                                    onClick={() => deleteWalkAction(action.id)}
                                                    style={{
                                                        marginTop: '10px', padding: 0, background: 'none',
                                                        border: 'none', color: '#EF4444', cursor: 'pointer',
                                                        fontSize: '0.72rem', textDecoration: 'underline',
                                                    }}
                                                >
                                                    この記録を削除
                                                </button>
                                            </div>
                                        </Popup>
                                    </Marker>
                                );
                            })}
                        </MapContainer>
                    </>
                )}
            </div>

            {/* 成功トースト */}
            {showSuccessToast && (
                <div style={{
                    position: 'fixed',
                    top: 'max(20px, env(safe-area-inset-top))',
                    left: '50%', transform: 'translateX(-50%)',
                    backgroundColor: '#10B981', color: 'white',
                    padding: '12px 24px', borderRadius: '24px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 4000,
                    fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px',
                    animation: 'slideDownFadeOut 3s forwards'
                }}>
                    ✅ 報告完了しました！
                </div>
            )}
            <style>{`
                @keyframes slideDownFadeOut {
                    0%   { transform: translate(-50%, -20px); opacity: 0; }
                    10%  { transform: translate(-50%, 0); opacity: 1; }
                    80%  { transform: translate(-50%, 0); opacity: 1; }
                    100% { transform: translate(-50%, -20px); opacity: 0; }
                }
            `}</style>

            {/* ── 投稿一覧ボトムシート ── */}
            <BottomSheet
                open={!isSelectingAnyLocation && !showQuickPostSheet}
                blocking={false}
                snapPoints={({ maxHeight }) => [maxHeight * 0.3, maxHeight * 0.65]}
                defaultSnap={({ snapPoints }) => snapPoints[0]}
                header={
                    <div style={{ padding: '8px 16px 0 16px', maxWidth: '100vw', boxSizing: 'border-box' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 style={{ margin: 0, fontSize: '1.2rem' }}>
                                {activeMapLayer === 'myMap' ? '私だけのお散歩ノート' : '地域の最新情報'}
                            </h3>
                            <button
                                onClick={handleRefresh}
                                style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px', color: 'var(--color-text-sub)' }}
                                title="最新の情報に更新"
                            >
                                🔄
                            </button>
                        </div>
                        {activeMapLayer === 'myMap' && (
                            <div style={{
                                margin: '-8px 0 12px', padding: '8px 10px', borderRadius: '10px',
                                backgroundColor: '#ECFDF5', color: '#047857',
                                fontSize: '0.75rem', lineHeight: 1.5,
                            }}>
                                🔒 お散歩アクションの正確な場所は、あなたにだけ表示されます。
                            </div>
                        )}
                        <div
                            className="map-top-filters"
                            data-rsbs-no-pan="true"
                            onPointerDown={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                            onTouchMove={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                            style={{ position: 'relative', zIndex: 100, pointerEvents: 'auto' }}
                        >
                            <button className={`filter-chip ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>すべて</button>
                            <button className={`filter-chip ${filter === 'danger' ? 'active' : ''}`} onClick={() => setFilter('danger')}>危険・スポット</button>
                            <button className={`filter-chip ${filter === 'walk' ? 'active' : ''}`} onClick={() => setFilter('walk')}>お散歩情報</button>
                            <button className={`filter-chip ${filter === 'plant' ? 'active' : ''}`} onClick={() => setFilter('plant')}>植物</button>
                            <button className={`filter-chip ${filter === 'others' ? 'active' : ''}`} onClick={() => setFilter('others')}>街の発見等</button>
                            <button className={`filter-chip ${filter === 'shelter' ? 'active' : ''}`} onClick={() => setFilter('shelter')}>防災情報</button>
                        </div>
                    </div>
                }
                style={{ zIndex: 10, display: isSelectingAnyLocation ? 'none' : 'block' }}
            >
                <div style={{ padding: '0 var(--spacing-md)', paddingBottom: '120px' }}>
                    <PullToRefresh onRefresh={handleRefresh} pullingContent="" refreshingContent={<div style={{ textAlign: 'center', padding: '10px', color: 'var(--color-text-sub)' }}>更新中...</div>}>
                        {(displayPosts.length > 0 || displayWalkActions.length > 0) ? (
                            <div style={{ display: 'grid', gap: 'var(--spacing-sm)' }}>
                                {[...displayWalkActions]
                                    .sort((a, b) => {
                                        const bTime = b.timestamp?.toMillis?.() ?? b.timestamp ?? 0;
                                        const aTime = a.timestamp?.toMillis?.() ?? a.timestamp ?? 0;
                                        return bTime - aTime;
                                    })
                                    .map((action) => {
                                        const actionMeta = WALK_ACTION_META[action.actionType] || {
                                            label: 'お散歩記録',
                                            emoji: '🐾',
                                        };
                                        return (
                                            <div
                                                key={`walk-list-${action.id}`}
                                                className="card"
                                                onClick={() => handleWalkActionClick(action)}
                                                style={{
                                                    padding: 'var(--spacing-sm) var(--spacing-md)', margin: 0,
                                                    cursor: 'pointer', backgroundColor: '#F0FDF4',
                                                    borderLeft: '4px solid #10B981',
                                                }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                                                    <div>
                                                        <div style={{ fontWeight: 'bold', color: '#065F46' }}>
                                                            {actionMeta.emoji} {actionMeta.label}
                                                        </div>
                                                        <div style={{ marginTop: '5px', fontSize: '0.72rem', color: '#047857' }}>
                                                            🔒 正確な場所は自分だけに表示
                                                        </div>
                                                    </div>
                                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                        <div style={{ fontSize: '0.75rem', color: '#6B7280', fontWeight: 'bold' }}>
                                                            {getRelativeTime(action.timestamp)}
                                                        </div>
                                                        <button
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                deleteWalkAction(action.id);
                                                            }}
                                                            style={{
                                                                marginTop: '7px', padding: 0, background: 'none', border: 'none',
                                                                color: '#EF4444', cursor: 'pointer', fontSize: '0.68rem',
                                                                textDecoration: 'underline',
                                                            }}
                                                        >
                                                            削除
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                {[...displayPosts].sort((a, b) => b.timestamp - a.timestamp).map(post => {
                                    const hasThanked = Boolean(currentUserHash && post.thanks?.includes(currentUserHash));
                                    const isOwner = Boolean(
                                        currentUser && post.ownerUid === currentUser.uid
                                    );
                                    const timeLimit = (filter === 'plant' && post.type === 'plant') ? 14 * 24 * 60 * 60 * 1000 : 48 * 60 * 60 * 1000;
                                    const isOld = post.timestamp ? (Date.now() - post.timestamp > timeLimit) : false;
                                    return (
                                        <div
                                            key={post.id}
                                            id={`post-item-${post.id}`}
                                            className="card"
                                            onClick={() => handleListPostClick(post)}
                                            style={{
                                                padding: 'var(--spacing-sm) var(--spacing-md)', margin: 0,
                                                cursor: 'pointer',
                                                backgroundColor: activePostId === post.id ? '#EFF6FF' : 'var(--color-surface)',
                                                borderLeft: post.type === 'danger' ? '4px solid #F59E0B' : (post.type === 'shelter' ? '4px solid #8B5CF6' : (post.type === 'plant' ? '4px solid #22C55E' : (post.type === 'others' ? '4px solid #3B82F6' : '4px solid #10B981'))),
                                                transition: 'background-color 0.2s',
                                                opacity: isOld ? 0.5 : 1
                                            }}
                                        >
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                    <div style={{ fontWeight: 'bold', color: post.resolved ? '#9CA3AF' : 'inherit', textDecoration: post.resolved ? 'line-through' : 'none', flex: 1, paddingRight: '12px' }}>
                                                        {post.type === 'danger' ? '⚠️' : (post.type === 'shelter' ? '🎒' : (post.type === 'plant' ? '🌿' : (post.type === 'others' ? '💡' : '🐾')))} {post.title}
                                                    </div>
                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-sub)', whiteSpace: 'nowrap', fontWeight: 'bold' }}>
                                                            {getRelativeTime(post.timestamp)}
                                                        </div>
                                                        {isOld && (
                                                            <div style={{ fontSize: '0.65rem', color: '#6B7280', backgroundColor: '#F3F4F6', padding: '2px 6px', borderRadius: '4px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                                                🕒 過去の情報
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div style={{ fontSize: '0.85rem', color: 'var(--color-text-sub)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                                    {post.note || '詳細なし'}
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
                                                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-sub)' }}>
                                                        {post.imageUrl && <span style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>📷 写真あり</span>}
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                        {!isOwner && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleSavePost(post.id, post.savedBy); }}
                                                                style={{
                                                                    background: (currentUserHash && post.savedBy?.includes(currentUserHash)) ? '#FEF3C7' : 'transparent',
                                                                    border: (currentUserHash && post.savedBy?.includes(currentUserHash)) ? '1px solid #FCD34D' : '1px solid #E5E7EB',
                                                                    color: (currentUserHash && post.savedBy?.includes(currentUserHash)) ? '#D97706' : '#4B5563',
                                                                    padding: '4px 12px', borderRadius: '16px', cursor: 'pointer',
                                                                    fontSize: '0.85rem', display: 'flex',
                                                                    justifyContent: 'center', alignItems: 'center', gap: '4px'
                                                                }}
                                                            >
                                                                {(currentUserHash && post.savedBy?.includes(currentUserHash)) ? '🌟 保存済' : '⭐️ 保存'}
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleThanks(post.id, post.thanks); }}
                                                            style={{
                                                                background: hasThanked ? '#FDF2F8' : 'transparent',
                                                                border: hasThanked ? '1px solid #FBCFE8' : '1px solid #E5E7EB',
                                                                color: hasThanked ? '#DB2777' : '#4B5563',
                                                                padding: '4px 12px', borderRadius: '16px', cursor: 'pointer',
                                                                fontSize: '0.85rem', display: 'flex',
                                                                justifyContent: 'center', alignItems: 'center', gap: '4px'
                                                            }}
                                                        >
                                                            💖 {post.thanks?.length || 0}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p style={{ color: 'var(--color-text-sub)', textAlign: 'center', padding: 'var(--spacing-lg) 0' }}>
                                {activeMapLayer === 'myMap'
                                    ? '自分のお散歩記録や投稿はまだありません。'
                                    : '周辺の投稿はまだありません。'}
                            </p>
                        )}
                    </PullToRefresh>
                </div>
            </BottomSheet>

            {/* ── クイック投稿シート ── */}
            <BottomSheet
                open={showQuickPostSheet}
                onDismiss={closeQuickPost}
                blocking={true}
                snapPoints={({ maxHeight }) => [maxHeight * 0.55, maxHeight * 0.9]}
                defaultSnap={({ snapPoints }) => snapPoints[0]}
                style={{ '--rsbs-backdrop-bg': 'rgba(0, 0, 0, 0.5)', zIndex: 3000 }}
            >
                <div style={{ padding: '16px 20px calc(100px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative' }}>
                    <button
                        onClick={closeQuickPost}
                        disabled={isQuickPostBusy}
                        style={{
                            position: 'absolute', top: '12px', right: '20px',
                            background: '#F3F4F6', border: 'none', color: '#6B7280',
                            width: '32px', height: '32px', borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '1rem', cursor: isQuickPostBusy ? 'default' : 'pointer', zIndex: 10,
                            opacity: isQuickPostBusy ? 0.45 : 1,
                        }}
                        aria-label="閉じる"
                    >
                        ✖️
                    </button>

                    {quickPostStep === 1 ? (
                        <>
                            <h3 style={{ textAlign: 'center', margin: '0 0 16px', fontSize: '1.2rem' }}>何がありましたか？</h3>
                            {[
                                { title: 'ゴミが落ちてるよ', emoji: '🗑️' },
                                { title: 'うんち落ちてる！', emoji: '💩' },
                                { title: '危険なところがあるよ', emoji: '⚠️', bg: '#FEF2F2', color: '#DC2626' },
                            ].map(({ title, emoji, bg, color }) => (
                                <button
                                    key={title}
                                    onClick={() => { setQuickPostData({ title, type: 'danger' }); setQuickPostStep(2); }}
                                    style={{
                                        width: '100%', padding: '20px', borderRadius: '16px', border: '1px solid #E5E7EB',
                                        backgroundColor: bg || '#F9FAFB', color: color || 'inherit',
                                        fontSize: '1.3rem', fontWeight: 'bold',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)', cursor: 'pointer'
                                    }}
                                >
                                    {emoji} {title}
                                </button>
                            ))}
                        </>
                    ) : (
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                                <button
                                    onClick={() => { setQuickPostStep(1); setPostForm(prev => ({ ...prev, image: null })); }}
                                    disabled={isQuickPostBusy}
                                    style={{
                                        background: 'none', border: 'none', color: '#6B7280', fontSize: '1.2rem',
                                        cursor: isQuickPostBusy ? 'default' : 'pointer', padding: '4px',
                                        opacity: isQuickPostBusy ? 0.45 : 1,
                                    }}
                                >
                                    ◀️ 戻る
                                </button>
                                <h3 style={{ margin: 0, fontSize: '1.2rem', flex: 1, textAlign: 'center' }}>{quickPostData.title}</h3>
                                <div style={{ width: '40px' }}></div>
                            </div>

                            <button
                                onClick={() => handleQuickPostSubmit(false)}
                                disabled={isQuickPostBusy}
                                aria-busy={isSubmitting}
                                style={{
                                    width: '100%', padding: '24px', borderRadius: '16px', border: 'none',
                                    backgroundColor: 'var(--color-primary)', color: 'white',
                                    fontSize: '1.4rem', fontWeight: 'bold',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
                                    boxShadow: '0 4px 12px rgba(249, 115, 22, 0.3)', cursor: 'pointer',
                                    opacity: isQuickPostBusy ? 0.7 : 1
                                }}
                            >
                                {isSubmitting ? quickPostStatus || '送信中...' : '🚀 このまま投稿する'}
                            </button>

                            <button
                                onClick={() => startMapLocationSelection({ quickPost: quickPostData })}
                                disabled={isQuickPostBusy}
                                style={{
                                    width: '100%', padding: '16px', borderRadius: '16px',
                                    border: '1px solid #FDBA74', backgroundColor: '#FFF7ED', color: '#C2410C',
                                    fontSize: '1.05rem', fontWeight: 'bold', cursor: 'pointer',
                                    opacity: isQuickPostBusy ? 0.7 : 1
                                }}
                            >
                                🗺️ 地図から投稿場所を選ぶ
                            </button>

                            <div style={{ position: 'relative', margin: '16px 0', borderTop: '2px dashed #E5E7EB' }}></div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <label style={{
                                    width: '100%', padding: '20px', borderRadius: '16px', border: '1px solid #D1D5DB',
                                    backgroundColor: 'white', color: '#4B5563', fontSize: '1.2rem', fontWeight: 'bold',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
                                    cursor: isQuickPostBusy ? 'default' : 'pointer', margin: 0,
                                    opacity: isQuickPostBusy ? 0.6 : 1,
                                }}>
                                    {isProcessingImage ? '📷 写真を準備中...' : '📷 写真を追加して投稿'}
                                    <input
                                        type="file" accept="image/*,.heic,.heif"
                                        style={{ display: 'none' }}
                                        onChange={async (e) => {
                                            const input = e.currentTarget;
                                            const file = input.files[0];
                                            if (file) {
                                                quickPostImageLockRef.current = true;
                                                setIsProcessingImage(true);
                                                setQuickPostStatus('写真を準備中...');
                                                try {
                                                    const { compressImage } = await import('../utils/imageUtils');
                                                    const compressedDataUrl = await compressImage(file);
                                                    setIsProcessingImage(false);
                                                    await handleQuickPostSubmit(true, compressedDataUrl);
                                                } catch (error) {
                                                    console.error('画像圧縮失敗', error);
                                                    const { default: toast } = await import('react-hot-toast');
                                                    toast.error('写真を準備できませんでした。同じ写真をもう一度選べます。');
                                                } finally {
                                                    quickPostImageLockRef.current = false;
                                                    setIsProcessingImage(false);
                                                    setQuickPostStatus('');
                                                    input.value = '';
                                                }
                                            }
                                        }}
                                        disabled={isQuickPostBusy}
                                    />
                                </label>
                                {isQuickPostBusy && quickPostStatus && (
                                    <div
                                        role="status"
                                        aria-live="polite"
                                        style={{ textAlign: 'center', color: 'var(--color-primary)', fontSize: '0.9rem', fontWeight: 'bold' }}
                                    >
                                        {quickPostStatus} そのままお待ちください
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    <div style={{ marginTop: 'auto', paddingTop: '8px', display: 'flex', justifyContent: 'center', width: '100%' }}>
                        <img
                            src="/toukou_botom.png" alt="みまもりWANの仲間たち"
                            style={{ width: '100%', height: 'auto', borderRadius: '12px', objectFit: 'cover', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}
                        />
                    </div>
                </div>
            </BottomSheet>

            {/* 🟢 お散歩異常なし報告モーダル */}
            {showSafetyReport && (
                <SafetyReportModal
                    currentUser={currentUser}
                    onClose={() => setShowSafetyReport(false)}
                />
            )}

            {/* 🐾 お散歩記録コントローラー（切り出したコンポーネント） */}
            <WalkControllerSheet
                isOpen={isWalkRecording}
                onClose={() => setIsWalkRecording(false)}
                onRequestMapSelection={startWalkLocationSelection}
                memberNumber={memberNumber}
            />
        </div>
    );
};

export default MapPage;
