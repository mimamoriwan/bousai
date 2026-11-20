import { useEffect, useState } from 'react';
import { getBlob, ref } from 'firebase/storage';
import { storage } from '../../firebase';

export default function PrivatePinPhoto({ path }) {
    const [url, setUrl] = useState(null);
    const [failed, setFailed] = useState(false);
    useEffect(() => {
        let cancelled = false;
        let objectUrl;
        getBlob(ref(storage, path)).then(blob => {
            if (cancelled) return;
            objectUrl = URL.createObjectURL(blob);
            setUrl(objectUrl);
        }).catch(() => {
            if (!cancelled) setFailed(true);
        });
        return () => {
            cancelled = true;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [path]);

    if (url) return <img className="pin-photo" src={url} alt="投稿の添付写真" />;
    return <span role="status">{failed ? '写真を読み込めませんでした。' : '写真を読み込んでいます…'}</span>;
}
