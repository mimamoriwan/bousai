import { doc, getDocFromServer, getFirestore, increment, runTransaction, serverTimestamp } from 'firebase/firestore';
import { canCleanPin, canReconfirmPin } from '../utils/postFreshness.js';

// Rules can reject a stale write before the SDK gets a version conflict to retry.
// Read the committed state before treating the other person's action as a duplicate.
async function commitActivity(db, stateRef, alreadyDone, change) {
    try {
        return await runTransaction(db, change);
    } catch (error) {
        if (error.code !== 'permission-denied') throw error;
        const state = await getDocFromServer(stateRef);
        if (alreadyDone(state)) return false;
        throw error;
    }
}

export async function reconfirmPin(pinId, uid, db = getFirestore()) {
    if (!uid) return false;
    const pin = doc(db, 'map_pins', pinId);
    return commitActivity(db, pin, state => !!state.data()?.confirmedAt, async transaction => {
        const snapshot = await transaction.get(pin);
        if (!snapshot.exists() || !canReconfirmPin(snapshot.data())) return false;

        transaction.update(pin, { confirmedAt: serverTimestamp() });
        return true;
    });
}

export async function cleanPin(pinId, uid, db = getFirestore()) {
    if (!uid) return false;
    const pin = doc(db, 'map_pins', pinId);
    const cleanup = doc(db, 'pinCleanups', pinId);
    return commitActivity(db, pin, state => !!state.data()?.cleanedAt, async transaction => {
        const snapshot = await transaction.get(pin);
        if (!snapshot.exists() || !canCleanPin(snapshot.data())) return false;

        const attribution = { cleanerUid: uid, cleanedAt: serverTimestamp() };
        transaction.update(pin, { ...attribution, resolved: true });
        transaction.set(cleanup, { ...attribution, title: snapshot.data().title, thanksCount: 0 });
        return true;
    });
}

export async function thankCleanup(pinId, uid, db = getFirestore()) {
    if (!uid) return false;
    const cleanup = doc(db, 'pinCleanups', pinId);
    const receipt = doc(cleanup, 'thanks', uid);
    return commitActivity(db, receipt, state => state.exists(), async transaction => {
        const [entry, previousThanks] = await Promise.all([
            transaction.get(cleanup),
            transaction.get(receipt),
        ]);
        if (!entry.exists() || entry.data().cleanerUid === uid || previousThanks.exists()) return false;

        transaction.set(receipt, { createdAt: serverTimestamp() });
        transaction.update(cleanup, { thanksCount: increment(1) });
        return true;
    });
}
