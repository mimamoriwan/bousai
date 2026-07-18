import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithRedirect, signOut, signInAnonymously, linkWithRedirect, getRedirectResult } from 'firebase/auth';
import { doc, getDoc, runTransaction } from 'firebase/firestore';
import { auth, provider, db } from '../firebase';
import { hashUid } from '../utils/hashUtils';

const AuthContext = createContext();
let anonymousSignInPromise = null;

const ensureAnonymousSession = () => {
    if (!anonymousSignInPromise) {
        anonymousSignInPromise = signInAnonymously(auth)
            .finally(() => {
                anonymousSignInPromise = null;
            });
    }
    return anonymousSignInPromise;
};

export const useAuth = () => {
    return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [currentUserHash, setCurrentUserHash] = useState(null);
    const [memberNumber, setMemberNumber] = useState(null);
    const [loading, setLoading] = useState(true);
    const [authNotice, setAuthNotice] = useState(null);

    const clearAuthNotice = () => setAuthNotice(null);

    const loginWithGoogle = async () => {
        try {
            clearAuthNotice();
            await signInWithRedirect(auth, provider);
        } catch (error) {
            console.error('Error signing in with Google redirect:', error);
            throw error;
        }
    };

    const loginAnonymously = async () => {
        try {
            await ensureAnonymousSession();
        } catch (error) {
            console.error('Error signing in anonymously:', error);
            throw error;
        }
    };

    const linkWithGoogle = async () => {
        try {
            clearAuthNotice();
            if (currentUser && currentUser.isAnonymous) {
                await linkWithRedirect(currentUser, provider);
            }
        } catch (error) {
            console.error('Error linking with Google redirect:', error);
            throw error;
        }
    };

    const logout = async () => {
        try {
            // React状態を先にクリアして次回ログインフローに干渉しないようにする
            setCurrentUser(null);
            setMemberNumber(null);
            clearAuthNotice();
            await signOut(auth);
        } catch (error) {
            console.error('Error signing out:', error);
            throw error;
        }
    };

    useEffect(() => {
        // Handle redirect results for mobile and PWA flows
        getRedirectResult(auth)
            .then(async (result) => {
                if (result) {
                    console.log('Successfully completed redirect flow:', result);
                    clearAuthNotice();
                }
                // リダイレクト結果処理完了 — loading は onAuthStateChanged に委ねる
            }).catch(async (error) => {
                console.error('Redirect auth error:', error);
                if (error.code === 'auth/credential-already-in-use') {
                    // 自動で既存アカウントへ切り替えると、匿名UIDに紐づく記録が
                    // 見えなくなるため、現在のゲストセッションを保護して案内する。
                    console.warn('Google account is already registered; preserving the guest session.');
                    setAuthNotice({
                        type: 'existing-account',
                        message: 'このGoogleアカウントはすでに登録済みです。ゲスト記録を保護するため、自動ログインは行いませんでした。現在の記録はこの端末に残っています。既存アカウントとの統合機能は今後対応します。',
                    });
                    setLoading(false);
                } else {
                    // その他のリダイレクトエラー（ポップアップブロック等）でもloading解除
                    setAuthNotice({
                        type: 'link-error',
                        message: 'Google連携を完了できませんでした。ゲスト記録はそのまま残っています。時間をおいて、もう一度お試しください。',
                    });
                    setLoading(false);
                }
            });

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setCurrentUser(user);
                hashUid(user.uid).then(setCurrentUserHash);

                if (!user.isAnonymous) {
                    try {
                        const userRef = doc(db, 'users', user.uid);
                        const userSnap = await getDoc(userRef);

                        if (userSnap.exists() && userSnap.data().memberNumber) {
                            setMemberNumber(userSnap.data().memberNumber);
                        } else {
                            // Assign a new member number via transaction
                            const counterRef = doc(db, 'metadata', 'counters');
                            const newNumber = await runTransaction(db, async (transaction) => {
                                const counterSnap = await transaction.get(counterRef);
                                let currentCount = 0;
                                if (counterSnap.exists() && counterSnap.data().memberCount) {
                                    currentCount = counterSnap.data().memberCount;
                                }
                                const nextCount = currentCount + 1;

                                transaction.set(counterRef, { memberCount: nextCount }, { merge: true });
                                transaction.set(userRef, { memberNumber: nextCount }, { merge: true });
                                return nextCount;
                            });
                            setMemberNumber(newNumber);
                        }
                    } catch (error) {
                        console.error('Failed to fetch/assign member number:', error);
                        setMemberNumber(null);
                    }
                } else {
                    setMemberNumber(null);
                }

                setLoading(false);
            } else {
                // 初回アクセスやログアウト後は、登録を求めずゲストとして開始する
                setCurrentUser(null);
                setCurrentUserHash(null);
                setMemberNumber(null);
                try {
                    await ensureAnonymousSession();
                } catch (error) {
                    console.error('Failed to start guest session:', error);
                    // 自動開始に失敗した場合だけ、手動開始画面を表示する
                    setLoading(false);
                }
            }
        });

        return unsubscribe;
    }, []);

    const value = {
        currentUser,
        currentUserHash,
        memberNumber,
        loginWithGoogle,
        loginAnonymously,
        linkWithGoogle,
        logout,
        authNotice,
        clearAuthNotice,
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
