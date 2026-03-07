import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import shelters from '../data/shelters.json';
import { db, storage } from '../firebase';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, updateDoc, arrayUnion, arrayRemove, getDocs, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import PullToRefresh from 'react-simple-pull-to-refresh';
import { BottomSheet } from 'react-spring-bottom-sheet';
import 'react-spring-bottom-sheet/dist/style.css';

// Fix for default marker icon
let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// User Location Icon (Red)
const userIcon = L.divIcon({
    className: 'user-location-icon',
    html: '<div style="background-color: #EF4444; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5);"></div>',
    iconSize: [24, 24],
    iconAnchor: [12, 12]
});

// Danger Spot Icon (Yellow/Warning)
const dangerIcon = L.divIcon({
    className: 'danger-icon',
    html: '<div style="background-color: #F59E0B; width: 32px; height: 32px; border-radius: 50%; border: 2px solid white; display:flex; align-items:center; justify-content:center; font-size:18px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">⚠️</div>',
    iconSize: [36, 36],
    iconAnchor: [18, 18]
});

// Walk Spot Icon (Green/Paw)
const walkIcon = L.divIcon({
    className: 'walk-icon',
    html: '<div style="background-color: #10B981; width: 32px; height: 32px; border-radius: 50%; border: 2px solid white; display:flex; align-items:center; justify-content:center; font-size:18px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">🐾</div>',
    iconSize: [36, 36],
    iconAnchor: [18, 18]
});

// Shelter/Disaster Spot Icon (Purple/Bag)
const shelterIcon = L.divIcon({
    className: 'shelter-icon',
    html: '<div style="background-color: #8B5CF6; width: 32px; height: 32px; border-radius: 50%; border: 2px solid white; display:flex; align-items:center; justify-content:center; font-size:18px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">🎒</div>',
    iconSize: [36, 36],
    iconAnchor: [18, 18]
});

// Resolved Spot Icon (Gray)
const resolvedIcon = L.divIcon({
    className: 'resolved-icon',
    html: '<div style="background-color: #9CA3AF; width: 32px; height: 32px; border-radius: 50%; border: 2px solid white; display:flex; align-items:center; justify-content:center; font-size:18px; box-shadow: 0 2px 4px rgba(0,0,0,0.3); opacity: 0.8;">✅</div>',
    iconSize: [36, 36],
    iconAnchor: [18, 18]
});

const LocationMarker = ({ isPostMode, onMapClick }) => {
    const [position, setPosition] = useState(null);
    const map = useMap();

    useEffect(() => {
        map.locate().on("locationfound", function (e) {
            setPosition(e.latlng);
            map.flyTo(e.latlng, map.getZoom());
        });
    }, [map]);

    return (
        <>
            {position !== null && (
                <Marker
                    position={position}
                    icon={userIcon}
                    eventHandlers={{
                        click: () => {
                            if (isPostMode) {
                                onMapClick(position);
                            }
                        }
                    }}
                >
                    {!isPostMode && (
                        <Popup>
                            <strong>現在地</strong>
                        </Popup>
                    )}
                </Marker>
            )}
            <div style={{ position: 'absolute', bottom: '100px', right: '10px', zIndex: 1000 }}>
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        // Reload the page to reset the map and fetch latest data
                        window.location.reload();
                    }}
                    style={{
                        backgroundColor: 'white',
                        border: 'none',
                        borderRadius: '50%',
                        width: '44px',
                        height: '44px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                        fontSize: '20px'
                    }}
                    title="現在地に戻る"
                >
                    📍
                </button>
            </div>

            {/* The floating button has been removed from here */}
        </>
    );
};

