import { useState } from 'react';
import { Link } from 'react-router-dom';
import guides from '../data/guides.json';

const GuidePage = () => {
    const [isAccordionOpen, setIsAccordionOpen] = useState(false);

    return (
        <div className="guide-page" style={{ paddingBottom: 'var(--spacing-xl)' }}>
            <h2 style={{ marginBottom: 'var(--spacing-md)', fontSize: '1.3rem' }}>使い方とお知らせ</h2>

            {/* 1. アプリの使い方（ピンの意味） */}
            <div className="card" style={{ marginBottom: 'var(--spacing-lg)' }}>
                <h3 style={{ marginBottom: 'var(--spacing-sm)', fontSize: '1.1rem' }}>🎉 みまもりWANへようこそ！</h3>
                <p style={{ lineHeight: '1.6', marginBottom: 'var(--spacing-md)', fontSize: '0.95rem' }}>
                    愛犬のお散歩コースの情報をみんなで共有するアプリです。いつものお散歩が、もっと安全で楽しい時間になりますように。
                </p>

                <h4 style={{ fontSize: '0.95rem', marginBottom: '8px', color: 'var(--color-primary)' }}>📍 投稿できるスポットの種類</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px', backgroundColor: '#F9FAFB', borderRadius: '8px' }}>
                        <span style={{ fontSize: '1.4rem' }}>🐾</span>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 'bold', fontSize: '0.95rem', color: '#374151' }}>お散歩情報</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--color-text-sub)', marginTop: '2px' }}>新しい発見、おすすめの「くん活」スポットなど</div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px', backgroundColor: '#FEF2F2', borderRadius: '8px' }}>
                        <span style={{ fontSize: '1.4rem' }}>⚠️</span>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 'bold', fontSize: '0.95rem', color: '#DC2626' }}>危険・注意</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--color-text-sub)', marginTop: '2px' }}>ガラスの破片、除草剤、その他気をつけるべき場所</div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px', backgroundColor: '#F0FDF4', borderRadius: '8px' }}>
                        <span style={{ fontSize: '1.4rem' }}>🎒</span>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 'bold', fontSize: '0.95rem', color: '#16A34A' }}>防災・避難所</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--color-text-sub)', marginTop: '2px' }}>ペットと一緒に避難できる施設や防災に役立つ情報</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. 最近のアップデート履歴 */}
            <h2 style={{ marginBottom: 'var(--spacing-md)', fontSize: '1.1rem', color: 'var(--color-text)' }}>🕒 最近のアップデート</h2>
            <div className="card" style={{ marginBottom: 'var(--spacing-lg)' }}>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <li style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '12px' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-sub)', marginBottom: '4px' }}>2026/03/07</div>
                        <div style={{ fontSize: '0.95rem', lineHeight: '1.5' }}>アプリ起動時のマップのズーム具合を、ご近所が見渡しやすいサイズに調整しました🗺️</div>
                    </li>
                    <li style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '12px' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-sub)', marginBottom: '4px' }}>2026/03/05</div>
                        <div style={{ fontSize: '0.95rem', lineHeight: '1.5' }}>マイページに「みまもり活動実績」と「最近の投稿」を表示する機能を追加しました🐾</div>
                    </li>
                    <li>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-sub)', marginBottom: '4px' }}>2026/03/04</div>
                        <div style={{ fontSize: '0.95rem', lineHeight: '1.5' }}>スマホのホーム画面に追加して全画面起動ができる「PWA」に対応しました📱</div>
                    </li>
                </ul>
            </div>

            {/* 3. 公式お知らせ（LINE VOOM）へのリンクボタン */}
            <div style={{ marginBottom: 'var(--spacing-xl)' }}>
                <a
                    href="https://linevoom.line.me/user/_dU3Mbg3U7MUhaAyH-yTqWOkQQyc7ITrUn5tubPQ"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        backgroundColor: '#06C755',
                        color: 'white',
                        padding: '16px',
                        borderRadius: '9999px',
                        textDecoration: 'none',
                        fontWeight: 'bold',
                        fontSize: '1.05rem',
                        boxShadow: '0 4px 12px rgba(6, 199, 85, 0.3)',
                    }}
                >
                    もっと詳しいお知らせを見る（LINE）
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line>
                    </svg>
                </a>
            </div>

            {/* いざという時の防災ガイド（既存のアコーディオンを維持） */}
            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--spacing-md)' }}>
                <button
                    onClick={() => setIsAccordionOpen(!isAccordionOpen)}
                    style={{
                        width: '100%',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        padding: 'var(--spacing-md)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '1.1rem',
                        fontWeight: 'bold',
                        color: 'var(--color-text)'
                    }}
                >
                    いざという時の防災ガイド
                    <span>{isAccordionOpen ? '▲' : '▼'}</span>
                </button>

                {isAccordionOpen && (
                    <div style={{ marginTop: 'var(--spacing-md)' }}>
                        {guides.map(guide => (
                            <div key={guide.id} className="card" style={{ marginBottom: 'var(--spacing-md)' }}>
                                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--spacing-sm)' }}>
                                    <span style={{ fontSize: '1.5rem' }}>{guide.icon}</span>
                                    {guide.title}
                                </h3>
                                <ul style={{ paddingLeft: '20px', lineHeight: '1.6' }}>
                                    {guide.content.map((item, index) => (
                                        <li key={index} style={{ marginBottom: '4px' }}>{item}</li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div style={{ marginTop: 'var(--spacing-xl)', textAlign: 'center', fontSize: '0.85rem' }}>
                <Link to="/terms" style={{ color: 'var(--color-text-sub)', textDecoration: 'underline', marginRight: 'var(--spacing-md)' }}>利用規約</Link>
                <Link to="/privacy" style={{ color: 'var(--color-text-sub)', textDecoration: 'underline' }}>プライバシーポリシー</Link>
            </div>
        </div>
    );
};

export default GuidePage;
