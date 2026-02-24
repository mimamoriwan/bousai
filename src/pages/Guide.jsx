import { useState } from 'react';
import guides from '../data/guides.json';

const GuidePage = () => {
    const [isAccordionOpen, setIsAccordionOpen] = useState(false);

    return (
        <div className="guide-page" style={{ paddingBottom: 'var(--spacing-xl)' }}>
            <h2 style={{ marginBottom: 'var(--spacing-md)' }}>みまもりWANとは？</h2>
            <div className="card" style={{ marginBottom: 'var(--spacing-lg)' }}>
                <p style={{ lineHeight: '1.6', marginBottom: 'var(--spacing-md)' }}>
                    「愛犬がお散歩中に何でも口にしてしまう危険」を防ぎたいという想いから生まれました。
                </p>
                <p style={{ lineHeight: '1.6', marginBottom: 'var(--spacing-md)' }}>
                    『あそこにガラスが落ちていた』『ここの花壇、今朝除草剤をかけていたよ』『よく分からないけど、このあたりめっちゃくん活するよ』など、<strong>『知っていれば予防できる』</strong>リアルな情報を地域の飼い主同士で共有するためのアプリです。
                </p>
            </div>

            <h2 style={{ marginBottom: 'var(--spacing-md)' }}>みまもり隊員について</h2>
            <div className="card" style={{ marginBottom: 'var(--spacing-xl)' }}>
                <p style={{ lineHeight: '1.6' }}>
                    このサービスを使ってくれる地域のワンコたちを<strong>「みまもり隊員」</strong>と呼んでいます。いつものお散歩コースを歩きながら、みんなで地域の安全を作りましょう！いつものお散歩コースで気づいたことを気軽に共有していきましょう。
                </p>
            </div>

            <h2 style={{ marginBottom: 'var(--spacing-md)' }}>簡単な使い方</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-xl)' }}>
                <div className="card" style={{ margin: 0, borderLeft: '4px solid var(--color-primary)' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--color-primary)' }}>
                        <span style={{ fontSize: '1.25rem' }}>①</span> お散歩前にマップをチェック 🗺️
                    </h3>
                    <p style={{ lineHeight: '1.6', fontSize: '0.9rem' }}>
                        「今日はどこを歩こうかな？」お出かけ前に、マップを開いて危険な場所や新しい寄り道スポットを確認しましょう。
                    </p>
                </div>

                <div className="card" style={{ margin: 0, borderLeft: '4px solid var(--color-primary)' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--color-primary)' }}>
                        <span style={{ fontSize: '1.25rem' }}>②</span> 気づいたことを「＋ スポット投稿」 📸
                    </h3>
                    <p style={{ lineHeight: '1.6', fontSize: '0.9rem' }}>
                        ガラスの破片、除草剤、素敵な「くん活」スポットなどを見つけたら、マップ画面のボタンから写真と一緒に気軽にシェア！
                    </p>
                </div>

                <div className="card" style={{ margin: 0, borderLeft: '4px solid var(--color-primary)' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--color-primary)' }}>
                        <span style={{ fontSize: '1.25rem' }}>③</span> みんなでリアクション 💖👍
                    </h3>
                    <p style={{ lineHeight: '1.6', fontSize: '0.9rem' }}>
                        役に立つ情報には「💖ありがとう」を。危険箇所が片付いて安全になっていたら「👍解決済」を押して、みんなでマップを最新の状態にアップデートしましょう！
                    </p>
                </div>
            </div>

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
        </div>
    );
};

export default GuidePage;
