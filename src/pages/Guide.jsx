import { useState } from 'react';
import { Link } from 'react-router-dom';
import guides from '../data/guides.json';

const GuidePage = () => {
    const [isAccordionOpen, setIsAccordionOpen] = useState(false);

    return (
        <div className="guide-page" style={{ paddingBottom: 'var(--spacing-xl)' }}>
            <h2 style={{ marginBottom: 'var(--spacing-md)' }}>みまもりWANとは？</h2>
            <div className="card" style={{ marginBottom: 'var(--spacing-lg)' }}>
                <p style={{ lineHeight: '1.6', marginBottom: 'var(--spacing-md)' }}>
                    愛犬がお散歩中に何でも口にしてしまう危険を防ぎたい、という想いから生まれました。
                </p>
                <p style={{ lineHeight: '1.6', marginBottom: 'var(--spacing-md)' }}>
                    例えば、いつものお散歩から帰ってきたら愛犬の足がただれていた…なんてことが起きたら、びっくりして病院に駆け込みますよね。<br />
                    でももし事前に、「あの草むら、さっき除草剤をまいていたよ」という情報があれば、近づかないように気をつけることができます。
                </p>
                <p style={{ lineHeight: '1.6', marginBottom: 'var(--spacing-md)' }}>
                    自宅の庭先に除草剤をまくこと自体は、決して悪いことではありません。ただ、その場面を目撃した人が「しばらく立ち入らない方がいいよ」と教えてくれたら、未然に防げる怪我や事故がたくさんあります。
                </p>
                <p style={{ lineHeight: '1.6', marginBottom: 'var(--spacing-md)', fontSize: '0.95rem', background: '#F9FAFB', padding: 'var(--spacing-sm)', borderRadius: '8px' }}>
                    『あそこにガラスが落ちていた』<br />
                    『ここの花壇、今朝除草剤をかけていたよ』<br />
                    『よく分からないけど、このあたりめっちゃくん活するよ』など。
                </p>
                <p style={{ lineHeight: '1.6' }}>
                    そんな、普段のお散歩で気づいたちょっとしたリアルな情報を、地域の飼い主さん同士で共有できたらいいなと思い、このアプリを開発しました。<br />
                    合言葉は<strong>『知っていれば予防できる』</strong>です。
                </p>
            </div>

            <h2 style={{ marginBottom: 'var(--spacing-md)' }}>みまもり隊員について</h2>
            <div className="card" style={{ marginBottom: 'var(--spacing-xl)' }}>
                <p style={{ lineHeight: '1.6' }}>
                    このサービスを使ってくれる地域のワンコたちを<strong>「みまもり隊員」</strong>と呼んでいます。<br />
                    いつものお散歩コースを歩きながら、みんなで地域の安全を作りましょう！「おや？」と気づいたことがあれば、ぜひ気軽に共有していきましょう🐾
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

            <div style={{ marginTop: 'var(--spacing-xl)', textAlign: 'center', fontSize: '0.85rem' }}>
                <Link to="/terms" style={{ color: 'var(--color-text-sub)', textDecoration: 'underline', marginRight: 'var(--spacing-md)' }}>利用規約</Link>
                <Link to="/privacy" style={{ color: 'var(--color-text-sub)', textDecoration: 'underline' }}>プライバシーポリシー</Link>
            </div>
        </div>
    );
};

export default GuidePage;
