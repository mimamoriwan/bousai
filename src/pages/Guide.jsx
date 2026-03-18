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
                    <li style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '16px' }}>
                        <div style={{
                            display: 'inline-block',
                            fontSize: '0.75rem', fontWeight: 'bold',
                            color: 'white',
                            backgroundColor: 'var(--color-primary)',
                            borderRadius: '999px',
                            padding: '2px 10px',
                            marginBottom: '10px',
                        }}>2026/03/18 🆕 最新</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

                            {/* 項目1 */}
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px', backgroundColor: '#FFF7ED', borderRadius: '10px' }}>
                                <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>🐾</span>
                                <div>
                                    <div style={{ fontWeight: 'bold', fontSize: '0.92rem', color: '#92400E', marginBottom: '3px' }}>
                                        登録不要！「お試しスタート」ができました
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: '#78350F', lineHeight: '1.55' }}>
                                        「まずはどんなアプリか触ってみたい」というお声にお応えして、Googleログインなしですぐに全機能を使い始められるようになりました！いつものお散歩で、地域の安全マップをぜひ体験してみてください。（記録を残したい場合は、後からいつでも無料でGoogle連携が可能です）
                                    </div>
                                </div>
                            </div>

                            {/* 項目2 */}
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px', backgroundColor: '#F0FDF4', borderRadius: '10px' }}>
                                <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>🟢</span>
                                <div>
                                    <div style={{ fontWeight: 'bold', fontSize: '0.92rem', color: '#14532D', marginBottom: '3px' }}>
                                        ワンタップで貢献！「現在地で安全報告」ボタン追加
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: '#166534', lineHeight: '1.55' }}>
                                        お散歩中、「ここ見通しが良くて安全だな」と思ったら、右下の肉球ボタンから「現在地で安全報告」をタップ！事前のルート登録がなくても、思い立ったその場で直感的に地域の見守りに貢献できるようになりました。
                                    </div>
                                </div>
                            </div>

                            {/* 項目3 */}
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px', backgroundColor: '#EFF6FF', borderRadius: '10px' }}>
                                <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>✨</span>
                                <div>
                                    <div style={{ fontWeight: 'bold', fontSize: '0.92rem', color: '#1E3A5F', marginBottom: '3px' }}>
                                        アクションメニューがさらに使いやすく！
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: '#1e40af', lineHeight: '1.55' }}>
                                        右下の肉球ボタン（投稿メニュー）のデザインをスッキリとリニューアルしました。スマホからでも押し間違いがなく、スムーズに安全・危険の報告が可能です。
                                    </div>
                                </div>
                            </div>

                        </div>
                    </li>
                    <li style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '12px' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-sub)', marginBottom: '4px' }}>2026/03/11</div>
                        <div style={{ fontSize: '0.95rem', lineHeight: '1.5' }}>
                            【機能追加】マップに「現在地に戻る（ホーム）」ボタンを追加しました。<br />
                            【機能追加】文字入力なしでサクッと報告できる「クイック投稿」機能を追加しました（右下のアクションボタンから起動）。<br />
                            【UI改善】マイページの「不具合・報告」ボタンを、プロフィール下の見つけやすい位置に移動しました。<br />
                            【システム】セキュリティアップデートおよび動作の安定性向上を行いました。
                        </div>
                    </li>
                    <li style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '12px' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-sub)', marginBottom: '4px' }}>2026/03/08</div>
                        <div style={{ fontSize: '0.95rem', lineHeight: '1.5' }}>登録不要でサクッとアプリを体験できる「見習い隊員（お試し）モード」が登場しました！マップの過去情報（48時間以上前）を切り替え表示できるスイッチを追加し、投稿ジャンルに「街の発見・その他」が仲間入りしました🐾</div>
                    </li>
                    <li style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '12px' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-sub)', marginBottom: '4px' }}>2026/03/08</div>
                        <div style={{ fontSize: '0.95rem', lineHeight: '1.5' }}>LINE公式アカウントのメニュー「使い方・ヘルプ」がパワーアップしました！🐶 タップすると、可愛いイラスト付きで操作方法が確認できるリッチなガイドカードが届くようになりました📖✨</div>
                    </li>
                    <li style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '12px' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-sub)', marginBottom: '4px' }}>2026/03/07</div>
                        <div style={{ fontSize: '0.95rem', lineHeight: '1.5' }}>お散歩のきっかけを作る「すれ違い通信」機能を追加しました！🐾 お散歩ボタンをONにするとボタンがドクンと波打ち、ご近所でお散歩中の隊員が「地域の最新情報」に表示されるようになります🐶✨</div>
                    </li>
                    <li style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '12px' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-sub)', marginBottom: '4px' }}>2026/03/07</div>
                        <div style={{ fontSize: '0.95rem', lineHeight: '1.5' }}>ピンが密集している場所でも正確に投稿できるよう、マップの中央に照準（📍）を合わせて場所を選択する方式に大改修しました🎯</div>
                    </li>
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
