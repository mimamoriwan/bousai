import { useEffect, useRef } from 'react';
import './MapActionSheet.css';

const ActionButton = ({ icon, label, tone, onClick, disabled = false, fullWidth = false, buttonRef }) => (
    <button
        ref={buttonRef}
        type="button"
        className={`map-action-option is-${tone}${fullWidth ? ' is-full-width' : ''}`}
        onClick={onClick}
        disabled={disabled}
    >
        <span className="map-action-option-icon" aria-hidden="true">{icon}</span>
        <span>{disabled ? '取得中…' : label}</span>
    </button>
);

const MapActionSheet = ({
    isOpen,
    onClose,
    onCurrentLocationPost,
    onMapLocationPost,
    onQuickPost,
    onCurrentSpotSafety,
    onSafetyReport,
    onStartWalk,
    isSpotReporting,
    activeMapLayer,
    onSelectPublicMap,
    onSelectMyMap,
    isAnonymous,
    showArchived,
    onToggleArchived,
}) => {
    const firstActionRef = useRef(null);
    const sheetRef = useRef(null);

    useEffect(() => {
        if (!isOpen) return undefined;

        const previousFocus = document.activeElement;
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                onClose();
                return;
            }
            if (event.key !== 'Tab') return;

            const focusable = [...(sheetRef.current?.querySelectorAll(
                'button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])'
            ) || [])];
            if (focusable.length === 0) return;

            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        window.requestAnimationFrame(() => firstActionRef.current?.focus());

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            previousFocus?.focus?.();
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="map-action-backdrop" onClick={onClose}>
            <section
                ref={sheetRef}
                id="map-action-sheet"
                className="map-action-sheet"
                role="dialog"
                aria-modal="true"
                aria-labelledby="map-action-title"
                aria-describedby="map-action-description"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="map-action-drag-handle" aria-hidden="true" />
                <header className="map-action-header">
                    <div>
                        <h2 id="map-action-title">何をしますか？</h2>
                        <p id="map-action-description">よく使う操作をここから選べます</p>
                    </div>
                    <button type="button" className="map-action-close" onClick={onClose} aria-label="アクションメニューを閉じる">
                        ✕
                    </button>
                </header>

                <div className="map-action-scroll">
                    <div className="map-action-grid">
                        <ActionButton buttonRef={firstActionRef} icon="📍" label="現在地で投稿" tone="primary" onClick={onCurrentLocationPost} />
                        <ActionButton icon="🗺️" label="地図から投稿" tone="neutral" onClick={onMapLocationPost} />
                        <ActionButton icon="⚡️" label="クイック投稿" tone="quick" onClick={onQuickPost} />
                        <ActionButton icon="🟢" label="今ここ安全！" tone="safe" onClick={onCurrentSpotSafety} disabled={isSpotReporting} />
                        <ActionButton icon="✅" label="お散歩異常なし" tone="safe-soft" onClick={onSafetyReport} />
                        <ActionButton icon="🐾" label="お散歩記録をはじめる" tone="walk" onClick={onStartWalk} fullWidth />
                    </div>

                    <div className="map-action-settings">
                        <h3>マップ表示</h3>
                        <div className="map-layer-switch" aria-label="表示するマップを選択">
                            <button
                                type="button"
                                className={activeMapLayer === 'public' ? 'is-active' : ''}
                                onClick={onSelectPublicMap}
                                aria-pressed={activeMapLayer === 'public'}
                            >
                                🌍 みんなのマップ
                            </button>
                            <button
                                type="button"
                                className={activeMapLayer === 'myMap' ? 'is-active' : ''}
                                onClick={onSelectMyMap}
                                aria-pressed={activeMapLayer === 'myMap'}
                            >
                                🗺️ マイマップ
                            </button>
                        </div>

                        {activeMapLayer === 'myMap' && isAnonymous && (
                            <p className="map-action-guest-note">
                                🐾 ゲスト記録はこの端末で確認できます。Google連携すると機種変更後も引き継げます。
                            </p>
                        )}

                        {activeMapLayer === 'public' && (
                            <button
                                type="button"
                                className={`map-archive-toggle${showArchived ? ' is-active' : ''}`}
                                onClick={onToggleArchived}
                                aria-pressed={showArchived}
                            >
                                🕒 過去情報: {showArchived ? 'ON' : 'OFF'}
                            </button>
                        )}
                    </div>
                </div>
            </section>
        </div>
    );
};

export default MapActionSheet;
