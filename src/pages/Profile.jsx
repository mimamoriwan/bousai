import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const Profile = () => {
    const { currentUser, loginWithGoogle, logout } = useAuth();

    const [profile, setProfile] = useState(() => {
        // Fallback initialized later in useEffect based on currentUser
        return {
            name: '',
            species: 'dog',
            size: 'medium', // small, medium, large
            breed: '',
            birthdate: '',
            gender: 'male',
            owner: '',
            phone: '',
            vet: '',
            notes: ''
        };
    });

    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        if (currentUser) {
            const savedProfile = localStorage.getItem(`pet_profile_${currentUser.uid}`);
            if (savedProfile) {
                setProfile(JSON.parse(savedProfile));
                setIsEditing(false);
            } else {
                setIsEditing(true);
            }
        }
    }, [currentUser]);
    if (!currentUser) {
        return (
            <div className="profile-page" style={{ textAlign: 'center', padding: 'var(--spacing-lg) var(--spacing-md)' }}>
                <h2 style={{ marginBottom: 'var(--spacing-md)' }}>マイページ</h2>
                <div className="card" style={{ padding: 'var(--spacing-lg) var(--spacing-md)' }}>
                    <div style={{ fontSize: '3rem', marginBottom: 'var(--spacing-md)' }}>🐾</div>
                    <p style={{ margin: 'var(--spacing-md) 0', color: 'var(--color-text-sub)', lineHeight: '1.6' }}>
                        ペットの情報を登録・管理するには、Googleアカウントでのログインが必要です。
                    </p>
                    <button
                        onClick={loginWithGoogle}
                        className="btn"
                        style={{
                            width: '100%',
                            padding: '12px',
                            fontSize: '1rem',
                            backgroundColor: 'white',
                            color: '#333',
                            border: '1px solid #ddd',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            fontWeight: 'bold'
                        }}
                    >
                        <svg width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path></svg>
                        Googleでログイン
                    </button>
                </div>
            </div>
        );
    }

    const handleChange = (e) => {
        const { name, value } = e.target;
        setProfile(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = (e) => {
        e.preventDefault();
        if (currentUser) {
            localStorage.setItem(`pet_profile_${currentUser.uid}`, JSON.stringify(profile));
        }
        setIsEditing(false);
    };

    const calculateAge = (birthdate) => {
        if (!birthdate) return '不明';
        const birth = new Date(birthdate);
        const now = new Date();
        let years = now.getFullYear() - birth.getFullYear();
        let months = now.getMonth() - birth.getMonth();
        if (months < 0) {
            years--;
            months += 12;
        }
        return `${years}歳${months}ヶ月`;
    };

    const getDisasterAdvice = (size, species) => {
        if (species === 'cat') {
            return '猫は環境変化に敏感です。普段からキャリーバッグやケージに慣れさせ、洗濯ネットを用意しておくと脱走防止に役立ちます。';
        }
        if (species === 'other') {
            return '小動物や鳥類などは温度管理が重要です。使い捨てカイロや保冷剤を備蓄し、専用のケージごと避難できるようにカバーを用意しましょう。';
        }
        // Dog advice based on size
        switch (size) {
            case 'small':
                return '小型犬は抱っこして避難しやすいですが、パニックで暴れることもあります。スリングやリュック型のキャリーが便利です。';
            case 'medium':
                return '中型犬はバリケンネル（ハードキャリー）での待機トレーニングが必須です。避難所ではクレート内で過ごす時間が長くなります。';
            case 'large':
                return '大型犬は移動や場所の確保が大変です。日頃から「マテ」「ハウス」のコマンドを完璧にし、リードを短く持って歩く練習をしておきましょう。また、多めの食料備蓄が必要です。';
            default:
                return 'ペットに合わせた避難用品と、基本的なしつけ（マテ、ハウス、無駄吠え防止）を確認しておきましょう。';
        }
    };

    if (isEditing) {
        return (
            <div className="profile-page">
                <h2>プロフィール編集</h2>
                <form onSubmit={handleSave}>
                    <div style={{ marginBottom: 'var(--spacing-md)' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>ペットの名前</label>
                        <input
                            type="text"
                            name="name"
                            value={profile.name}
                            onChange={handleChange}
                            className="input-field"
                            required
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>種類</label>
                            <select name="species" value={profile.species} onChange={handleChange} className="input-field">
                                <option value="dog">犬</option>
                                <option value="cat">猫</option>
                                <option value="other">その他</option>
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>性別</label>
                            <select name="gender" value={profile.gender} onChange={handleChange} className="input-field">
                                <option value="male">オス</option>
                                <option value="female">メス</option>
                            </select>
                        </div>
                    </div>

                    {profile.species === 'dog' && (
                        <div style={{ marginBottom: 'var(--spacing-md)' }}>
                            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>サイズ</label>
                            <select name="size" value={profile.size} onChange={handleChange} className="input-field">
                                <option value="small">小型犬</option>
                                <option value="medium">中型犬</option>
                                <option value="large">大型犬</option>
                            </select>
                        </div>
                    )}

                    <div style={{ marginBottom: 'var(--spacing-md)' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>品種</label>
                        <input type="text" name="breed" value={profile.breed} onChange={handleChange} className="input-field" />
                    </div>

                    <div style={{ marginBottom: 'var(--spacing-md)' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>生年月日</label>
                        <input
                            type="date"
                            name="birthdate"
                            value={profile.birthdate}
                            onChange={handleChange}
                            className="input-field"
                        />
                    </div>

                    <div style={{ marginBottom: 'var(--spacing-md)' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>飼い主名</label>
                        <input type="text" name="owner" value={profile.owner} onChange={handleChange} className="input-field" />
                    </div>

                    <div style={{ marginBottom: 'var(--spacing-md)' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>緊急連絡先 (電話)</label>
                        <input type="tel" name="phone" value={profile.phone} onChange={handleChange} className="input-field" />
                    </div>

                    <div style={{ marginBottom: 'var(--spacing-md)' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>かかりつけ医</label>
                        <input type="text" name="vet" value={profile.vet} onChange={handleChange} className="input-field" />
                    </div>

                    <div style={{ marginBottom: 'var(--spacing-md)' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>特記事項 (持病・薬など)</label>
                        <textarea name="notes" value={profile.notes} onChange={handleChange} className="input-field" rows="3"></textarea>
                    </div>

                    <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>保存する</button>
                    <button type="button" onClick={logout} className="btn" style={{ width: '100%', marginTop: 'var(--spacing-md)', backgroundColor: '#F3F4F6', color: '#4B5563', border: 'none' }}>
                        ログアウト
                    </button>
                </form>
            </div>
        );
    }

    return (
        <div className="profile-page">
            <h2 style={{ marginBottom: 'var(--spacing-md)' }}>マイ・ペット手帳</h2>

            <div className="card emergency-card" style={{ borderLeft: '4px solid var(--color-danger)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
                    <h3 style={{ margin: 0 }}>緊急カード</h3>
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-danger)', fontWeight: 'bold' }}>EMERGENCY INFO</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ color: 'var(--color-text-sub)', fontSize: '0.9rem' }}>名前</div>
                    <div style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>{profile.name}</div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ color: 'var(--color-text-sub)', fontSize: '0.9rem' }}>種類/品種</div>
                    <div>
                        {profile.species === 'dog' ? '犬' : profile.species === 'cat' ? '猫' : 'その他'}
                        {profile.species === 'dog' && ` (${profile.size === 'small' ? '小型' : profile.size === 'medium' ? '中型' : '大型'})`}
                        / {profile.breed}
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ color: 'var(--color-text-sub)', fontSize: '0.9rem' }}>性別/年齢</div>
                    <div>
                        {profile.gender === 'male' ? 'オス' : 'メス'} / {calculateAge(profile.birthdate)}
                        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-sub)', marginLeft: '8px' }}>({profile.birthdate})</span>
                    </div>
                </div>

                <hr style={{ margin: 'var(--spacing-md) 0', border: 'none', borderTop: '1px solid var(--color-border)' }} />

                <div style={{ marginBottom: '8px' }}>
                    <div style={{ color: 'var(--color-text-sub)', fontSize: '0.9rem' }}>飼い主</div>
                    <div style={{ fontWeight: 'bold' }}>{profile.owner}</div>
                </div>

                <div style={{ marginBottom: '8px' }}>
                    <div style={{ color: 'var(--color-text-sub)', fontSize: '0.9rem' }}>緊急連絡先</div>
                    <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{profile.phone}</div>
                </div>

                {profile.vet && (
                    <div style={{ marginBottom: '8px' }}>
                        <div style={{ color: 'var(--color-text-sub)', fontSize: '0.9rem' }}>かかりつけ医</div>
                        <div>{profile.vet}</div>
                    </div>
                )}

                {profile.notes && (
                    <div style={{ marginTop: 'var(--spacing-md)', padding: '8px', backgroundColor: '#FEF2F2', borderRadius: '4px', fontSize: '0.9rem' }}>
                        <strong>特記事項:</strong><br />
                        {profile.notes}
                    </div>
                )}
            </div>

            <div className="card" style={{ borderLeft: '4px solid var(--color-secondary)' }}>
                <h3 style={{ fontSize: '1rem', marginBottom: 'var(--spacing-sm)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>💡</span>
                    {profile.name}ちゃんへの防災アドバイス
                </h3>
                <p style={{ fontSize: '0.9rem', lineHeight: '1.6', color: 'var(--color-text-main)' }}>
                    {getDisasterAdvice(profile.size, profile.species)}
                </p>
            </div>

            <button onClick={() => setIsEditing(true)} className="btn btn-secondary" style={{ width: '100%' }}>
                編集する
            </button>
            <button onClick={logout} className="btn" style={{ width: '100%', marginTop: 'var(--spacing-md)', backgroundColor: '#F3F4F6', color: '#4B5563', border: 'none' }}>
                ログアウト
            </button>
        </div>
    );
};

export default Profile;
