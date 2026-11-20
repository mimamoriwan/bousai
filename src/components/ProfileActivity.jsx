import { useEffect, useState } from 'react';
import { collection, onSnapshot, or, query, where } from 'firebase/firestore';
import { ownsPin } from '../utils/pinIdentity';
import { MdCleaningServices, MdFavorite, MdLocationOn, MdPets } from 'react-icons/md';
import { db } from '../firebase';
import { summarizeProfileActivity } from '../utils/profileActivity';
import './ProfileActivity.css';

function ActivityStat({ label, icon: Icon, value, unit, tone, children }) {
    return (
        <div className={`profile-activity__stat profile-activity__stat--${tone}`}>
            <dt><Icon aria-hidden="true" size={23} />{label}</dt>
            <dd><strong>{value ?? '—'}</strong> {unit}</dd>
            {children}
        </div>
    );
}

function ActivityRow({ activity }) {
    const cleanup = activity.kind === 'cleanup';
    const date = activity.date || (activity.time ? new Date(activity.time).toLocaleDateString('ja-JP') : '日時不明');
    return (
        <li className={`card profile-activity__row profile-activity__row--${cleanup ? 'cleanup' : activity.type}`}>
            <div className="profile-activity__row-heading">
                <strong>
                    {cleanup ? <MdCleaningServices aria-hidden="true" /> : <MdLocationOn aria-hidden="true" />}
                    {activity.resolved ? <del>{activity.title}</del> : activity.title}
                </strong>
                <span>{date}</span>
            </div>
            <p>{cleanup ? 'この場所を掃除しました' : activity.note || '詳細なし'}</p>
            <div className="profile-activity__row-footer">
                {activity.hasPhoto && <span>写真あり</span>}
                <span className="profile-activity__reaction">
                    <MdFavorite aria-hidden="true" />
                    {cleanup ? '清掃へのありがとう' : '投稿へのありがとう'} {activity.thanks}件
                </span>
            </div>
        </li>
    );
}

export default function ProfileActivity({ uid }) {
    const [posts, setPosts] = useState(null);
    const [cleanups, setCleanups] = useState(null);
    const [walkCount, setWalkCount] = useState(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        function watch(name, condition, receive) {
            const owned = query(collection(db, name), condition);
            return onSnapshot(owned, receive, error => {
                console.error(`${name} の活動実績を取得できませんでした:`, error);
                setFailed(true);
            });
        }
        const readRows = snapshot => snapshot.docs.map(item => ({
            ...item.data({ serverTimestamps: 'estimate' }),
            id: item.id,
        }));
        const ownedPosts = or(where('ownerUid', '==', uid), where('uid', '==', uid));
        const stopPosts = watch('map_pins', ownedPosts, snapshot => setPosts(readRows(snapshot).filter(post => ownsPin(post, uid))));
        const stopCleanups = watch('pinCleanups', where('cleanerUid', '==', uid), snapshot => setCleanups(readRows(snapshot)));
        const stopWalks = watch('walkActions', where('uid', '==', uid), snapshot => setWalkCount(snapshot.size));
        return () => {
            stopPosts();
            stopCleanups();
            stopWalks();
        };
    }, [uid]);

    const { postThanks, cleanupThanks, recent } = summarizeProfileActivity(posts ?? [], cleanups ?? []);
    const totalThanks = posts && cleanups ? postThanks + cleanupThanks : null;
    return (
        <section className="profile-activity" aria-label="みまもり活動">
            <div className="card profile-activity__summary">
                <h3>みまもり活動実績</h3>
                {failed && <p role="status">一部の活動実績を読み込めませんでした。</p>}
                <dl className="profile-activity__stats">
                    <ActivityStat label="お散歩アクション" icon={MdPets} value={walkCount} unit="回" tone="walk" />
                    <ActivityStat label="発見したスポット" icon={MdLocationOn} value={posts?.length} unit="件" tone="post" />
                    <ActivityStat label="掃除した場所" icon={MdCleaningServices} value={cleanups?.length} unit="か所" tone="cleanup" />
                    <ActivityStat label="もらったありがとう" icon={MdFavorite} value={totalThanks} unit="件" tone="thanks">
                        <dd className="profile-activity__breakdown">
                            <span>投稿 {posts ? postThanks : '—'}件</span>
                            <span>清掃 {cleanups ? cleanupThanks : '—'}件</span>
                        </dd>
                    </ActivityStat>
                </dl>
            </div>
            {recent.length > 0 && (
                <>
                    <h3>最近の活動</h3>
                    <ul className="profile-activity__list">
                        {recent.map(activity => <ActivityRow key={activity.key} activity={activity} />)}
                    </ul>
                </>
            )}
        </section>
    );
}
