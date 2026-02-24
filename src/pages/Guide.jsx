import guides from '../data/guides.json';

const GuidePage = () => {
    return (
        <div className="guide-page">
            <h2>防災ガイド</h2>
            <p style={{ marginBottom: 'var(--spacing-md)', color: 'var(--color-text-sub)' }}>
                いざという時のために、日頃から確認しておきましょう。
            </p>

            {guides.map(guide => (
                <div key={guide.id} className="card">
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
    );
};

export default GuidePage;
