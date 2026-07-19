import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './GuestWelcome.css';

const GUEST_WELCOME_STORAGE_KEY = 'mimamoriwan_guest_welcome_v1';

const hasSeenGuestWelcome = () => {
    try {
        return localStorage.getItem(GUEST_WELCOME_STORAGE_KEY) === 'seen';
    } catch {
        return false;
    }
};

const rememberGuestWelcome = () => {
    try {
        localStorage.setItem(GUEST_WELCOME_STORAGE_KEY, 'seen');
    } catch {
        // ストレージを使えない環境でも、現在の表示だけは閉じられるようにする。
    }
};

const GuestWelcome = () => {
    const { currentUser } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const primaryButtonRef = useRef(null);

    useEffect(() => {
        if (
            location.pathname !== '/' ||
            !currentUser?.isAnonymous ||
            hasSeenGuestWelcome()
        ) {
            return undefined;
        }

        // 地図と現在地案内を先に見せ、起動直後の負担を減らす。
        const timer = window.setTimeout(() => setIsOpen(true), 700);
        return () => window.clearTimeout(timer);
    }, [currentUser, location.pathname]);

    useEffect(() => {
        if (!isOpen) return undefined;

        primaryButtonRef.current?.focus();
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                rememberGuestWelcome();
                setIsOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    const dismiss = () => {
        rememberGuestWelcome();
        setIsOpen(false);
    };

    const openGuide = () => {
        dismiss();
        navigate('/guide');
    };

    if (
        !isOpen ||
        location.pathname !== '/' ||
        !currentUser?.isAnonymous ||
        hasSeenGuestWelcome()
    ) return null;

    return (
        <div className="guest-welcome-backdrop" role="presentation">
            <section
                className="guest-welcome-sheet"
                role="dialog"
                aria-modal="true"
                aria-labelledby="guest-welcome-title"
                aria-describedby="guest-welcome-description"
            >
                <button
                    className="guest-welcome-close"
                    type="button"
                    onClick={dismiss}
                    aria-label="初回案内を閉じる"
                >
                    ×
                </button>

                <div className="guest-welcome-mark" aria-hidden="true">🐶</div>
                <div className="guest-welcome-mode">登録不要のゲストモード</div>
                <h2 id="guest-welcome-title">もう、そのまま使えます</h2>
                <p id="guest-welcome-description" className="guest-welcome-lead">
                    ログインしなくても、地域の情報を見たり、お散歩中の投稿や記録を試せます。
                </p>

                <div className="guest-welcome-features">
                    <div className="guest-welcome-feature">
                        <span aria-hidden="true">🗺️</span>
                        <div><strong>地図を見る</strong><small>注意・安全・お散歩のにぎわいを確認</small></div>
                    </div>
                    <div className="guest-welcome-feature">
                        <span aria-hidden="true">🐾</span>
                        <div><strong>肉球ボタンを押す</strong><small>クイック投稿やお散歩記録を開始</small></div>
                    </div>
                    <div className="guest-welcome-feature">
                        <span aria-hidden="true">📒</span>
                        <div><strong>マイページに残す</strong><small>保存した投稿と自分だけの記録を確認</small></div>
                    </div>
                </div>

                <p className="guest-welcome-account-note">
                    Google連携は、機種変更時の引き継ぎや詳しいプロフィールが必要になった時で大丈夫です。
                </p>

                <button
                    ref={primaryButtonRef}
                    className="guest-welcome-primary"
                    type="button"
                    onClick={dismiss}
                >
                    マップを見てみる
                </button>
                <button
                    className="guest-welcome-guide"
                    type="button"
                    onClick={openGuide}
                >
                    詳しい使い方を見る
                </button>
            </section>
        </div>
    );
};

export default GuestWelcome;
