export function summarizeProfileActivity(posts, cleanups) {
    const postRows = posts.map(post => ({
        key: `post-${post.id}`,
        kind: 'post',
        type: post.type,
        title: post.title,
        note: post.note,
        hasPhoto: Boolean(post.imageUrl),
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
