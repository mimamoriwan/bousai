import { ownsPin } from './pinIdentity.js';

// 初期版の公開投稿は隊員番号だけで活動に集計する。編集権限には使わない。
export function collectActivityPosts(ownedPosts, archivedPosts, uid, memberNumber) {
    const rows = new Map();
    if (Number.isInteger(memberNumber) && memberNumber > 0) {
        for (const post of archivedPosts) {
            if (post.visibility === 'public' && post.legacyActivity === true &&
                post.memberNumber === memberNumber && post.uid == null && post.ownerUid == null) {
                rows.set(post.id, post);
            }
        }
    }
    for (const post of ownedPosts) {
        if (ownsPin(post, uid)) rows.set(post.id, post);
    }
    return [...rows.values()];
}

export function summarizeProfileActivity(posts, cleanups) {
    const postRows = posts.map(post => ({
        key: `post-${post.id}`,
        kind: 'post',
        type: post.type,
        title: post.title,
        note: post.note,
        hasPhoto: Boolean(post.imageUrl || post.imagePath),
        resolved: Boolean(post.resolved),
        date: post.date,
        time: post.timestamp ?? 0,
        thanks: Array.isArray(post.thanks) ? post.thanks.length : 0,
    }));
    const cleanupRows = cleanups.map(cleanup => ({
        key: `cleanup-${cleanup.id}`,
        kind: 'cleanup',
        title: cleanup.title,
        time: cleanup.cleanedAt?.toMillis() ?? 0,
        thanks: cleanup.thanksCount ?? 0,
    }));

    return {
        postThanks: postRows.reduce((sum, row) => sum + row.thanks, 0),
        cleanupThanks: cleanupRows.reduce((sum, row) => sum + row.thanks, 0),
        recent: [...postRows, ...cleanupRows].sort((a, b) => b.time - a.time).slice(0, 5),
    };
}
