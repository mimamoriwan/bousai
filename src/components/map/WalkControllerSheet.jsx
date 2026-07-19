import { useEffect, useRef, useState } from 'react';
import { db } from '../../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { isBrowserOnline, OFFLINE_WRITE_MESSAGE } from '../../utils/networkStatus';
import './WalkControllerSheet.css';

/** お散歩アクションの設定 */
const WALK_ACTIONS = [
    {
        type: 'sniff',
        label: 'くん活',
        emoji: '🐕',
        bg: '#FEF3C7',
        border: '#FDE68A',
        color: '#92400E',
    },
    {
        type: 'pee',
        label: 'おしっこ',
        emoji: '💧',
        bg: '#E0F2FE',
        border: '#BAE6FD',
        color: '#0369A1',
    },
    {
        type: 'poop',
        label: 'うんち',
        emoji: '💩',
        bg: '#F5F5F4',
        border: '#E7E5E4',
        color: '#57534E',
    },
    {
        type: 'mark',
        label: 'マーキング',
        emoji: '📍',
        bg: '#FFE4E6',
        border: '#FECDD3',
        color: '#BE123C',
    },
];

const getLocationFailureMessage = (error) => {
    if (!navigator.geolocation) {
        return 'この端末では位置情報を利用できません。';
    }
    if (error?.code === 1) {
        return '位置情報が許可されていません。端末の設定をご確認ください。';
    }
    if (error?.code === 3) {
        return '現在地を取得できませんでした。屋外などで、もう一度お試しください。';
    }
    return '現在地を取得できませんでした。もう一度お試しください。';
};

/**
 * お散歩記録コントローラー（カスタム fixed パネル）
 *
 * ボトムナビゲーションバー（64px）の真上に配置するため、
 * react-spring-bottom-sheet ではなく position:fixed で実装。
 *
 * ボタンを押すと、正確な位置を本人だけが読める `walkActions` に保存する。
 * 公開マップでは、将来このデータを集約・匿名化した情報だけを表示する。
 */
const WalkControllerSheet = ({ isOpen, onClose, onRequestMapSelection }) => {
    const { currentUser } = useAuth();
    const [recordingActionType, setRecordingActionType] = useState(null);
    const sheetRef = useRef(null);
    const previousFocusRef = useRef(null);
    const onCloseRef = useRef(onClose);
    const isBusyRef = useRef(false);
    const recordingLockRef = useRef(false);
    const isBusy = Boolean(recordingActionType);
    const recordingAction = WALK_ACTIONS.find((action) => action.type === recordingActionType);

    useEffect(() => {
        onCloseRef.current = onClose;
        isBusyRef.current = isBusy;
    }, [isBusy, onClose]);

    useEffect(() => {
        if (!isOpen) return undefined;

        previousFocusRef.current = document.activeElement;
        const focusTimer = window.setTimeout(() => {
            sheetRef.current?.querySelector('[data-walk-action]')?.focus();
        }, 0);

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                if (!isBusyRef.current) onCloseRef.current();
                return;
            }

            if (event.key !== 'Tab' || !sheetRef.current) return;
            const focusableElements = Array.from(
                sheetRef.current.querySelectorAll('button:not(:disabled)')
            );
            if (focusableElements.length === 0) return;

            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];
            if (event.shiftKey && document.activeElement === firstElement) {
                event.preventDefault();
                lastElement.focus();
            } else if (!event.shiftKey && document.activeElement === lastElement) {
                event.preventDefault();
                firstElement.focus();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            window.clearTimeout(focusTimer);
            document.removeEventListener('keydown', handleKeyDown);
            if (previousFocusRef.current instanceof HTMLElement) {
                previousFocusRef.current.focus();
            }
        };
    }, [isOpen]);

    const handleAction = async (actionType, label) => {
        if (!currentUser || recordingLockRef.current) return;
        if (!isBrowserOnline()) {
            toast.error(OFFLINE_WRITE_MESSAGE, { duration: 5000 });
            return;
        }
        recordingLockRef.current = true;
        isBusyRef.current = true;
        setRecordingActionType(actionType);
        try {
            if (!navigator.geolocation) {
                throw new Error('Geolocation is unavailable');
            }

            const pos = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 8000,
                    maximumAge: 0,
                });
            });
            const { latitude: lat, longitude: lng } = pos.coords;

            await addDoc(collection(db, 'walkActions'), {
                uid: currentUser.uid,
                actionType,
                lat,
                lng,
                timestamp: Date.now(),
                createdAt: serverTimestamp(),
            });

            toast.success(`${label}を記録しました🐾`, { duration: 2500, icon: '📍' });
        } catch (err) {
            if (err?.code === 1 || err?.code === 2 || err?.code === 3 || !navigator.geolocation) {
                console.warn('位置情報取得エラー:', err);
                if (onRequestMapSelection) {
                    toast('現在地を取得できないため、地図から記録場所を選んでください。', { icon: '🗺️' });
                    onClose();
                    onRequestMapSelection({ actionType, label, locationError: err });
                } else {
                    toast.error(getLocationFailureMessage(err));
                }
            } else {
                console.error('お散歩アクション保存エラー:', err);
                toast.error('記録の保存に失敗しました。もう一度お試しください。');
            }
        } finally {
            recordingLockRef.current = false;
            isBusyRef.current = false;
            setRecordingActionType(null);
        }
    };

    return (
        <div
            className={`walk-controller-backdrop${isOpen ? ' is-open' : ''}`}
            aria-hidden={!isOpen}
            inert={!isOpen}
            onClick={() => {
                if (!isBusy) onClose();
            }}
        >
            <section
                ref={sheetRef}
                id="walk-controller-sheet"
                className="walk-controller-sheet"
                role="dialog"
                aria-modal="true"
                aria-labelledby="walk-controller-title"
                aria-describedby="walk-controller-description"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="walk-controller-handle" aria-hidden="true" />

                <header className="walk-controller-header">
                    <div>
                        <h2 id="walk-controller-title">🐾 お散歩記録</h2>
                        <p id="walk-controller-description">今した行動を1つ選んで記録します</p>
                    </div>
                    <button
                        type="button"
                        className="walk-controller-close"
                        onClick={onClose}
                        disabled={isBusy}
                        aria-label="お散歩記録を閉じる"
                    >
                        <span aria-hidden="true">×</span>
                    </button>
                </header>

                <div className="walk-controller-actions">
                    {WALK_ACTIONS.map((action) => {
                        const isRecordingThisAction = recordingActionType === action.type;
                        return (
                            <button
                                key={action.type}
                                type="button"
                                data-walk-action
                                className="walk-controller-action"
                                onClick={() => handleAction(action.type, action.label)}
                                disabled={isBusy}
                                aria-busy={isRecordingThisAction}
                                style={{
                                    '--walk-action-bg': action.bg,
                                    '--walk-action-border': action.border,
                                    '--walk-action-color': action.color,
                                }}
                            >
                                <span className="walk-controller-action-icon" aria-hidden="true">
                                    {isRecordingThisAction ? '⏳' : action.emoji}
                                </span>
                                <span>{isRecordingThisAction ? '記録中...' : action.label}</span>
                            </button>
                        );
                    })}
                </div>

                <p className="walk-controller-hint">
                    現在地を取得できない場合は、地図から場所を選べます。
                </p>
                <div className="walk-controller-status" role="status" aria-live="polite">
                    {recordingAction ? `現在地を確認して「${recordingAction.label}」を保存しています。` : ''}
                </div>
            </section>
        </div>
    );
};

export default WalkControllerSheet;
