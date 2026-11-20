const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const tokyoMonth = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Tokyo', month: 'numeric' });

export const PIN_TAGS = ['地域', '春', '夏', '秋', '冬', '雨の日'];

function toMillis(value) {
    const millis = typeof value?.toMillis === 'function' ? value.toMillis() : value;
    return Number.isFinite(millis) && millis > 0 ? millis : null;
}

function postedAt(post) {
    return toMillis(post.createdAt) ?? toMillis(post.timestamp);
}

function archiveWindow(post, filter) {
    const legacyPlant = !post.pinKind && post.type === 'plant' && filter === 'plant';
    return legacyPlant ? 14 * DAY_MS : 2 * DAY_MS;
}

// time と label は組で表示する。投稿時刻を現地での目撃時刻として扱わない。
export function getPinPresentation(post, now = Date.now(), filter = 'all') {
    const cleanedAt = toMillis(post.cleanedAt);
    if (cleanedAt !== null) {
        const phase = now - cleanedAt > DAY_MS ? 'archived' : 'cleaned';
        return { phase, time: cleanedAt, label: '清掃完了' };
    }

    const timestamp = postedAt(post);
    if (post.resolved === true) {
        return { phase: 'resolved', time: timestamp, label: timestamp === null ? '日付不明' : '解決済みの投稿日' };
    }

    const confirmedAt = toMillis(post.confirmedAt);
    if (confirmedAt !== null) {
        const phase = now - confirmedAt > DAY_MS ? 'archived' : 'fresh';
        return { phase, time: confirmedAt, label: '再確認' };
    }

    const observedAt = toMillis(post.observedAt);
    const time = observedAt ?? timestamp;
    if (post.pinKind === 'memo') {
        const label = observedAt !== null ? '現地で見た日時' : 'メモの投稿日';
        return { phase: 'memo', time, label: time === null ? '日付不明' : label };
    }

    const label = observedAt !== null ? '現地で見た日時' : '投稿';
    if (timestamp === null) {
        return { phase: 'faded', time, label: time === null ? '日付不明' : label };
    }

    const age = now - timestamp;
    if (age > archiveWindow(post, filter)) return { phase: 'archived', time, label };
    return { phase: age < DAY_MS ? 'fresh' : 'faded', time, label };
}

// Date.now() の整数ミリ秒で、判定が初めて変わる時刻。Firestore の時刻には端数があり得る。
export function nextPinTransition(post, now = Date.now(), filter = 'all') {
    const { phase, time } = getPinPresentation(post, now, filter);
    if (phase === 'cleaned' || (phase === 'fresh' && toMillis(post.confirmedAt) !== null)) {
        return Math.floor(time + DAY_MS) + 1;
    }
    const timestamp = postedAt(post);
    if (timestamp === null) return null;
    if (phase === 'fresh') return Math.ceil(timestamp + DAY_MS);
    if (phase === 'faded') return Math.floor(timestamp + archiveWindow(post, filter)) + 1;
    return null;
}

export function isPostArchived(post, filter = 'all', now = Date.now()) {
    return getPinPresentation(post, now, filter).phase === 'archived';
}

function isOpenPublicAlert(post) {
    const isAlert = 'pinKind' in post ? post.pinKind === 'alert' :
        post.type === 'danger' || post.type === 'plant';
    return isAlert && post.visibility === 'public' &&
        (!('resolved' in post) || post.resolved === false) && post.cleanedAt == null;
}

export function canReconfirmPin(post, now = Date.now()) {
    if (!isOpenPublicAlert(post) || post.confirmedAt != null) return false;
    const timestamp = postedAt(post);
    if (timestamp === null) return false;
    const age = now - timestamp;
    return age >= DAY_MS && age <= 2 * DAY_MS;
}

export function isLitterPin(post) {
    if ('isLitter' in post) return post.isLitter === true;
    return post.title === 'ゴミが落ちてるよ';
}

export function canCleanPin(post) {
    return post.type === 'danger' && isOpenPublicAlert(post) && isLitterPin(post);
}

export function pinMatchesTag(post, tag) {
    if (!tag || tag === 'all') return true;
    return post.pinKind === 'memo' && PIN_TAGS.includes(tag) &&
        Array.isArray(post.tags) && post.tags.includes(tag);
}

export function isSeasonalMemoActive(post, now = Date.now()) {
    if (getPinPresentation(post, now).phase !== 'memo') return false;
    const month = Number(tokyoMonth.format(now));
    const season = ['冬', '春', '夏', '秋'][Math.floor((month % 12) / 3)];
    return pinMatchesTag(post, season);
}
