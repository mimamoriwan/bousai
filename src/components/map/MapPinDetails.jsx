import PrivatePinPhoto from './PrivatePinPhoto';
import { canCleanPin, canReconfirmPin } from '../../utils/postFreshness';
import { ownsPin, ownReactionIds } from '../../utils/pinIdentity';

const pinSymbols = { danger: '⚠️', plant: '🌿', others: '💡', shelter: '🎒' };
const eventDate = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export default function MapPinDetails({ post, presentation, now, uid, userHash, actions, selected, onOpen }) {
    const { phase, label, time } = presentation;
    const cleaned = Boolean(post.cleanedAt && post.cleanerUid);
    const area = post.locationPrecision === 'area';
    const memo = post.pinKind === 'memo';
    const isOwner = ownsPin(post, uid);
    const privatePhoto = isOwner && post.visibility === 'private'
        && post.imagePath?.startsWith(`private_map_pins/${uid}/`);
    const saved = ownReactionIds(post.savedBy, uid, userHash).length > 0;
    const authorThanked = ownReactionIds(post.thanks, uid, userHash).length > 0;
    const detailed = !onOpen || selected;
    const allowActivity = detailed && uid && post.visibility === 'public';
    const busy = actions.busyPin !== null;
    const symbol = cleaned ? '🧹' : memo ? '📖' : post.resolved ? '✅' : area ? '◌' : pinSymbols[post.type] || '🐾';
    const title = cleaned ? '清掃完了' : post.title;
    const stateLabel = phase === 'faded' ? (time ? '時間が経った投稿' : '時期不明の投稿') :
        phase === 'resolved' ? '解決済み' : phase === 'archived' ? '記録' : memo ? '散歩メモ' : null;
    const summary = <>
        <span className="pin-title"><span aria-hidden="true">{symbol}</span> {title}</span>
        {cleaned && <span className="pin-original-title">元の投稿「{post.title}」</span>}
        <span className="pin-meta">
            {stateLabel && <span className="pin-state">{stateLabel}</span>}
            {area && <span className="pin-area-label">この付近</span>}
            {Array.isArray(post.tags) && post.tags.map(tag => <span className="pin-tag" key={tag}>#{tag}</span>)}
        </span>
        <span className="pin-date">{time === null ? '日付不明' : <>{label} <time dateTime={new Date(time).toISOString()}>{eventDate.format(time)}</time></>}</span>
        {post.note && <span className="pin-note">{post.note}</span>}
    </>;
    return (
        <article id={onOpen ? `post-item-${post.id}` : undefined}
            className={`pin-details ${onOpen ? 'pin-card' : 'pin-popup'} phase-${phase}${area ? ' pin-area' : ''}${selected ? ' is-selected' : ''}`}>
            {onOpen ? <button type="button" className="pin-open" onClick={() => onOpen(post)} aria-expanded={selected}>
                {summary}
                {(privatePhoto || post.imageUrl) && !detailed && <span className="pin-photo-label">📷 写真あり</span>}
            </button> : summary}
            {detailed && <div className="pin-author">
                {post.memberNumber ? `みまもり隊員 No.${String(post.memberNumber).padStart(3, '0')} の投稿` : 'ゲスト隊員の投稿'}
                {post.visibility === 'private' && ' · 自分だけ'}
            </div>}
            {detailed && (privatePhoto
                ? <PrivatePinPhoto key={post.imagePath} path={post.imagePath} />
                : post.imageUrl && <img className="pin-photo" src={post.imageUrl} alt="投稿の添付写真" loading="lazy" />)}
            <div className="pin-actions">
                {allowActivity && canReconfirmPin(post, now) &&
                    <button type="button" disabled={busy} onClick={() => actions.run('reconfirm', post)}>まだあった</button>}
                {allowActivity && canCleanPin(post) &&
                    <button type="button" className="pin-clean-button" disabled={busy} onClick={() => actions.run('clean', post)}>🧹 掃除したよ</button>}
                {allowActivity && cleaned && post.cleanerUid !== uid &&
                    <button type="button" className="pin-clean-button" disabled={busy || actions.thankedPin === post.id}
                        onClick={() => actions.run('thank', post)}>
                        {actions.thankedPin === post.id ? '清掃へのお礼を送信済み' : '掃除してくれてありがとう'}
                    </button>}
                {!isOwner && post.visibility !== 'private' &&
                    <button type="button" aria-pressed={saved} disabled={!uid || !userHash} onClick={() => actions.save(post.id, post.savedBy)}>
                        {saved ? '🌟 保存済' : '⭐ 保存'}
                    </button>}
                {post.visibility !== 'private' && <button type="button" aria-pressed={authorThanked} disabled={!uid || !userHash}
                    onClick={() => actions.thanks(post.id, post.thanks)}>
                    💖 投稿へのありがとう {post.thanks?.length || 0}
                </button>}
                {detailed && isOwner && !post.resolved && !memo && !cleaned &&
                    <button type="button" onClick={() => actions.resolve(post.id)}>解決済みにする</button>}
                {detailed && isOwner && <button type="button" className="pin-delete"
                    onClick={() => actions.remove(post.id, post.imagePath)}>投稿を削除</button>}
            </div>
        </article>
    );
}
