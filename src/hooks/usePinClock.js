import { useEffect, useState } from 'react';
import { nextPinTransition } from '../utils/postFreshness';

export function usePinClock(posts, filter) {
    const [now, setNow] = useState(Date.now);
    useEffect(() => {
        let timer;
        function refresh() {
            clearTimeout(timer);
            const current = Date.now();
            setNow(current);
            // Re-evaluate the season and recover from a system clock change within a minute.
            let next = current + 60_000;
            for (const post of posts) {
                const transition = nextPinTransition(post, current, filter);
                if (transition > current && transition < next) next = transition;
            }
            timer = window.setTimeout(refresh, Math.max(1, next - Date.now()));
        }
        function onVisibilityChange() {
            if (document.visibilityState === 'visible') refresh();
        }
        refresh();
        document.addEventListener('visibilitychange', onVisibilityChange);
        window.addEventListener('focus', refresh);
        return () => {
            clearTimeout(timer);
            document.removeEventListener('visibilitychange', onVisibilityChange);
            window.removeEventListener('focus', refresh);
        };
    }, [posts, filter]);
    return now;
}
