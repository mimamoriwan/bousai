import { useEffect, useState } from 'react';
import { isBrowserOnline } from '../utils/networkStatus';
import './NetworkStatusBanner.css';

const NetworkStatusBanner = () => {
    const [status, setStatus] = useState(() => (
        isBrowserOnline() ? 'online' : 'offline'
    ));

    useEffect(() => {
        let timer;
        const handleOnline = () => {
            window.clearTimeout(timer);
            setStatus('recovered');
            timer = window.setTimeout(() => setStatus('online'), 3000);
        };
        const handleOffline = () => {
            window.clearTimeout(timer);
            setStatus('offline');
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.clearTimeout(timer);
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    if (status === 'online') return null;

    const isRecovered = status === 'recovered';

    return (
        <div
            className={`network-status-banner ${isRecovered ? 'is-recovered' : 'is-offline'}`}
            role="status"
            aria-live="polite"
        >
            <span aria-hidden="true">{isRecovered ? '✅' : '📶'}</span>
            <span>
                {isRecovered
                    ? '通信が戻りました。もう一度操作できます。'
                    : 'オフラインです。入力はそのまま残るので、接続後に再試行してください。'}
            </span>
        </div>
    );
};

export default NetworkStatusBanner;
