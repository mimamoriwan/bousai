import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { onAuthStateChanged, signInWithRedirect, signOut, signInAnonymously, linkWithRedirect, getRedirectResult, signInWithCredential, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, runTransaction } from 'firebase/firestore';
import { auth, provider, db } from '../firebase';
import { hashUid } from '../utils/hashUtils';

const AuthContext = createContext();

export const useAuth = () => {
    return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [currentUserHash, setCurrentUserHash] = useState(null);
    const [memberNumber, setMemberNumber] = useState(null);
    const [loading, setLoading] = useState(true);
    const hasInitialized = useRef(false);

    const loginWithGoogle = async () => {
        try {
            await signInWithRedirect(auth, provider);
        } catch (error) {
            console.error('Error signing in with Google redirect:', error);
            throw error;
        }
    };

    const loginAnonymously = async () => {
        try {
            await signInAnonymously(auth);
        } catch (error) {
            console.error('Error signing in anonymously:', error);
            throw error;
        }
    };

    const linkWithGoogle = async () => {
        try {
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
                }
                // リダイレクト結果処理完了 — loading は onAuthStateChanged に委ねる
            }).catch(async (error) => {
                console.error('Redirect auth error:', error);
                if (error.code === 'auth/credential-already-in-use') {
                    // This means the Google account has already been used to create an account
                    console.log('Account already exists. Logging in instead of linking.');
                    try {
                        const credential = GoogleAuthProvider.credentialFromError(error);
                        await signInWithCredential(auth, credential);
                    } catch (signInError) {
                        console.error('Fallback sign-in failed', signInError);
                        // フォールバックも失敗した場合はフリーズしないようloading解除
                        setLoading(false);
                    }
                } else {
                    // その他のリダイレクトエラー（ポップアップブロック等）でもloading解除
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
                // User is fully logged out (not even anonymous)
                setCurrentUser(null);
                setCurrentUserHash(null);
                setMemberNumber(null);
                setLoading(false);
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
        logout
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

