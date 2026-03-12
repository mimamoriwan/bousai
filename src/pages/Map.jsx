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

// Others/Discovery Icon (Blue/Lightbulb)
const othersIcon = L.divIcon({
    className: 'others-icon',
    html: '<div style="background-color: #3B82F6; width: 32px; height: 32px; border-radius: 50%; border: 2px solid white; display:flex; align-items:center; justify-content:center; font-size:18px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">💡</div>',
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
            map.locate({ setView: false, maxZoom: 16 }); // Update: setView to false for initial locate
        });
    }, [map]);

    useMapEvents({
        locationfound(e) {
            setPosition(e.latlng);
            // initialCenter is also updated in Map component useEffect,
            // but local state is used to draw the marker
        },
    });

    // Define currentLocationIcon here or import it if it's a global constant
    const currentLocationIcon = L.divIcon({
        className: 'user-location-icon',
        html: '<div style="background-color: #EF4444; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5);"></div>',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });

    return (
        <>
            {position !== null && (
                <Marker
                    position={position}
                    icon={currentLocationIcon} // Changed from userIcon to currentLocationIcon
                    zIndexOffset={10000} // Set very high zIndexOffset so it always stays on top
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
        </>
    );
};

// ユーティリティ: 相対時間のフォーマット（〇時間前、昨日など）
const getRelativeTime = (timestamp) => {
    if (!timestamp) return '日付不明';

    const now = new Date();
    const postDate = new Date(timestamp);
    const diffMs = now - postDate;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) {
        return diffMins <= 1 ? 'たった今' : `${diffMins}分前`;
    } else if (diffHours < 24) {
        return `${diffHours}時間前`;
    } else if (diffDays === 1) {
        return '昨日';
    } else if (diffDays < 7) {
        return `${diffDays}日前`;
    } else {
        // 1週間以上前は日付
        return `${postDate.getFullYear()}/${String(postDate.getMonth() + 1).padStart(2, '0')}/${String(postDate.getDate()).padStart(2, '0')}`;
    }
};

