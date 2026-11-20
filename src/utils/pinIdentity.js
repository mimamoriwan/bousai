// March's live client stored uid; the newer ownerUid takes precedence when present.
export function ownsPin(pin, uid) {
    return Boolean(uid && (Object.hasOwn(pin, 'ownerUid') ? pin.ownerUid : pin.uid) === uid);
}

export function ownReactionIds(reactions, uid, hash) {
    if (!uid || !Array.isArray(reactions)) return [];
    return [...new Set([uid, hash].filter(id => id && reactions.includes(id)))];
}