const MapPage = () => {
    // User Posts State (now driven by Firestore)
    const [userPosts, setUserPosts] = useState([]);
    const [filter, setFilter] = useState('all');

    const [isSelectingLocation, setIsSelectingLocation] = useState(false);
    const [isWalking, setIsWalking] = useState(false);
    const [showPostOptions, setShowPostOptions] = useState(false);
    const [tempPost, setTempPost] = useState(null); // { lat, lng }
    const [postForm, setPostForm] = useState({ type: 'danger', title: '', note: '', image: null });
    const [isProcessingImage, setIsProcessingImage] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false); // For Firebase Submit Loading state
    const { currentUser, memberNumber } = useAuth();
    const navigate = useNavigate();

    const mapRef = useRef(null);
    const markerRefs = useRef(new Map());
    const [activePostId, setActivePostId] = useState(null);
    const [isMinTimeElapsed, setIsMinTimeElapsed] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsMinTimeElapsed(true);
        }, 1500); // 最低1.5秒間はスプラッシュ画面を表示する
        return () => clearTimeout(timer);
    }, []);

    // Initial Map Location State
    const [initialCenter, setInitialCenter] = useState(null);
    const [isLoadingLocation, setIsLoadingLocation] = useState(true);

    useEffect(() => {
        const DEFAULT_LOCATION = [36.0834, 140.0766]; // Tsukuba City Hall

        if (!navigator.geolocation) {
            setInitialCenter(DEFAULT_LOCATION);
            setIsLoadingLocation(false);
            return;
        }

        // Set a timeout in case geolocation takes too long or prompts hang
        const timeoutId = setTimeout(() => {
            if (isLoadingLocation) {
                console.warn('Geolocation timeout, using default location.');
                setInitialCenter(DEFAULT_LOCATION);
                setIsLoadingLocation(false);
            }
        }, 5000);

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                clearTimeout(timeoutId);
                setInitialCenter([pos.coords.latitude, pos.coords.longitude]);
                setIsLoadingLocation(false);
            },
            (err) => {
                clearTimeout(timeoutId);
                console.warn(`Geolocation error (${err.code}): ${err.message}`);
                setInitialCenter(DEFAULT_LOCATION);
                setIsLoadingLocation(false);
            },
            {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 0
            }
        );

        return () => clearTimeout(timeoutId);
    }, []);

    // Anonymous auth handles identity now, no need to block UI actions
    const requireAuth = (actionName) => {
        return true;
    };

    const fetchLatestPins = async () => {
        try {
            const q = query(collection(db, 'map_pins'));
            const querySnapshot = await getDocs(q);
            const pins = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                pins.push({ id: doc.id, ...data });
            });
            setUserPosts(pins);
        } catch (error) {
            console.error("Error manual fetching pins: ", error);
        }
    };

    const handleRefresh = async () => {
        await fetchLatestPins();
    };

    // Fetch pins from Firestore (Real-time listener for background updates)
    useEffect(() => {
        const q = query(collection(db, 'map_pins'));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const pins = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                pins.push({ id: doc.id, ...data });
            });
            setUserPosts(pins);
        }, (error) => {
            console.error("Error fetching pins: ", error);
        });

        return () => unsubscribe();
    }, []);

    const handleMapClick = (latlng) => {
        setTempPost(latlng);
    };

    const handleToggleWalk = async () => {
        if (!currentUser) return;

        if (isWalking) {
            if (window.confirm('みまもり活動を終了しますか？')) {
                try {
                    await setDoc(doc(db, 'users', currentUser.uid), {
                        isWalking: false,
                        walkStartTime: null
                    }, { merge: true });
                    setIsWalking(false);
                    alert("お散歩を終了しました。お疲れ様でした！");
                } catch (error) {
                    console.error("Error ending walk:", error);
                    alert("お散歩状態の解除に失敗しました。");
                }
            }
        } else {
            if (window.confirm('みまもり活動（お散歩）を開始しますか？')) {
                try {
                    await setDoc(doc(db, 'users', currentUser.uid), {
                        isWalking: true,
                        walkStartTime: serverTimestamp()
                    }, { merge: true });
                    setIsWalking(true);
                    alert("お散歩に出発しました！🐾\n（ご近所のマップに30分間表示されます）");
                } catch (error) {
                    console.error("Error starting walk:", error);
                    alert("お散歩の開始に失敗しました。");
                }
            }
        }
    };

    const handlePostSubmit = async (e) => {
        e.preventDefault();
        if (!tempPost) return;

        setIsSubmitting(true);

        try {
            let imageUrl = null;
            let imagePath = null;

            // 1. Upload compressed Base64 image to Firebase Storage if an image was attached
            if (postForm.image) {
                // Extract mime type and matching extension from the Base64 dataURL
                const mimeTypeMatch = postForm.image.match(/data:(.*?);/);
                const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/jpeg';
                const ext = mimeType === 'image/webp' ? 'webp' : 'jpg';

                // Generate a unique filename using timestamp
                const filename = `map_pins/${Date.now()}.${ext}`;
                const storageRef = ref(storage, filename);

                // Upload the Base64 Data URL
                await uploadString(storageRef, postForm.image, 'data_url');

                // Retrieve the actual download URL provided by Firebase Storage
                imageUrl = await getDownloadURL(storageRef);
                imagePath = filename; // Save path so we can delete it later
            }

            // 2. Save location and details to Firestore
            const newPostData = {
                lat: tempPost.lat,
                lng: tempPost.lng,
                type: postForm.type,
                title: postForm.title,
                note: postForm.note,
                date: new Date().toLocaleDateString(),
                timestamp: Date.now(),
                imageUrl: imageUrl, // Will be null if no photo attached
                imagePath: imagePath,
                resolved: false,
                thanks: [], // Array of device IDs
                memberNumber: currentUser && !currentUser.isAnonymous && memberNumber ? memberNumber : null
            };

            await addDoc(collection(db, "map_pins"), newPostData);

            // 3. Reset UI state on success
            setTempPost(null);
            setIsSelectingLocation(false);
            setPostForm({ type: 'danger', title: '', note: '', image: null });
            setIsProcessingImage(false);

        } catch (error) {
            console.error("Error adding document: ", error);
            alert("投稿の保存に失敗しました。もう一度お試しください。");
        } finally {
            setIsSubmitting(false);
        }
    };

    const deletePost = async (id, imagePath) => {
        if (!requireAuth('投稿の削除')) return;
        if (window.confirm('この投稿を削除しますか？')) {
            try {
                // Delete from Firestore
                await deleteDoc(doc(db, "map_pins", id));

                // Delete image from Cloud Storage if it exists
                if (imagePath) {
                    const storageRef = ref(storage, imagePath);
                    await deleteObject(storageRef).catch((error) => {
                        console.error("Failed to delete image from storage:", error);
                        // We still consider the post deleted even if the image delete fails (e.g. orphan file)
                    });
                }
            } catch (error) {
                console.error("Error deleting document: ", error);
                alert("投稿の削除に失敗しました。");
            }
        }
    };

    const handleThanks = async (postId, currentThanks) => {
        if (!currentUser) return; // Anonymous users are also allowed

        const postRef = doc(db, 'map_pins', postId);
        const hasThanked = currentThanks?.includes(currentUser.uid);
        try {
            if (hasThanked) {
                await updateDoc(postRef, { thanks: arrayRemove(currentUser.uid) });
            } else {
                await updateDoc(postRef, { thanks: arrayUnion(currentUser.uid) });
            }
        } catch (error) {
            console.error("Error updating thanks: ", error);
        }
    };

    const handleResolve = async (postId) => {
        if (!requireAuth('「👍 解決済」の報告')) return;
        if (window.confirm('このスポットの状況は「解決済み（安全）」になりましたか？\n※マップ上の表示がグレーに変わります。')) {
            const postRef = doc(db, 'map_pins', postId);
            try {
                await updateDoc(postRef, { resolved: true });
            } catch (error) {
                console.error("Error resolving post: ", error);
            }
        }
    };

    const handleListPostClick = (post) => {
        const map = mapRef.current;
        if (map) {
            // Scroll to the top of the page so the map is fully visible
            window.scrollTo({ top: 0, behavior: 'smooth' });

            // Calculate an offset so the popup doesn't get cut off at the top
            const zoom = 16;
            const targetPoint = map.project([post.lat, post.lng], zoom);
            // Offset by ~120 pixels upwards to give space for the popup
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

    const filteredPosts = userPosts.filter(post => {
        // Exclude shelter posts completely unless explicitly filtering for it
        if (post.type === 'shelter' && filter !== 'shelter') return false;

        if (filter === 'all') return !post.resolved; // show everything else that is unresolved
        if (filter === 'resolved') return post.resolved; // show only resolved posts
        if (post.resolved) return false; // Hide resolved from other specific filters
        if (filter === 'walk') return post.type === 'walk' || post.type === 'useful';
        return post.type === filter;
    });

    return (
        <div className="map-page" style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>

            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                {(isLoadingLocation || !isMinTimeElapsed) ? (
                    <div style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        height: '100%', backgroundColor: '#FFF7ED',
                        color: 'var(--color-primary)', padding: '20px', textAlign: 'center'
                    }}>
                        {/* メインビジュアル画像を表示 */}
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
                            }
                            @keyframes ripple {
                                0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
                                70% { box-shadow: 0 0 0 15px rgba(16, 185, 129, 0); }
                                100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
                            }
                        `}</style>
                    </div>
                ) : (
                    <>
                        {/* Start/End Walk Toggle Button (FAB) */}
                        {!isSelectingLocation && (
                            <div style={{ position: 'absolute', bottom: 'calc(25vh + 106px)', right: '16px', zIndex: 1000 }}>
                                <button
                                    onClick={handleToggleWalk}
                                    className="btn card"
                                    style={{
                                        backgroundColor: isWalking ? '#047857' : '#F59E0B', // Dark Green active, Orange inactive
                                        color: 'white',
                                        width: '60px',
                                        height: '60px',
                                        borderRadius: '50%',
                                        border: 'none',
                                        boxShadow: isWalking ? 'none' : '0 4px 10px rgba(0,0,0,0.3)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '1.8rem',
                                        transition: 'background-color 0.3s, transform 0.2s',
                                        padding: 0,
                                        margin: 0,
                                        animation: isWalking ? 'ripple 2s infinite' : 'none'
                                    }}
                                >
                                    🐶
                                </button>
                            </div>
                        )}

                        {/* Post Mode Toggle Button (FAB) */}
                        {!isSelectingLocation && (
                            <div style={{ position: 'absolute', bottom: 'calc(25vh + 30px)', right: '16px', zIndex: 1000 }}>
                                <button
                                    onClick={() => {
                                        if (!requireAuth('スポットの投稿')) return;
                                        setShowPostOptions(true); // action sheet
                                    }}
                                    className="btn"
                                    style={{
                                        backgroundColor: 'var(--color-primary)',
                                        color: 'white',
                                        width: '60px',
                                        height: '60px',
                                        borderRadius: '50%',
                                        boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '1.8rem',
                                        transition: 'transform 0.2s',
                                        padding: 0
                                    }}
                                >
                                    🐾
                                </button>
                            </div>
                        )}

                        {/* Post Options Action Sheet / Modal */}
                        {showPostOptions && (
                            <div
                                style={{
                                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                                    backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 2000,
                                    display: 'flex', alignItems: 'flex-end', justifyContent: 'center'
                                }}
                                onClick={() => setShowPostOptions(false)}
                            >
                                <div
                                    className="card"
                                    style={{
                                        width: '100%', maxWidth: '500px', margin: 0,
                                        borderBottomLeftRadius: 0, borderBottomRightRadius: 0,
                                        padding: '24px 20px', paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
                                        animation: 'slideUp 0.3s ease-out'
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <h3 style={{ textAlign: 'center', marginBottom: '20px', fontSize: '1.1rem' }}>投稿方法の選択</h3>

                                    <button
                                        onClick={() => {
                                            setShowPostOptions(false);
                                            // Get precise current position if possible instead of relying solely on initialCenter
                                            if (navigator.geolocation) {
                                                navigator.geolocation.getCurrentPosition(
                                                    (pos) => {
                                                        setTempPost({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                                                    },
                                                    (err) => {
                                                        console.warn("Geolocation fallback:", err);
                                                        if (initialCenter) {
                                                            setTempPost({ lat: initialCenter[0], lng: initialCenter[1] });
                                                        } else {
                                                            alert("現在地を取得できませんでした。");
                                                        }
                                                    },
                                                    { enableHighAccuracy: true, timeout: 5000 }
                                                );
                                            } else if (initialCenter) {
                                                setTempPost({ lat: initialCenter[0], lng: initialCenter[1] });
                                            }
                                        }}
                                        className="btn btn-primary"
                                        style={{ width: '100%', marginBottom: '12px', fontSize: '1.1rem', padding: '16px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                                    >
                                        📍 今いる場所（現在地）で報告する
                                    </button>

                                    <button
                                        onClick={() => {
                                            setShowPostOptions(false);
                                            setIsSelectingLocation(true);
                                        }}
                                        className="btn"
                                        style={{ width: '100%', marginBottom: '16px', fontSize: '1.1rem', padding: '16px', backgroundColor: '#F3F4F6', color: '#1F2937', borderRadius: '12px', border: '1px solid #E5E7EB' }}
                                    >
                                        🗺️ 地図から場所を選んで報告する
                                    </button>

                                    <button
                                        onClick={() => setShowPostOptions(false)}
                                        className="btn btn-secondary"
                                        style={{ width: '100%', padding: '16px', borderRadius: '12px', backgroundColor: '#fff', border: 'none', color: '#6B7280' }}
                                    >
                                        キャンセル
                                    </button>
                                </div>
                                <style>{`
                                    @keyframes slideUp {
                                        from { transform: translateY(100%); }
                                        to { transform: translateY(0); }
                                    }
                                `}</style>
                            </div>
                        )}

                        {/* Location Selection Overlay UI */}
                        {isSelectingLocation && (
                            <>
                                {/* Center Target Crosshair */}
                                <div style={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -100%)', // Lift slightly so the pin tip points to center
                                    zIndex: 1500,
                                    pointerEvents: 'none',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    filter: 'drop-shadow(0px 4px 4px rgba(0,0,0,0.3))'
                                }}>
                                    <div style={{ fontSize: '3rem', lineHeight: '1' }}>📍</div>
                                </div>

                                {/* Floating Action Buttons */}
                                <div style={{
                                    position: 'absolute',
                                    bottom: '30px', /* Bottom sheet/tab bar clearance */
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    zIndex: 1000,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '12px',
                                    width: '90%',
                                    maxWidth: '300px',
                                    paddingBottom: 'env(safe-area-inset-bottom)'
                                }}>
                                    <button
                                        className="btn card"
                                        style={{
                                            backgroundColor: 'var(--color-primary)',
                                            color: 'white',
                                            fontWeight: 'bold',
                                            fontSize: '1.1rem',
                                            padding: '16px',
                                            borderRadius: '9999px',
                                            margin: 0,
                                            textAlign: 'center',
                                            border: 'none',
                                            boxShadow: '0 4px 12px rgba(249, 115, 22, 0.4)'
                                        }}
                                        onClick={() => {
                                            if (mapRef.current) {
                                                const center = mapRef.current.getCenter();
                                                setTempPost({ lat: center.lat, lng: center.lng });
                                            }
                                        }}
                                    >
                                        📍 ここで決定
                                    </button>
                                    <button
                                        className="btn card"
                                        style={{
                                            backgroundColor: 'white',
                                            color: 'var(--color-text-sub)',
                                            fontWeight: 'bold',
                                            fontSize: '1rem',
                                            padding: '12px',
                                            borderRadius: '9999px',
                                            margin: 0,
                                            textAlign: 'center',
                                            border: 'none',
                                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                                        }}
                                        onClick={() => setIsSelectingLocation(false)}
                                    >
                                        キャンセル
                                    </button>
                                </div>
                            </>
                        )}

                        {/* Post Form Modal */}
                        {tempPost && (
                            <div style={{
                                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                                backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 2000,
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <div className="card" style={{ width: '90%', maxWidth: '400px', margin: 0 }}>
                                    <h3>新規スポット登録</h3>
                                    <form onSubmit={handlePostSubmit}>
                                        <div style={{ marginBottom: '10px' }}>
                                            <label style={{ display: 'block', fontWeight: 'bold' }}>種類</label>
                                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <input
                                                        type="radio" name="type" value="danger"
                                                        checked={postForm.type === 'danger'}
                                                        onChange={e => setPostForm({ ...postForm, type: e.target.value })}
                                                    /> ⚠️ 危険・注意
                                                </label>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <input
                                                        type="radio" name="type" value="walk"
                                                        checked={postForm.type === 'walk'}
                                                        onChange={e => setPostForm({ ...postForm, type: e.target.value })}
                                                    /> 🐾 お散歩情報
                                                </label>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <input
                                                        type="radio" name="type" value="shelter"
                                                        checked={postForm.type === 'shelter'}
                                                        onChange={e => setPostForm({ ...postForm, type: e.target.value })}
                                                    /> 🎒 防災・避難所
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
                                                type="file"
                                                accept="image/*,.heic,.heif"
                                                onChange={async (e) => {
                                                    const file = e.target.files[0];
                                                    if (file) {
                                                        setIsProcessingImage(true);
                                                        try {
                                                            const { compressImage } = await import('../utils/imageUtils');
                                                            const compressedDataUrl = await compressImage(file);
                                                            setPostForm(prev => ({ ...prev, image: compressedDataUrl }));
                                                        } catch (error) {
                                                            console.error("Image compression failed", error);
                                                            alert("画像の処理に失敗しました。");
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
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setTempPost(null)} disabled={isSubmitting}>キャンセル</button>
                                            <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={isProcessingImage || isSubmitting}>
                                                {isSubmitting ? '保存中...' : '登録'}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        )}

                        <MapContainer
                            center={initialCenter}
                            zoom={16}
                            scrollWheelZoom={true}
                            style={{ height: "100%", width: "100%", zIndex: 1 }}
                            ref={mapRef}
                        >
                            <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            />
                            <LocationMarker />

                            {/* Official Shelters */}
                            {shelters.filter(s => filter === 'shelter').map(shelter => (
                                <Marker key={shelter.id} position={[shelter.lat, shelter.lng]}>
                                    <Popup>
                                        <strong>{shelter.name}</strong><br />
                                        {shelter.address}<br />
                                        <span style={{
                                            display: 'inline-block',
                                            marginTop: '4px',
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            backgroundColor: shelter.pet_friendly ? 'var(--color-success)' : 'var(--color-text-sub)',
                                            color: 'white',
                                            fontSize: '0.75rem'
                                        }}>
                                            {shelter.pet_friendly ? 'ペット可' : 'ペット不可'}
                                        </span>
                                        {shelter.notes && <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>{shelter.notes}</div>}
                                    </Popup>
                                </Marker>
                            ))}

                            {/* User Posts */}
                            {filteredPosts.map(post => {
                                const hasThanked = post.thanks?.includes(currentUser?.uid);
                                const isOld = post.timestamp ? (Date.now() - post.timestamp > 48 * 60 * 60 * 1000) : false;
                                let markerIcon = post.resolved ? resolvedIcon :
                                    (post.type === 'danger' ? dangerIcon :
                                        (post.type === 'shelter' ? shelterIcon : walkIcon));

                                return (
                                    <Marker
                                        key={post.id}
                                        position={[post.lat, post.lng]}
                                        icon={markerIcon}
                                        opacity={isOld ? 0.5 : 1}
                                        ref={(ref) => {
                                            if (ref) {
                                                markerRefs.current.set(post.id, ref);
                                            } else {
                                                markerRefs.current.delete(post.id);
                                            }
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
                                                            // No new popup was opened, so we are actually closing. Scroll back to list.
                                                            const el = document.getElementById(`post-item-${post.id}`);
                                                            if (el) {
                                                                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                            }
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
                                                        padding: '4px 8px', borderRadius: '16px', cursor: 'pointer', fontSize: '0.85rem', flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px'
                                                    }}
                                                >
                                                    💖 {post.thanks?.length || 0}
                                                </button>

                                                {!post.resolved && (
                                                    <button
                                                        onClick={() => handleResolve(post.id)}
                                                        style={{
                                                            background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#059669',
                                                            padding: '4px 8px', borderRadius: '16px', cursor: 'pointer', fontSize: '0.85rem', flex: 1
                                                        }}
                                                    >
                                                        👍 解決済に
                                                    </button>
                                                )}
                                            </div>

                                            <div style={{ textAlign: 'right', marginTop: '8px' }}>
                                                <button
                                                    onClick={() => deletePost(post.id, post.imagePath)}
                                                    style={{
                                                        background: 'none', border: 'none', color: '#EF4444',
                                                        textDecoration: 'underline', cursor: 'pointer', fontSize: '0.75rem'
                                                    }}
                                                >
                                                    投稿を削除
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

            <BottomSheet
                open={!isSelectingLocation}
                blocking={false}
                snapPoints={({ maxHeight }) => [
                    maxHeight * 0.3, // 初期状態（タブと1つ目の投稿が見える程度）
                    maxHeight * 0.65 // 最大展開時（背後のマップが必ず上部に見えるようにする）
                ]}
                defaultSnap={({ snapPoints }) => snapPoints[0]}
                header={
                    <div style={{ padding: '8px 16px 0 16px', maxWidth: '100vw', boxSizing: 'border-box' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <h3 style={{ margin: 0, fontSize: '1.2rem' }}>地域の最新情報</h3>
                            <button
                                onClick={handleRefresh}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    fontSize: '1.2rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '4px',
                                    color: 'var(--color-text-sub)'
                                }}
                                title="最新の情報に更新"
                            >
                                🔄
                            </button>
                        </div>
                        {/* 【重要】タッチイベントがBottomSheetに吸い込まれるのを防ぐ */}
                        <div
                            className="map-top-filters"
                            onPointerDown={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                            onTouchMove={(e) => e.stopPropagation()}
                        >
                            <button className={`filter-chip ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>すべて</button>
                            <button className={`filter-chip ${filter === 'danger' ? 'active' : ''}`} onClick={() => setFilter('danger')}>危険・スポット</button>
                            <button className={`filter-chip ${filter === 'walk' ? 'active' : ''}`} onClick={() => setFilter('walk')}>お散歩情報</button>
                            <button className={`filter-chip ${filter === 'shelter' ? 'active' : ''}`} onClick={() => setFilter('shelter')}>防災情報</button>
                        </div>
                    </div>
                }
                style={{ zIndex: 10, display: isSelectingLocation ? 'none' : 'block' }}
            >
                <div style={{ padding: '0 var(--spacing-md)', paddingBottom: '120px' }}>
                    <PullToRefresh onRefresh={handleRefresh} pullingContent="" refreshingContent={<div style={{ textAlign: 'center', padding: '10px', color: 'var(--color-text-sub)' }}>更新中...</div>}>
                        {filteredPosts.length > 0 ? (
                            <div style={{ display: 'grid', gap: 'var(--spacing-sm)' }}>
                                {[...filteredPosts].sort((a, b) => b.timestamp - a.timestamp).map(post => {
                                    const hasThanked = post.thanks?.includes(currentUser?.uid);
                                    const isOld = post.timestamp ? (Date.now() - post.timestamp > 48 * 60 * 60 * 1000) : false;
                                    return (
                                        <div
                                            key={post.id}
                                            id={`post-item-${post.id}`}
                                            className="card"
                                            onClick={() => handleListPostClick(post)}
                                            style={{
                                                padding: 'var(--spacing-sm) var(--spacing-md)',
                                                margin: 0,
                                                cursor: 'pointer',
                                                backgroundColor: activePostId === post.id ? '#EFF6FF' : 'var(--color-surface)',
                                                borderLeft: post.type === 'danger' ? '4px solid #F59E0B' : (post.type === 'shelter' ? '4px solid #8B5CF6' : '4px solid #10B981'),
                                                transition: 'background-color 0.2s',
                                                opacity: isOld ? 0.6 : 1
                                            }}
                                        >
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                {/* 上段：タイトルと日付 */}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                    <div style={{ fontWeight: 'bold', color: post.resolved ? '#9CA3AF' : 'inherit', textDecoration: post.resolved ? 'line-through' : 'none', flex: 1, paddingRight: '8px' }}>
                                                        {post.type === 'danger' ? '⚠️' : (post.type === 'shelter' ? '🎒' : '🐾')} {post.title}
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-sub)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                                        {post.date}
                                                    </div>
                                                </div>

                                                {/* 中段：詳細メモ */}
                                                <div style={{ fontSize: '0.85rem', color: 'var(--color-text-sub)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                                    {post.note || '詳細なし'}
                                                </div>

                                                {/* 下段：写真アイコンとハートボタン */}
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
                                                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-sub)' }}>
                                                        {post.imageUrl && <span style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>📷 写真あり</span>}
                                                    </div>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleThanks(post.id, post.thanks);
                                                        }}
                                                        style={{
                                                            background: hasThanked ? '#FDF2F8' : 'transparent',
                                                            border: hasThanked ? '1px solid #FBCFE8' : '1px solid #E5E7EB',
                                                            color: hasThanked ? '#DB2777' : '#4B5563',
                                                            padding: '4px 12px', /* 少し押しやすく広げる */
                                                            borderRadius: '16px',
                                                            cursor: 'pointer',
                                                            fontSize: '0.85rem',
                                                            display: 'flex',
                                                            justifyContent: 'center',
                                                            alignItems: 'center',
                                                            gap: '4px'
                                                        }}
                                                    >
                                                        💖 {post.thanks?.length || 0}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p style={{ color: 'var(--color-text-sub)', textAlign: 'center', padding: 'var(--spacing-lg) 0' }}>
                                周辺の投稿はまだありません。
                            </p>
                        )}
                    </PullToRefresh>
                </div>
            </BottomSheet>
        </div>
    );
};

export default MapPage;