const MapPage = () => {
    // User Posts State (now driven by Firestore)
    const [userPosts, setUserPosts] = useState([]);
    const [filter, setFilter] = useState('all');
    const [activeMapLayer, setActiveMapLayer] = useState('public');
    const [showArchived, setShowArchived] = useState(false); // Toggle for old posts

    const [isSelectingLocation, setIsSelectingLocation] = useState(false);
    const [showPostOptions, setShowPostOptions] = useState(false);
    const [tempPost, setTempPost] = useState(null); // { lat, lng }
    const [postForm, setPostForm] = useState({ type: 'danger', title: '', note: '', image: null, visibility: 'public' });
    const [isProcessingImage, setIsProcessingImage] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false); // For Firebase Submit Loading state

    // Quick Post State
    const [showQuickPostSheet, setShowQuickPostSheet] = useState(false);
    const [quickPostStep, setQuickPostStep] = useState(1);
    const [quickPostData, setQuickPostData] = useState({ title: '', type: 'danger' });
    const [showSuccessToast, setShowSuccessToast] = useState(false);

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
                pins.push({
                    id: doc.id,
                    ...data,
                    visibility: data.visibility || 'public',
                    savedBy: Array.isArray(data.savedBy) ? data.savedBy : [],
                    thanks: Array.isArray(data.thanks) ? data.thanks : []
                });
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
                pins.push({
                    id: doc.id,
                    ...data,
                    visibility: data.visibility || 'public',
                    savedBy: Array.isArray(data.savedBy) ? data.savedBy : [],
                    thanks: Array.isArray(data.thanks) ? data.thanks : []
                });
            });
            setUserPosts(pins);
        }, (error) => {
            console.error("Error fetching pins: ", error);
        });

        return () => {
            unsubscribe();
        };
    }, []);

    const handleMapClick = (latlng) => {
        setTempPost(latlng);
    };

    const handlePostSubmit = async (e) => {
        e.preventDefault();
        if (!tempPost) return;

        // --- Anonymous User Rate Limiting (Max 3 posts per day) ---
        if (currentUser && currentUser.isAnonymous) {
            const startOfToday = new Date();
            startOfToday.setHours(0, 0, 0, 0);
            const todayPostsCount = userPosts.filter(p => p.uid === currentUser.uid && p.timestamp >= startOfToday.getTime()).length;

            if (todayPostsCount >= 3) {
                alert("お試しモードでの投稿は1日3回までです。\n制限を解除するにはマイページからGoogleで本登録を行ってください。");
                return;
            }
        }

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
                savedBy: [], // Array of user UIDs who saved this post
                visibility: postForm.visibility || 'public',
                uid: currentUser ? currentUser.uid : null, // Record UID to track posts
                memberNumber: currentUser && !currentUser.isAnonymous && memberNumber ? memberNumber : null
            };

            await addDoc(collection(db, "map_pins"), newPostData);

            // 3. Reset UI state on success
            setTempPost(null);
            setIsSelectingLocation(false);
            setPostForm({ type: 'danger', title: '', note: '', image: null, visibility: 'public' });
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

    const handleSavePost = async (postId, currentSavedBy) => {
        if (!currentUser) {
            alert("「マイマップに保存」機能を利用するには、ログインが必要です。");
            return;
        }
        if (currentUser.isAnonymous) {
            alert("自分だけのマイマップ機能を利用するには、Googleアカウントでの本登録（無料）が必要です🐾\n（マイページより登録できます）");
            return;
        }

        const postRef = doc(db, 'map_pins', postId);
        const savedByArray = currentSavedBy || [];
        const hasSaved = savedByArray.includes(currentUser.uid);

        try {
            if (hasSaved) {
                await updateDoc(postRef, { savedBy: arrayRemove(currentUser.uid) });
            } else {
                await updateDoc(postRef, { savedBy: arrayUnion(currentUser.uid) });
            }
        } catch (error) {
            console.error("Error toggling save post: ", error);
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

    const displayPosts = userPosts.filter(post => {
        // Exclude shelter posts completely unless explicitly filtering for it
        if (post.type === 'shelter' && filter !== 'shelter') return false;

        if (activeMapLayer === 'myMap') {
            // MY MAP LOGIC
            if (!currentUser) return false;

            const isMine = post.uid === currentUser.uid;
            const isSaved = post.savedBy?.includes(currentUser.uid);

            if (!isMine && !isSaved) return false;

            // Type filtering for My Map
            if (filter !== 'all' && filter !== 'resolved') {
                if (filter === 'walk') {
                    if (post.type !== 'walk' && post.type !== 'useful') return false;
                } else {
                    if (post.type !== filter) return false;
                }
            }
            if (filter === 'resolved' && !post.resolved) return false;
            // Show all including resolved in MyMap if 'all' is toggled.

            return true; // No 48h restriction!
        } else {
            // PUBLIC MAP LOGIC
            if (post.visibility === 'private') return false;

            // Type filtering
            if (filter === 'all' && post.resolved) return false;
            if (filter === 'resolved' && !post.resolved) return false;
            if (filter !== 'all' && filter !== 'resolved' && post.resolved) return false;

            if (filter === 'walk' && post.type !== 'walk' && post.type !== 'useful') return false;
            if (filter !== 'all' && filter !== 'resolved' && filter !== 'walk' && post.type !== filter) return false;

            // 48h restriction
            const isOld = post.timestamp ? (Date.now() - post.timestamp > 48 * 60 * 60 * 1000) : false;
            if (!showArchived && isOld) return false;

            return true;
        }
    });

    const closeQuickPost = () => {
        setShowQuickPostSheet(false);
        setQuickPostStep(1);
        setPostForm(prev => ({ ...prev, image: null }));
    };

    const handleQuickPostSubmit = async (withPhoto = false, imageDataUrl = null) => {
        if (currentUser && currentUser.isAnonymous) {
            const startOfToday = new Date();
            startOfToday.setHours(0, 0, 0, 0);
            const todayPostsCount = userPosts.filter(p => p.uid === currentUser.uid && p.timestamp >= startOfToday.getTime()).length;
            if (todayPostsCount >= 3) {
                alert("お試しモードでの投稿は1日3回までです。\n制限を解除するにはマイページからGoogleで本登録を行ってください。");
                return;
            }
        }

        setIsSubmitting(true);
        try {
            let lat, lng;
            try {
                const pos = await new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 5000 });
                });
                lat = pos.coords.latitude;
                lng = pos.coords.longitude;
            } catch (err) {
                console.warn("Geolocation fallback for Quick Post:", err);
                if (initialCenter) {
                    lat = initialCenter[0];
                    lng = initialCenter[1];
                } else {
                    alert("現在地を取得できませんでした。");
                    setIsSubmitting(false);
                    return;
                }
            }

            let imageUrl = null;
            let imagePath = null;
            const finalImage = imageDataUrl || postForm.image;
            if (withPhoto && finalImage) {
                const mimeTypeMatch = finalImage.match(/data:(.*?);/);
                const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/jpeg';
                const ext = mimeType === 'image/webp' ? 'webp' : 'jpg';
                const filename = `map_pins/${Date.now()}.${ext}`;
                const storageRef = ref(storage, filename);
                await uploadString(storageRef, finalImage, 'data_url');
                imageUrl = await getDownloadURL(storageRef);
                imagePath = filename;
            }

            const newPostData = {
                lat, lng,
                type: quickPostData.type,
                title: quickPostData.title,
                note: '',
                date: new Date().toLocaleDateString(),
                timestamp: Date.now(),
                imageUrl: imageUrl,
                imagePath: imagePath,
                resolved: false,
                thanks: [],
                savedBy: [],
                visibility: 'public', // Quick post is always public default for MVP quickness
                uid: currentUser ? currentUser.uid : null,
                memberNumber: currentUser && !currentUser.isAnonymous && memberNumber ? memberNumber : null
            };

            await addDoc(collection(db, "map_pins"), newPostData);

            setShowQuickPostSheet(false);
            setQuickPostStep(1);
            setPostForm(prev => ({ ...prev, image: null }));
            setShowSuccessToast(true);
            setTimeout(() => setShowSuccessToast(false), 3000);

        } catch (error) {
            console.error("Error adding quick post: ", error);
            alert("投稿の保存に失敗しました。もう一度お試しください。");
        } finally {
            setIsSubmitting(false);
        }
    };

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
                        `}</style>
                    </div>
                ) : (
                    <>
                        {/* Action Menu (FAB) & Top Overlays */}
                        {!isSelectingLocation && (
                            <>


                                {/* Go to Current Location FAB */}
                                <div style={{ position: 'absolute', bottom: 'calc(25vh + 100px)', right: '20px', zIndex: 1000 }}>
                                    <button
                                        onClick={() => {
                                            if (showQuickPostSheet) closeQuickPost();

                                            const navigateToCenter = (lat, lng) => {
                                                if (mapRef.current) {
                                                    mapRef.current.setView([lat, lng], 16, {
                                                        animate: true,
                                                        duration: 0.5
                                                    });
                                                }
                                            };

                                            if (!navigator.geolocation) {
                                                if (initialCenter) {
                                                    navigateToCenter(initialCenter[0], initialCenter[1]);
                                                } else {
                                                    alert("お使いの端末・ブラウザでは現在地取得機能がサポートされていません。");
                                                }
                                                return;
                                            }

                                            // 1. Try to get a fresh position
                                            navigator.geolocation.getCurrentPosition(
                                                (pos) => {
                                                    navigateToCenter(pos.coords.latitude, pos.coords.longitude);
                                                },
                                                (error) => {
                                                    console.warn("Geolocation Error when seeking home:", error);
                                                    // 2. Fallback to initialCenter if fetching a fresh one fails
                                                    if (initialCenter) {
                                                        console.log("Falling back to initialCenter tracking.");
                                                        navigateToCenter(initialCenter[0], initialCenter[1]);
                                                    } else {
                                                        let errorMessage = "現在地を取得できませんでした。";
                                                        if (error.code === 1) errorMessage = "位置情報の利用が許可されていません。端末の設定をご確認ください。";
                                                        if (error.code === 2 || error.code === 3) errorMessage = "位置情報が取得できません。ブラウザの権限設定を確認してください。";
                                                        alert(errorMessage);
                                                    }
                                                },
                                                { enableHighAccuracy: true, timeout: 5000, maximumAge: 10000 }
                                            );
                                        }}
                                        style={{
                                            backgroundColor: 'white',
                                            color: 'var(--color-primary)',
                                            width: '50px',
                                            height: '50px',
                                            borderRadius: '50%',
                                            boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '1.6rem',
                                            transition: 'transform 0.1s, background-color 0.2s',
                                            cursor: 'pointer',
                                            border: 'none',
                                            padding: 0
                                        }}
                                        onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.9)'}
                                        onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                        onTouchStart={(e) => e.currentTarget.style.transform = 'scale(0.9)'}
                                        onTouchEnd={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                        title="現在地に戻る"
                                        aria-label="現在地に戻る"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="28px" height="28px">
                                            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
                                        </svg>
                                    </button>
                                </div>

                                <div style={{ position: 'absolute', bottom: 'calc(25vh + 30px)', right: '16px', zIndex: 1000 }}>
                                    <button
                                        onClick={() => {
                                            if (!requireAuth('アクションメニューを開く')) return;
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
                                            width: '60px',
                                            height: '60px',
                                            borderRadius: '50%',
                                            boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
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
                                    <h3 style={{ textAlign: 'center', marginBottom: '20px', fontSize: '1.1rem' }}>アクションを選択</h3>

                                    <div style={{ fontSize: '0.9rem', color: '#6B7280', marginBottom: '8px', fontWeight: 'bold' }}>【アクション】</div>
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

                                    {/* 
                                     * [TODO]: お散歩モード（ルートトラッキング・共有機能）の再実装
                                     * ユーザー同士のフレンド機能やグループ機能が実装され、
                                     * プライバシー保護の仕組みが完全に整った段階で導入を検討するため一時的に撤去
                                     */}

                                    <button
                                        onClick={() => {
                                            setShowPostOptions(false);
                                            setQuickPostStep(1);
                                            setShowQuickPostSheet(true);
                                        }}
                                        className="btn"
                                        style={{
                                            width: '100%',
                                            marginBottom: '16px',
                                            fontSize: '1.2rem',
                                            padding: '16px',
                                            backgroundColor: '#FFF7ED',
                                            color: '#EA580C',
                                            borderRadius: '12px',
                                            border: '1px solid #FED7AA',
                                            fontWeight: 'bold',
                                            display: 'flex',
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                            gap: '8px'
                                        }}
                                    >
                                        ⚡️ クイック投稿
                                    </button>

                                    <div style={{ borderTop: '1px solid #E5E7EB', margin: '16px 0 8px 0' }} />
                                    <div style={{ fontSize: '0.9rem', color: '#6B7280', marginBottom: '12px', fontWeight: 'bold' }}>【マップ表示設定】</div>

                                    {/* Map Display Toggles */}
                                    <div style={{
                                        display: 'flex',
                                        backgroundColor: '#E5E7EB',
                                        borderRadius: '12px',
                                        padding: '4px',
                                        marginBottom: '12px',
                                        width: '100%'
                                    }}>
                                        <button
                                            onClick={() => setActiveMapLayer('public')}
                                            style={{
                                                flex: 1,
                                                padding: '12px',
                                                borderRadius: '8px',
                                                border: 'none',
                                                backgroundColor: activeMapLayer === 'public' ? '#FFFFFF' : 'transparent',
                                                color: activeMapLayer === 'public' ? 'var(--color-primary)' : '#6B7280',
                                                fontWeight: activeMapLayer === 'public' ? 'bold' : '600',
                                                fontSize: '0.95rem',
                                                cursor: 'pointer',
                                                transition: 'all 0.3s ease',
                                                boxShadow: activeMapLayer === 'public' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
                                            }}
                                        >
                                            🌍 みんなのマップ
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (!currentUser || currentUser.isAnonymous) {
                                                    alert("自分だけのマイマップ機能を利用するには、Googleアカウントでの本登録（無料）が必要です🐾\n（マイページより登録できます）");
                                                    return;
                                                }
                                                setActiveMapLayer('myMap');
                                            }}
                                            style={{
                                                flex: 1,
                                                padding: '12px',
                                                borderRadius: '8px',
                                                border: 'none',
                                                backgroundColor: activeMapLayer === 'myMap' ? '#FFFFFF' : 'transparent',
                                                color: activeMapLayer === 'myMap' ? 'var(--color-primary)' : '#6B7280',
                                                fontWeight: activeMapLayer === 'myMap' ? 'bold' : '600',
                                                fontSize: '0.95rem',
                                                cursor: 'pointer',
                                                transition: 'all 0.3s ease',
                                                boxShadow: activeMapLayer === 'myMap' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
                                            }}
                                        >
                                            🗺️ マイマップ
                                        </button>
                                    </div>

                                    {activeMapLayer === 'public' && (
                                        <button
                                            onClick={() => setShowArchived(!showArchived)}
                                            style={{
                                                width: '100%',
                                                marginBottom: '16px',
                                                backgroundColor: showArchived ? 'var(--color-primary)' : '#F3F4F6',
                                                color: showArchived ? 'white' : '#4B5563',
                                                border: 'none',
                                                borderRadius: '12px',
                                                padding: '14px',
                                                fontSize: '1rem',
                                                fontWeight: 'bold',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '8px',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s ease',
                                            }}
                                        >
                                            🕒 過去情報: {showArchived ? 'ON (直近48時間以上の情報も表示)' : 'OFF (直近48時間の情報のみ)'}
                                        </button>
                                    )}

                                    <button
                                        onClick={() => setShowPostOptions(false)}
                                        className="btn btn-secondary"
                                        style={{ width: '100%', padding: '16px', borderRadius: '12px', backgroundColor: 'transparent', border: '1px solid #E5E7EB', color: '#6B7280', marginTop: '8px' }}
                                    >
                                        閉じる
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
                                position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 2000,
                                display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
                                overflowY: 'auto', WebkitOverflowScrolling: 'touch',
                                padding: '16px', paddingTop: 'max(16px, env(safe-area-inset-top))', paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
                                boxSizing: 'border-box'
                            }}
                                onTouchMove={(e) => e.stopPropagation()}
                                onTouchStart={(e) => e.stopPropagation()}
                                onTouchEnd={(e) => e.stopPropagation()}
                                onPointerDown={(e) => e.stopPropagation()}
                                onWheel={(e) => e.stopPropagation()}
                            >
                                <div className="card" style={{
                                    width: '100%',
                                    maxWidth: '400px',
                                    margin: 0,
                                    padding: 0,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    maxHeight: 'calc(100dvh - 32px)',
                                    overflow: 'hidden'
                                }}
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
                                                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <input
                                                            type="radio" name="type" value="others"
                                                            checked={postForm.type === 'others'}
                                                            onChange={e => setPostForm({ ...postForm, type: e.target.value })}
                                                        /> 💡 街の発見・その他
                                                    </label>
                                                </div>
                                            </div>
                                            <div style={{ marginBottom: '10px' }}>
                                                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>公開範囲</label>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

                                                    {/* 1段目：みんなに公開 */}
                                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                                        <input
                                                            type="radio"
                                                            name="visibility"
                                                            value="public"
                                                            checked={postForm.visibility === 'public'}
                                                            onChange={() => setPostForm({ ...postForm, visibility: 'public' })}
                                                            style={{ width: '18px', height: '18px', accentColor: 'var(--color-primary)' }}
                                                        />
                                                        <span style={{ fontSize: '0.95rem', fontWeight: postForm.visibility === 'public' ? 'bold' : 'normal' }}>
                                                            🌍 みんなに公開 <span style={{ fontSize: '0.8rem', color: '#6B7280', fontWeight: 'normal' }}>（48時間で消えます）</span>
                                                        </span>
                                                    </label>

                                                    {/* 2段目：自分だけ */}
                                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', opacity: (currentUser && currentUser.isAnonymous) ? 0.6 : 1 }}>
                                                        <input
                                                            type="radio"
                                                            name="visibility"
                                                            value="private"
                                                            checked={postForm.visibility === 'private'}
                                                            onChange={() => {
                                                                if (currentUser && currentUser.isAnonymous) {
                                                                    alert("自分だけのマイマップ機能を利用するには、Googleアカウントでの本登録（無料）が必要です🐾\n（マイページより登録できます）");
                                                                    return;
                                                                }
                                                                setPostForm({ ...postForm, visibility: 'private' });
                                                            }}
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
                                            {/* 可愛いイラスト */}
                                            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center', width: '100%' }}>
                                                <img
                                                    src="/toukou_botom.png"
                                                    alt="みまもりWANの仲間たち"
                                                    style={{
                                                        width: '100%',
                                                        height: 'auto',
                                                        borderRadius: '12px',
                                                        objectFit: 'cover',
                                                        boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
                                                    }}
                                                />
                                            </div>
                                        </div>
                                        {/* ▼▼▼ 下部追従（Sticky）ボタン ▼▼▼ */}
                                        <div style={{
                                            position: 'sticky', bottom: '90px', background: '#fff',
                                            padding: '12px 16px calc(12px + env(safe-area-inset-bottom))',
                                            display: 'flex', gap: '10px',
                                            borderTop: '1px solid #eee',
                                            zIndex: 10 /* 写真の上に確実にボタンを表示する */
                                        }}>
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
                            {shelters.filter(() => filter === 'shelter').map(shelter => (
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
                            {displayPosts.map(post => {
                                const hasThanked = post.thanks?.includes(currentUser?.uid);
                                const isOld = post.timestamp ? (Date.now() - post.timestamp > 48 * 60 * 60 * 1000) : false;
                                let markerIcon = post.resolved ? resolvedIcon :
                                    (post.type === 'danger' ? dangerIcon :
                                        (post.type === 'shelter' ? shelterIcon :
                                            (post.type === 'others' ? othersIcon : walkIcon)));

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
                                                {/* My Map Save Button */}
                                                {(post.uid !== currentUser?.uid) && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleSavePost(post.id, post.savedBy);
                                                        }}
                                                        style={{
                                                            background: post.savedBy?.includes(currentUser?.uid) ? '#FEF3C7' : '#F3F4F6',
                                                            border: post.savedBy?.includes(currentUser?.uid) ? '1px solid #FCD34D' : '1px solid #E5E7EB',
                                                            color: post.savedBy?.includes(currentUser?.uid) ? '#D97706' : '#4B5563',
                                                            padding: '4px 8px', borderRadius: '16px', cursor: 'pointer', fontSize: '0.85rem', flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px'
                                                        }}
                                                    >
                                                        {post.savedBy?.includes(currentUser?.uid) ? '🌟 保存済' : '⭐️ 保存'}
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

            {/* Success Toast UI */}
            {showSuccessToast && (
                <div style={{
                    position: 'fixed',
                    top: 'max(20px, env(safe-area-inset-top))',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    backgroundColor: '#10B981',
                    color: 'white',
                    padding: '12px 24px',
                    borderRadius: '24px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    zIndex: 4000,
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    animation: 'slideDownFadeOut 3s forwards'
                }}>
                    ✅ 報告完了しました！
                </div>
            )}
            <style>{`
                @keyframes slideDownFadeOut {
                    0% { transform: translate(-50%, -20px); opacity: 0; }
                    10% { transform: translate(-50%, 0); opacity: 1; }
                    80% { transform: translate(-50%, 0); opacity: 1; }
                    100% { transform: translate(-50%, -20px); opacity: 0; }
                }
            `}</style>

            <BottomSheet
                open={!isSelectingLocation && !showQuickPostSheet}
                blocking={false}
                snapPoints={({ maxHeight }) => [
                    maxHeight * 0.3, // 初期状態（タブと1つ目の投稿が見える程度）
                    maxHeight * 0.65 // 最大展開時（背後のマップが必ず上部に見えるようにする）
                ]}
                defaultSnap={({ snapPoints }) => snapPoints[0]}
                header={
                    <div style={{ padding: '8px 16px 0 16px', maxWidth: '100vw', boxSizing: 'border-box' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
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
                            data-rsbs-no-pan="true"
                            onPointerDown={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                            onTouchMove={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                            style={{ position: 'relative', zIndex: 100, pointerEvents: 'auto' }}
                        >
                            <button className={`filter-chip ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>すべて</button>
                            <button className={`filter-chip ${filter === 'walk' ? 'active' : ''}`} onClick={() => setFilter('walk')}>お散歩情報</button>
                            <button className={`filter-chip ${filter === 'danger' ? 'active' : ''}`} onClick={() => setFilter('danger')}>危険・スポット</button>
                            <button className={`filter-chip ${filter === 'others' ? 'active' : ''}`} onClick={() => setFilter('others')}>街の発見等</button>
                            <button className={`filter-chip ${filter === 'shelter' ? 'active' : ''}`} onClick={() => setFilter('shelter')}>防災情報</button>
                        </div>
                    </div>
                }
                style={{ zIndex: 10, display: isSelectingLocation ? 'none' : 'block' }}
            >
                <div style={{ padding: '0 var(--spacing-md)', paddingBottom: '120px' }}>
                    <PullToRefresh onRefresh={handleRefresh} pullingContent="" refreshingContent={<div style={{ textAlign: 'center', padding: '10px', color: 'var(--color-text-sub)' }}>更新中...</div>}>
                        {displayPosts.length > 0 ? (
                            <div style={{ display: 'grid', gap: 'var(--spacing-sm)' }}>
                                {[...displayPosts].sort((a, b) => b.timestamp - a.timestamp).map(post => {
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
                                                borderLeft: post.type === 'danger' ? '4px solid #F59E0B' : (post.type === 'shelter' ? '4px solid #8B5CF6' : (post.type === 'others' ? '4px solid #3B82F6' : '4px solid #10B981')),
                                                transition: 'background-color 0.2s',
                                                opacity: isOld ? 0.5 : 1 // 48時間経過アイテムは半透明
                                            }}
                                        >
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                {/* 上段：タイトルと日付/バッジ */}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                    <div style={{ fontWeight: 'bold', color: post.resolved ? '#9CA3AF' : 'inherit', textDecoration: post.resolved ? 'line-through' : 'none', flex: 1, paddingRight: '12px' }}>
                                                        {post.type === 'danger' ? '⚠️' : (post.type === 'shelter' ? '🎒' : (post.type === 'others' ? '💡' : '🐾'))} {post.title}
                                                    </div>
                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-sub)', whiteSpace: 'nowrap', fontWeight: 'bold' }}>
                                                            {getRelativeTime(post.timestamp)}
                                                        </div>
                                                        {isOld && (
                                                            <div style={{
                                                                fontSize: '0.65rem',
                                                                color: '#6B7280',
                                                                backgroundColor: '#F3F4F6',
                                                                padding: '2px 6px',
                                                                borderRadius: '4px',
                                                                marginTop: '4px',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '2px'
                                                            }}>
                                                                🕒 過去の情報
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* 中段：詳細メモ */}
                                                <div style={{ fontSize: '0.85rem', color: 'var(--color-text-sub)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                                    {post.note || '詳細なし'}
                                                </div>

                                                {/* 下段：写真アイコンとハートボタンなど */}
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
                                                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-sub)' }}>
                                                        {post.imageUrl && <span style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>📷 写真あり</span>}
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                        {(post.uid !== currentUser?.uid) && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleSavePost(post.id, post.savedBy);
                                                                }}
                                                                style={{
                                                                    background: post.savedBy?.includes(currentUser?.uid) ? '#FEF3C7' : 'transparent',
                                                                    border: post.savedBy?.includes(currentUser?.uid) ? '1px solid #FCD34D' : '1px solid #E5E7EB',
                                                                    color: post.savedBy?.includes(currentUser?.uid) ? '#D97706' : '#4B5563',
                                                                    padding: '4px 12px',
                                                                    borderRadius: '16px',
                                                                    cursor: 'pointer',
                                                                    fontSize: '0.85rem',
                                                                    display: 'flex',
                                                                    justifyContent: 'center',
                                                                    alignItems: 'center',
                                                                    gap: '4px'
                                                                }}
                                                            >
                                                                {post.savedBy?.includes(currentUser?.uid) ? '🌟 保存済' : '⭐️ 保存'}
                                                            </button>
                                                        )}
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

            {/* Quick Post Bottom Sheet */}
            <BottomSheet
                open={showQuickPostSheet}
                onDismiss={closeQuickPost}
                blocking={true} // Use built-in RSBS backdrop for reliable z-index and Sibling separation
                snapPoints={({ maxHeight }) => [maxHeight * 0.55, maxHeight * 0.9]}
                defaultSnap={({ snapPoints }) => snapPoints[0]}
                style={{
                    '--rsbs-backdrop-bg': 'rgba(0, 0, 0, 0.5)',
                    zIndex: 3000
                }}
            >
                <div
                    style={{
                        padding: '16px 20px calc(100px + env(safe-area-inset-bottom))',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px',
                        position: 'relative'
                    }}
                >
                    <button
                        onClick={closeQuickPost}
                        style={{
                            position: 'absolute',
                            top: '12px',
                            right: '20px',
                            background: '#F3F4F6',
                            border: 'none',
                            color: '#6B7280',
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1rem',
                            cursor: 'pointer',
                            zIndex: 10
                        }}
                        aria-label="閉じる"
                    >
                        ✖️
                    </button>

                    {quickPostStep === 1 ? (
                        <>
                            <h3 style={{ textAlign: 'center', margin: '0 0 16px', fontSize: '1.2rem' }}>何がありましたか？</h3>
                            <button
                                onClick={() => {
                                    setQuickPostData({ title: 'ゴミが落ちてるよ', type: 'danger' });
                                    setQuickPostStep(2);
                                }}
                                style={{
                                    width: '100%', padding: '20px', borderRadius: '16px', border: '1px solid #E5E7EB',
                                    backgroundColor: '#F9FAFB', fontSize: '1.3rem', fontWeight: 'bold',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)', cursor: 'pointer'
                                }}
                            >
                                🗑️ ゴミが落ちてるよ
                            </button>
                            <button
                                onClick={() => {
                                    setQuickPostData({ title: 'うんち落ちてる！', type: 'danger' });
                                    setQuickPostStep(2);
                                }}
                                style={{
                                    width: '100%', padding: '20px', borderRadius: '16px', border: '1px solid #E5E7EB',
                                    backgroundColor: '#F9FAFB', fontSize: '1.3rem', fontWeight: 'bold',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)', cursor: 'pointer'
                                }}
                            >
                                💩 うんち落ちてる！
                            </button>
                            <button
                                onClick={() => {
                                    setQuickPostData({ title: '危険なところがあるよ', type: 'danger' });
                                    setQuickPostStep(2);
                                }}
                                style={{
                                    width: '100%', padding: '20px', borderRadius: '16px', border: '1px solid #E5E7EB',
                                    backgroundColor: '#FEF2F2', color: '#DC2626', fontSize: '1.3rem', fontWeight: 'bold',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)', cursor: 'pointer'
                                }}
                            >
                                ⚠️ 危険なところがあるよ
                            </button>
                        </>
                    ) : (
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                                <button
                                    onClick={() => {
                                        setQuickPostStep(1);
                                        setPostForm(prev => ({ ...prev, image: null }));
                                    }}
                                    style={{ background: 'none', border: 'none', color: '#6B7280', fontSize: '1.2rem', cursor: 'pointer', padding: '4px' }}
                                >
                                    ◀️ 戻る
                                </button>
                                <h3 style={{ margin: 0, fontSize: '1.2rem', flex: 1, textAlign: 'center' }}>
                                    {quickPostData.title}
                                </h3>
                                <div style={{ width: '40px' }}></div> {/* Spacer for centering */}
                            </div>

                            <button
                                onClick={() => handleQuickPostSubmit(false)}
                                disabled={isSubmitting}
                                style={{
                                    width: '100%', padding: '24px', borderRadius: '16px', border: 'none',
                                    backgroundColor: 'var(--color-primary)', color: 'white', fontSize: '1.4rem', fontWeight: 'bold',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
                                    boxShadow: '0 4px 12px rgba(249, 115, 22, 0.3)', cursor: 'pointer',
                                    opacity: isSubmitting ? 0.7 : 1
                                }}
                            >
                                {isSubmitting ? '送信中...' : '🚀 このまま投稿する'}
                            </button>

                            <div style={{ position: 'relative', margin: '16px 0', borderTop: '2px dashed #E5E7EB' }}></div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <label style={{
                                    width: '100%', padding: '20px', borderRadius: '16px', border: '1px solid #D1D5DB',
                                    backgroundColor: 'white', color: '#4B5563', fontSize: '1.2rem', fontWeight: 'bold',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
                                    cursor: 'pointer', margin: 0
                                }}>
                                    📷 写真を追加して投稿
                                    <input
                                        type="file"
                                        accept="image/*,.heic,.heif"
                                        style={{ display: 'none' }}
                                        onChange={async (e) => {
                                            const file = e.target.files[0];
                                            if (file) {
                                                setIsProcessingImage(true);
                                                try {
                                                    const { compressImage } = await import('../utils/imageUtils');
                                                    const compressedDataUrl = await compressImage(file);
                                                    await handleQuickPostSubmit(true, compressedDataUrl);
                                                } catch (error) {
                                                    console.error("Image compression failed", error);
                                                    alert("画像の処理に失敗しました。");
                                                } finally {
                                                    setIsProcessingImage(false);
                                                }
                                            }
                                        }}
                                        disabled={isProcessingImage || isSubmitting}
                                    />
                                </label>
                                {(isProcessingImage) && (
                                    <div style={{ textAlign: 'center', color: 'var(--color-primary)', fontSize: '0.9rem', fontWeight: 'bold' }}>
                                        処理中... そのままお待ち下さい
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {/* 下部の余白を埋めるスペーサーイラスト（メニュー被り防止） */}
                    <div style={{ marginTop: 'auto', paddingTop: '8px', display: 'flex', justifyContent: 'center', width: '100%' }}>
                        <img
                            src="/toukou_botom.png"
                            alt="みまもりWANの仲間たち"
                            style={{
                                width: '100%',
                                height: 'auto',
                                borderRadius: '12px',
                                objectFit: 'cover',
                                boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
                            }}
                        />
                    </div>
                </div>
            </BottomSheet>
        </div>
    );
};

export default MapPage;
