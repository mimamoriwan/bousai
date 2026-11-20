import { getPinPresentation, isSeasonalMemoActive, pinMatchesTag } from './postFreshness.js';

function matchesCategory(post, filter) {
    if (filter === 'all') return true;
    if (filter === 'walk') return post.type === 'useful' || post.type?.startsWith('walk');
    if (filter === 'resolved') return post.resolved === true;
    return post.type === filter;
}

export function selectVisibleMapPins(posts, { activeMapLayer, uid, userHash, filter, recordView, tags, now }) {
    const personal = activeMapLayer === 'myMap';
    const pins = [];
    for (const post of posts) {
        if (!matchesCategory(post, filter)) continue;
        if (post.type === 'shelter' && post.pinKind !== 'memo' && filter === 'all' && (personal || !recordView)) continue;
        const presentation = getPinPresentation(post, now, filter);
        if (personal) {
            if (!uid) continue;
            if (post.visibility === 'private' && post.ownerUid !== uid) continue;
            const owned = post.ownerUid ? post.ownerUid === uid : Boolean(userHash && post.userHash === userHash);
            const saved = post.visibility !== 'private' && userHash && post.savedBy?.includes(userHash);
            if (!owned && !saved) continue;
        } else {
            if (post.visibility === 'private') continue;
            const phase = presentation.phase;
            if (recordView) {
                if (!['archived', 'memo', 'resolved'].includes(phase)) continue;
                if (!tags.every((tag) => pinMatchesTag(post, tag))) continue;
            } else {
                if (phase === 'archived' || phase === 'resolved') continue;
                if (phase === 'memo' && !isSeasonalMemoActive(post, now)) continue;
            }
        }
        pins.push({ post, presentation });
    }
    return pins.sort((a, b) => (b.presentation.time ?? 0) - (a.presentation.time ?? 0));
}
