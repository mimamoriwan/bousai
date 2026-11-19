const HOUR_MS = 60 * 60 * 1000;

export function isPostArchived(post, filter, now = Date.now()) {
    if (!post.timestamp) return false;

    const displayHours = filter === 'plant' && post.type === 'plant' ? 14 * 24 : 48;
    return now - post.timestamp > displayHours * HOUR_MS;
}
