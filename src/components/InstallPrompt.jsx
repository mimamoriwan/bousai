import { useState } from 'react';
import './InstallPrompt.css';

const InstallPrompt = () => {
    // 案内表示は現在停止中。再開時は表示条件を専用フックとして追加する。
    const [isVisible] = useState(false);
    const [os] = useState(() => {
        const ua = navigator.userAgent || navigator.vendor || window.opera;
        const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
        if (isIOS) return 'ios';
        if (/android/i.test(ua)) return 'android';
        return 'other';
    });
    const [copied, setCopied] = useState(false);

    const handleCopyUrl = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy text: ', err);
            // Fallback for older browsers
            const textArea = document.createElement("textarea");
            textArea.value = window.location.href;
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            } catch (err) {
                console.error('Fallback copy failed', err);
            }
            document.body.removeChild(textArea);
        }
    };

    if (!isVisible) return null;

    return (
        <div className="install-prompt-overlay">
            <div className="install-prompt-modal">
                <div className="install-prompt-icon">🐾</div>
                <h2 className="install-prompt-title">標準ブラウザで開いてください</h2>

                <p className="install-prompt-message">
                    {os === 'ios' && (
                        <>
                            みまもりWANをアプリとして追加するには、標準ブラウザの <strong>Safari（青い方位磁針のアイコン）</strong> で開く必要があります。<br /><br />
                            下のボタンからURLをコピーして、Safariに貼り付けて開いてください🐶<br /><br />
                            その後、画面下部の『<span className="icon-box">[↑]（共有）</span>』マークから『ホーム画面に追加』を押してください。
                        </>
                    )}
                    {os === 'android' && (
                        <>
                            みまもりWANをアプリとして追加するには、標準ブラウザの <strong>Chrome</strong> で開く必要があります。<br /><br />
                            下のボタンからURLをコピーして、Chromeで開いてください🐶<br /><br />
                            その後、右上の『<span className="icon-box">︙</span>』メニューから『ホーム画面に追加』を押してください。
                        </>
                    )}
                    {os === 'other' && (
                        <>
                            みまもりWANの全機能を利用するには、標準ブラウザ（SafariやChrome）で開き直してください🐶
                        </>
                    )}
                </p>

                <button
                    className={`install-prompt-copy-btn ${copied ? 'copied' : ''}`}
                    onClick={handleCopyUrl}
                >
                    {copied ? '✅ コピーしました！' : '🔗 URLをコピーする'}
                </button>
            </div>
        </div>
    );
};

export default InstallPrompt;
