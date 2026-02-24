import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, signInAnonymously, linkWithPopup } from 'firebase/auth';
import { doc, getDoc, runTransaction } from 'firebase/firestore';
import { auth, provider, db } from '../firebase';

const AuthContext = createContext();

export const useAuth = () => {
    return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [memberNumber, setMemberNumber] = useState(null);
    const [loading, setLoading] = useState(true);
    const hasInitialized = useRef(false);

    const loginWithGoogle = async () => {
        try {
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error('Error signing in with Google:', error);
            throw error;
        }
    };

    const linkWithGoogle = async () => {
        try {
            if (currentUser && currentUser.isAnonymous) {
                await linkWithPopup(currentUser, provider);
            }
        } catch (error) {
            console.error('Error linking with Google:', error);
            throw error;
        }
    };

    const logout = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error('Error signing out:', error);
            throw error;
        }
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setCurrentUser(user);

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
                // If no user is logged in, automatically sign in anonymously
                if (!hasInitialized.current) {
                    hasInitialized.current = true;
                    try {
                        await signInAnonymously(auth);
                        // The onAuthStateChanged listener will fire again with the new anon user
                    } catch (error) {
                        console.error('Anonymous auth failed:', error);
                        setLoading(false);
                    }
                } else {
                    setCurrentUser(null);
                    setMemberNumber(null);
                    setLoading(false);
                }
            }
        });

        return unsubscribe;
    }, []);

    const value = {
        currentUser,
        memberNumber,
        loginWithGoogle,
        linkWithGoogle,
        logout
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
