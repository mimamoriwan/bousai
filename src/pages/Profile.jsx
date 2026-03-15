import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, storage } from '../firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs, onSnapshot, deleteDoc } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { compressImage } from '../utils/imageUtils';
import html2canvas from 'html2canvas';
import toast from 'react-hot-toast';
import RouteEditor from '../components/RouteEditor';

const Profile = () => {
    const { currentUser, memberNumber, linkWithGoogle, loginWithGoogle, loginAnonymously, logout } = useAuth();

    const [userPosts, setUserPosts] = useState([]);
    const [thanksCount, setThanksCount] = useState(0);
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    const [profile, setProfile] = useState(() => {
        // Fallback initialized later in useEffect based on currentUser
        return {
            name: '',
            species: 'dog',
            size: 'medium', // small, medium, large
            breed: '',
            birthdate: '',
            gender: 'male',
            owner: '',
            phone: '',
            vet: '',
            notes: '',
            photoUrl: ''
        };
    });

    const [isEditing, setIsEditing] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isSharing, setIsSharing] = useState(false);
    // route editor state: { open: bool, editingRoute: null | routeObject }
    const [routeEditorState, setRouteEditorState] = useState({ open: false, editingRoute: null });
    const [savedRoutes, setSavedRoutes] = useState([]);
    const emergencyCardRef = useRef(null);

    useEffect(() => {
        const fetchProfile = async () => {
            if (currentUser) {
                // Read from Firestore first
                const docRef = doc(db, 'users', currentUser.uid);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists() && docSnap.data().profile) {
                    setProfile(docSnap.data().profile);
                    setIsEditing(false);
                } else {
                    // Fallback to local storage migration if exists
                    const savedProfile = localStorage.getItem(`pet_profile_${currentUser.uid}`);
                    if (savedProfile) {
                        setProfile(JSON.parse(savedProfile));
                        setIsEditing(false);
                    } else {
                        if (currentUser.isAnonymous) {
                            // Default profile for apprentices
                            setProfile({
                                name: '見習い隊員',
                                species: 'other',
                                size: '',
                                breed: '未登録',
                                birthdate: '',
                                gender: 'male',
                                owner: '未登録',
                                phone: '未登録',
                                vet: '未登録',
                                notes: '※このプロフィールは仮のものです。「編集」ボタンからGoogle連携を行うと、自分のペットの詳しい情報を登録・保存できるようになります。',
                                photoUrl: ''
                            });
                            setIsEditing(false);
                        } else {
                            setIsEditing(true);
                        }
                    }
                }
            }
        };
        fetchProfile();
    }, [currentUser]);

    useEffect(() => {
        const fetchUserPosts = async () => {
            if (currentUser && memberNumber) {
                try {
                    const q = query(collection(db, 'map_pins'), where('memberNumber', '==', memberNumber));
                    const querySnapshot = await getDocs(q);
                    const posts = [];
                    let totalThanks = 0;
                    querySnapshot.forEach((doc) => {
                        const data = doc.data();
                        posts.push({ id: doc.id, ...data });
                        if (data.thanks && data.thanks.length) {
                            totalThanks += data.thanks.length;
                        }
                    });
                    posts.sort((a, b) => b.timestamp - a.timestamp);
                    setUserPosts(posts);
                    setThanksCount(totalThanks);
                } catch (err) {
                    console.error("Error fetching user posts:", err);
                }
            }
        };
        fetchUserPosts();
    }, [currentUser, memberNumber]);
    // MYルート一覧をリアルタイム購読
    useEffect(() => {
        if (!currentUser || currentUser.isAnonymous) return;
        const routesRef = collection(db, 'users', currentUser.uid, 'routes');
        const unsubscribe = onSnapshot(routesRef, (snap) => {
            const routes = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            routes.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
            setSavedRoutes(routes);
        });
        return () => unsubscribe();
    }, [currentUser]);

    const handleDeleteRoute = async (routeId, routeName) => {
        if (!window.confirm(`「${routeName}」を削除しますか？`)) return;
        try {
            await deleteDoc(doc(db, 'users', currentUser.uid, 'routes', routeId));
            toast.success('ルートを削除しました');
        } catch (e) {
            console.error(e);
            toast.error('削除に失敗しました');
        }
    };

    const openNewRoute = () => {
        if (currentUser?.isAnonymous) {
            toast.error('この機能はGoogle登録ユーザー限定です🐾');
            return;
        }
        setRouteEditorState({ open: true, editingRoute: null });
    };

    const openEditRoute = (route) => {
        setRouteEditorState({ open: true, editingRoute: route });
    };

    const closeRouteEditor = () => {
        setRouteEditorState({ open: false, editingRoute: null });
    };

    if (!currentUser) {
        return (
            <div className="profile-page" style={{ textAlign: 'center', padding: 'var(--spacing-lg) var(--spacing-md)' }}>
                <h2 style={{ marginBottom: 'var(--spacing-md)' }}>みまもりWANへようこそ！🐾</h2>
                <div className="card" style={{ padding: 'var(--spacing-lg) var(--spacing-md)' }}>
                    <div style={{ fontSize: '3rem', marginBottom: 'var(--spacing-md)' }}>🐕</div>
                    <p style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '16px' }}>
                        ご近所のペットと協力して、安心な街づくりに参加しませんか？
                    </p>
                    <p style={{ margin: '0 0 var(--spacing-xl) 0', color: 'var(--color-text-sub)', lineHeight: '1.6', fontSize: '0.9rem' }}>
                        アカウントを連携すると、プロフィールの登録や全ての機能がずっと無料でご利用いただけます。
                    </p>

                    {isLoggingIn ? (
                        <div style={{ padding: '20px', color: 'var(--color-primary)', fontWeight: 'bold' }}>ログイン処理中...🐾</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <button
                                onClick={async () => {
                                    setIsLoggingIn(true);
                                    try {
                                        await loginWithGoogle();
                                    } catch (error) {
                                        console.error('Login error:', error);
                                        alert('Googleログインに失敗しました。');
                                        setIsLoggingIn(false);
                                    }
                                }}
                                className="btn"
                                style={{
                                    width: '100%', padding: '16px', fontSize: '1.1rem', backgroundColor: 'white', color: '#333',
                                    border: '1px solid #ddd', boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 'bold', borderRadius: '12px'
                                }}
                            >
                                <svg width="20" height="20" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path></svg>
                                Googleでログインして始める
                            </button>

                            <button
                                onClick={async () => {
                                    setIsLoggingIn(true);
                                    try {
                                        await loginAnonymously();
                                    } catch (error) {
                                        console.error('Anonymous login error:', error);
                                        alert('お試しログインに失敗しました。');
                                        setIsLoggingIn(false);
                                    }
                                }}
                                className="btn btn-secondary"
                                style={{ width: '100%', padding: '14px', fontSize: '0.95rem', borderRadius: '12px' }}
                            >
                                🐶 見習い隊員（仮ユーザー）として使ってみる
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    const handleChange = (e) => {
        const { name, value } = e.target;
        setProfile(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (currentUser) {
            try {
                // Save to Firestore under the 'users' collection
                const userRef = doc(db, 'users', currentUser.uid);
                // Use setDoc with merge to preserve other fields like memberNumber
                await setDoc(userRef, { profile }, { merge: true });
                // Also update local storage for offline fallback
                localStorage.setItem(`pet_profile_${currentUser.uid}`, JSON.stringify(profile));
                setIsEditing(false);
            } catch (error) {
                console.error("Error saving profile to Firestore:", error);
                alert("プロフィールの保存に失敗しました。");
            }
        }
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file || !currentUser) return;

        setIsUploading(true);
        try {
            const compressedDataUrl = await compressImage(file);

            // Extract extension
            const mimeTypeMatch = compressedDataUrl.match(/data:(.*?);/);
            const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/jpeg';
            const ext = mimeType === 'image/webp' ? 'webp' : 'jpg';

            const filename = `user_photos/${currentUser.uid}_${Date.now()}.${ext}`;
            const storageRef = ref(storage, filename);

            await uploadString(storageRef, compressedDataUrl, 'data_url');
            const downloadUrl = await getDownloadURL(storageRef);

            setProfile(prev => ({ ...prev, photoUrl: downloadUrl }));
        } catch (error) {
            console.error("Failed to upload image:", error);
            alert("画像のアップロードに失敗しました。");
        } finally {
            setIsUploading(false);
        }
    };

    const calculateAge = (birthdate) => {
        if (!birthdate) return '不明';
        const birth = new Date(birthdate);
        const now = new Date();
        let years = now.getFullYear() - birth.getFullYear();
        let months = now.getMonth() - birth.getMonth();
        if (months < 0) {
            years--;
            months += 12;
        }
        return `${years}歳${months}ヶ月`;
    };

    const handleShareOmamoriCard = async () => {
        if (!emergencyCardRef.current) return;
        setIsSharing(true);
        try {
            const canvas = await html2canvas(emergencyCardRef.current, {
                scale: 2, // High resolution
                useCORS: true, // Allow cross-origin images (e.g., photoUrl from Firebase Storage)
                allowTaint: true, // Specific fix for Chrome/Safari with external images
                backgroundColor: '#ffffff'
            });

            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));

            // Generate a filename
            const filename = `omamori_card_${profile.name || 'pet'}.png`;
            const file = new File([blob], filename, { type: 'image/png' });

            const shareData = {
                files: [file],
                title: 'お守りカード',
                text: `${profile.name}のお守りカードです🐾 #ペット防災 #みまもりWAN`
            };

            const canShare = navigator.canShare && navigator.canShare(shareData);

            if (navigator.share && canShare) {
                try {
                    // Use Web Share API
                    await navigator.share(shareData);
                } catch (shareError) {
                    console.error('Error during navigator.share:', shareError);
                    // Fallback to download if user didn't just cancel the share dialog
                    if (shareError.name !== 'AbortError') {
                        downloadImage(canvas.toDataURL('image/png'), filename);
                        toast.success('ご利用のブラウザ（LINE等）の仕様により、端末に画像を直接ダウンロードしました📥 写真アプリからご確認ください。', { duration: 5000 });
                    }
                }
            } else {
                // Fallback: Download the image directly if Share API not supported
                downloadImage(canvas.toDataURL('image/png'), filename);
                toast.success('ご利用のブラウザ（LINE等）の仕様により、端末に画像を直接ダウンロードしました📥 写真アプリからご確認ください。', { duration: 5000 });
            }
        } catch (error) {
            console.error('Error sharing omamori card:', error);
            toast.error('お守りカードの保存・シェアに失敗しました。');
        } finally {
            setIsSharing(false);
        }
    };

    const downloadImage = (dataUrl, filename) => {
        const link = document.createElement('a');
        link.download = filename;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (isEditing) {
        return (
            <div className="profile-page">
                <h2>プロフィール編集</h2>
                <form onSubmit={handleSave}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 'var(--spacing-lg)' }}>
                        <div style={{ position: 'relative', width: '120px', height: '120px', borderRadius: '50%', backgroundColor: '#f0f0f0', display: 'flex', justifyContent: 'center', alignItems: 'center', border: '2px solid #ddd', overflow: 'hidden' }}>
                            {profile.photoUrl ? (
                                <img src={profile.photoUrl} alt="ペットの写真" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <span style={{ fontSize: '3rem' }}>🐾</span>
                            )}
                            {isUploading && <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '0.8rem', fontWeight: 'bold' }}>処理中...</div>}
                        </div>
                        <label className="btn btn-secondary" style={{ marginTop: 'var(--spacing-sm)', cursor: 'pointer', fontSize: '0.9rem', padding: '6px 12px' }}>
                            写真を選択
                            <input type="file" accept="image/*,.heic,.heif" onChange={handleImageUpload} style={{ display: 'none' }} disabled={isUploading} />
                        </label>
                    </div>

                    <div style={{ marginBottom: 'var(--spacing-md)' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>ペットの名前</label>
                        <input
                            type="text"
                            name="name"
                            value={profile.name}
                            onChange={handleChange}
                            className="input-field"
                            required
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>種類</label>
                            <select name="species" value={profile.species} onChange={handleChange} className="input-field">
                                <option value="dog">犬</option>
                                <option value="cat">猫</option>
                                <option value="other">その他</option>
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>性別</label>
                            <select name="gender" value={profile.gender} onChange={handleChange} className="input-field">
                                <option value="male">オス</option>
                                <option value="female">メス</option>
                            </select>
                        </div>
                    </div>

                    {profile.species === 'dog' && (
                        <div style={{ marginBottom: 'var(--spacing-md)' }}>
                            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>サイズ</label>
                            <select name="size" value={profile.size} onChange={handleChange} className="input-field">
                                <option value="small">小型犬</option>
                                <option value="medium">中型犬</option>
                                <option value="large">大型犬</option>
                            </select>
                        </div>
                    )}

                    <div style={{ marginBottom: 'var(--spacing-md)' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>品種</label>
                        <input type="text" name="breed" value={profile.breed} onChange={handleChange} className="input-field" />
                    </div>

                    <div style={{ marginBottom: 'var(--spacing-md)' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>生年月日</label>
                        <input
                            type="date"
                            name="birthdate"
                            value={profile.birthdate}
                            onChange={handleChange}
                            className="input-field"
                        />
                    </div>

                    <div style={{ marginBottom: 'var(--spacing-md)' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>飼い主名</label>
                        <input type="text" name="owner" value={profile.owner} onChange={handleChange} className="input-field" />
                    </div>

                    <div style={{ marginBottom: 'var(--spacing-md)' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>緊急連絡先 (電話)</label>
                        <input type="tel" name="phone" value={profile.phone} onChange={handleChange} className="input-field" />
                    </div>

                    <div style={{ marginBottom: 'var(--spacing-md)' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>かかりつけ医</label>
                        <input type="text" name="vet" value={profile.vet} onChange={handleChange} className="input-field" />
                    </div>

                    <div style={{ marginBottom: 'var(--spacing-md)' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>特記事項 (持病・薬など)</label>
                        <textarea name="notes" value={profile.notes} onChange={handleChange} className="input-field" rows="3"></textarea>
                    </div>

                    <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>保存する</button>
                    <button type="button" onClick={logout} className="btn" style={{ width: '100%', marginTop: 'var(--spacing-md)', backgroundColor: '#F3F4F6', color: '#4B5563', border: 'none' }}>
                        ログアウト
                    </button>
                </form>
            </div>
        );
    }

    return (
        <>
        <div className="profile-page">
            {currentUser?.isAnonymous && (
                <div style={{
                    backgroundColor: '#FEF2F2',
                    border: '1px solid #FCA5A5',
                    borderRadius: '8px',
                    padding: '16px',
                    marginBottom: 'var(--spacing-md)',
                    textAlign: 'center'
                }}>
                    <div style={{ color: '#DC2626', fontWeight: 'bold', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <span>⚠️</span> 現在は見習い隊員（お試し）です
                    </div>
                    <p style={{ fontSize: '0.85rem', color: '#B91C1C', marginBottom: '12px', marginTop: 0 }}>
                        ブラウザを変えるとデータが消えるため、Googleでの本登録をおすすめします。<br />
                        お試しモードでは1日3回までの投稿制限があります。
                    </p>
                    <button
                        onClick={async () => {
                            try {
                                await linkWithGoogle();
                            } catch (error) {
                                console.error('Auth error:', error);
                                alert('Google連携に失敗しました。');
                            }
                        }}
                        className="btn"
                        style={{
                            width: '100%', padding: '8px', fontSize: '0.9rem', backgroundColor: 'white', color: '#333',
                            border: '1px solid #ddd', boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 'bold'
                        }}
                    >
                        <svg width="16" height="16" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path></svg>
                        データを保存して全ての機能を使う
                    </button>
                </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
                <h2 style={{ margin: 0 }}>マイ・ペット手帳</h2>
                <button
                    onClick={async () => {
                        if (currentUser?.isAnonymous) {
                            if (window.confirm("愛犬のプロフィールやお守りカードを作成するには、Googleアカウントでの本登録が必要です🐾\n\nGoogleで連携して本登録に進みますか？")) {
                                try {
                                    await linkWithGoogle();
                                } catch (error) {
                                    console.error('Auth error:', error);
                                    alert('Google連携に失敗しました。');
                                }
                            }
                        } else {
                            setIsEditing(true);
                        }
                    }}
                    className="btn btn-secondary"
                    style={{
                        padding: '6px 16px',
                        fontSize: '0.9rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        borderRadius: '20px'
                    }}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                    編集
                </button>
            </div>
            {/* Photo Section */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--spacing-lg)' }}>
                <div style={{ width: '150px', height: '150px', borderRadius: '50%', backgroundColor: '#f0f0f0', display: 'flex', justifyContent: 'center', alignItems: 'center', border: '4px solid white', boxShadow: '0 4px 10px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                    {profile.photoUrl ? (
                        <img src={profile.photoUrl} alt="ペットの写真" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                        <span style={{ fontSize: '4rem' }}>🐾</span>
                    )}
                </div>
            </div>

            {/* ご意見・不具合報告バナー (Top Placement) */}
            <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                <a
                    href="https://docs.google.com/forms/d/e/1FAIpQLSdKR9YyFTrH7SoPCxs7EihjomraeT_HRhH8D_Frs6NN3HoOgw/viewform?usp=publish-editor"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="card"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '16px',
                        margin: 0,
                        backgroundColor: '#FFFBEB',
                        border: '2px solid #FCD34D',
                        borderRadius: '16px',
                        textDecoration: 'none',
                        color: '#B45309',
                        boxShadow: '0 4px 6px -1px rgba(251, 191, 36, 0.2), 0 2px 4px -1px rgba(251, 191, 36, 0.1)'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '1.8rem', flexShrink: 0 }}>📢</span>
                        <div>
                            <div style={{ fontWeight: 'bold', fontSize: '1.05rem', marginBottom: '4px' }}>不具合・ご意見の報告</div>
                            <div style={{ fontSize: '0.8rem', color: '#D97706', lineHeight: 1.3 }}>
                                より良いアプリにするため、<br />お気づきの点をお教えください🐾
                            </div>
                        </div>
                    </div>
                    <div style={{ color: '#F59E0B', flexShrink: 0 }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 18l6-6-6-6" />
                        </svg>
                    </div>
                </a>
            </div>

            <div className="card emergency-card" style={{ borderLeft: '4px solid var(--color-danger)', backgroundColor: '#ffffff' }} ref={emergencyCardRef}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
                    <h3 style={{ margin: 0 }}>お守りカード</h3>
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-danger)', fontWeight: 'bold' }}>OMAMORI INFO</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ color: 'var(--color-text-sub)', fontSize: '0.9rem' }}>名前</div>
                    <div style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>{profile.name}</div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ color: 'var(--color-text-sub)', fontSize: '0.9rem' }}>種類/品種</div>
                    <div>
                        {profile.species === 'dog' ? '犬' : profile.species === 'cat' ? '猫' : 'その他'}
                        {profile.species === 'dog' && ` (${profile.size === 'small' ? '小型' : profile.size === 'medium' ? '中型' : '大型'})`}
                        / {profile.breed}
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ color: 'var(--color-text-sub)', fontSize: '0.9rem' }}>性別/年齢</div>
                    <div>
                        {profile.gender === 'male' ? 'オス' : 'メス'} / {calculateAge(profile.birthdate)}
                        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-sub)', marginLeft: '8px' }}>({profile.birthdate})</span>
                    </div>
                </div>

                <hr style={{ margin: 'var(--spacing-md) 0', border: 'none', borderTop: '1px solid var(--color-border)' }} />

                <div style={{ marginBottom: '8px' }}>
                    <div style={{ color: 'var(--color-text-sub)', fontSize: '0.9rem' }}>飼い主</div>
                    <div style={{ fontWeight: 'bold' }}>{profile.owner}</div>
                </div>

                <div style={{ marginBottom: '8px' }}>
                    <div style={{ color: 'var(--color-text-sub)', fontSize: '0.9rem' }}>緊急連絡先</div>
                    <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{profile.phone}</div>
                </div>

                {profile.vet && (
                    <div style={{ marginBottom: '8px' }}>
                        <div style={{ color: 'var(--color-text-sub)', fontSize: '0.9rem' }}>かかりつけ医</div>
                        <div>{profile.vet}</div>
                    </div>
                )}

                {profile.notes && (
                    <div style={{ marginTop: 'var(--spacing-md)', padding: '8px', backgroundColor: '#FEF2F2', borderRadius: '4px', fontSize: '0.9rem' }}>
                        <strong>特記事項:</strong><br />
                        {profile.notes}
                    </div>
                )}
            </div>

            {/* 🗺️ MYお散歩ルートセクション */}
            <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '1rem', color: '#15803D' }}>
                        🗺️ MYお散歩ルート
                    </div>
                    <button
                        onClick={openNewRoute}
                        style={{
                            padding: '7px 14px', borderRadius: '20px', border: 'none',
                            backgroundColor: '#22C55E', color: 'white',
                            fontWeight: 'bold', fontSize: '0.82rem',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                            boxShadow: '0 2px 4px rgba(34,197,94,0.3)',
                        }}
                    >
                        <span style={{ fontSize: '1rem' }}>+</span> 新しいコースを登録
                    </button>
                </div>

                {currentUser?.isAnonymous ? (
                    <div style={{ padding: '12px', backgroundColor: '#F3F4F6', borderRadius: '10px', fontSize: '0.82rem', color: '#6B7280', textAlign: 'center' }}>
                        Google登録ユーザー限定の機能です🐾
                    </div>
                ) : savedRoutes.length === 0 ? (
                    <div style={{ padding: '16px', backgroundColor: '#F0FDF4', borderRadius: '10px', border: '1.5px dashed #86EFAC', textAlign: 'center' }}>
                        <div style={{ fontSize: '1.8rem', marginBottom: '6px' }}>🗺️</div>
                        <div style={{ fontSize: '0.85rem', color: '#4B5563' }}>まだルートが登録されていません</div>
                        <div style={{ fontSize: '0.75rem', color: '#9CA3AF', marginTop: '4px' }}>「＋ 新しいコースを登録」から安心な散歩ルートを登録しよう</div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {savedRoutes.map((route) => (
                            <div
                                key={route.id}
                                style={{
                                    backgroundColor: 'white', border: '1px solid #D1FAE5',
                                    borderLeft: '4px solid #22C55E', borderRadius: '10px',
                                    padding: '12px 14px', display: 'flex', alignItems: 'center',
                                    justifyContent: 'space-between', gap: '8px',
                                }}
                            >
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 'bold', fontSize: '0.95rem', color: '#15803D', marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        📍 {route.name}
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: '#6B7280' }}>
                                        {route.totalDistanceM ? `約${(route.totalDistanceM / 1000).toFixed(1)}km` : ''}
                                        {route.publicPath?.length === 0 && <span style={{ color: '#F59E0B', marginLeft: '6px' }}>⚠️公開パスなし</span>}
                                        {route.updatedAt && <span style={{ marginLeft: '6px' }}>・ {new Date(route.updatedAt).toLocaleDateString('ja-JP')}</span>}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                                    <button
                                        onClick={() => openEditRoute(route)}
                                        style={{
                                            padding: '6px 10px', borderRadius: '8px', border: '1px solid #D1D5DB',
                                            backgroundColor: 'white', color: '#374151',
                                            fontSize: '0.8rem', cursor: 'pointer', fontWeight: 'bold',
                                        }}
                                    >✏️ 編集</button>
                                    <button
                                        onClick={() => handleDeleteRoute(route.id, route.name)}
                                        style={{
                                            padding: '6px 10px', borderRadius: '8px', border: '1px solid #FECACA',
                                            backgroundColor: '#FEF2F2', color: '#DC2626',
                                            fontSize: '0.8rem', cursor: 'pointer', fontWeight: 'bold',
                                        }}
                                    >🗑 削除</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* シェアボタン */}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '-8px', marginBottom: 'var(--spacing-lg)' }}>
                <button
                    onClick={handleShareOmamoriCard}
                    disabled={isSharing}
                    className="btn"
                    style={{
                        padding: '12px 24px',
                        fontSize: '1rem',
                        backgroundColor: '#10B981', // 視認性の高い緑色
                        color: 'white',
                        border: 'none',
                        borderRadius: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 6px rgba(16, 185, 129, 0.2)',
                        fontWeight: 'bold',
                        opacity: isSharing ? 0.7 : 1,
                        cursor: isSharing ? 'not-allowed' : 'pointer',
                        width: '100%',
                        justifyContent: 'center'
                    }}
                >
                    {isSharing ? '処理中...' : '📤 このカードを保存・シェア'}
                </button>
            </div>

            {/* みまもり活動実績 */}
            <div className="card" style={{ marginTop: 'var(--spacing-md)', borderLeft: '4px solid var(--color-primary)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
                    <h3 style={{ margin: 0 }}>みまもり活動実績</h3>
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-primary)', fontWeight: 'bold' }}>ACTIVITY</span>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ flex: 1, backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                        <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>🐾</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-sub)' }}>発見したスポット</div>
                        <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--color-primary)' }}>{userPosts.length} <span style={{ fontSize: '0.9rem', color: 'var(--color-text-base)' }}>件</span></div>
                    </div>

                    <div style={{ flex: 1, backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                        <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>💖</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-sub)' }}>もらったありがとう</div>
                        <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: '#DB2777' }}>{thanksCount} <span style={{ fontSize: '0.9rem', color: 'var(--color-text-base)' }}>件</span></div>
                    </div>
                </div>
            </div>

            {/* わたしの投稿履歴 */}
            {userPosts.length > 0 && (
                <div style={{ marginTop: 'var(--spacing-lg)' }}>
                    <h3 style={{ marginBottom: 'var(--spacing-md)' }}>最近の投稿</h3>
                    <div style={{ display: 'grid', gap: 'var(--spacing-sm)' }}>
                        {userPosts.slice(0, 5).map(post => {
                            return (
                                <div
                                    key={post.id}
                                    className="card"
                                    style={{
                                        padding: 'var(--spacing-sm) var(--spacing-md)',
                                        margin: 0,
                                        borderLeft: post.type === 'danger' ? '4px solid #F59E0B' : (post.type === 'shelter' ? '4px solid #8B5CF6' : '4px solid #10B981')
                                    }}
                                >
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div style={{ fontWeight: 'bold', color: post.resolved ? '#9CA3AF' : 'inherit', textDecoration: post.resolved ? 'line-through' : 'none', flex: 1, paddingRight: '8px' }}>
                                                {post.type === 'danger' ? '⚠️' : (post.type === 'shelter' ? '🎒' : '🐾')} {post.title}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-sub)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                                {post.date}
                                            </div>
                                        </div>

                                        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-sub)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                            {post.note || '詳細なし'}
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-sub)' }}>
                                                {post.imageUrl && <span style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>📷 写真あり</span>}
                                            </div>
                                            <div style={{ fontSize: '0.85rem', color: '#DB2777', fontWeight: 'bold' }}>
                                                💖 {post.thanks?.length || 0}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Logout is now directly below user posts */}
            <button onClick={logout} className="btn" style={{ width: '100%', marginTop: 'var(--spacing-md)', backgroundColor: '#F3F4F6', color: '#4B5563', border: 'none' }}>
                ログアウト
            </button>
        </div >

        {/* MYルート登録・編集モーダル */}
        {routeEditorState.open && (
            <RouteEditor
                currentUser={currentUser}
                onClose={closeRouteEditor}
                editingRoute={routeEditorState.editingRoute}
            />
        )}
        </>
    );
};

export default Profile;
