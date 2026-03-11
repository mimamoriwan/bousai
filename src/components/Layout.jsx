import { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { MdQrCodeScanner, MdClose } from 'react-icons/md';
import './Layout.css';

const Layout = () => {
    const location = useLocation();
    const { currentUser, memberNumber } = useAuth();

    const [showQrModal, setShowQrModal] = useState(false);

    const isActive = (path) => {
        if (path === '/profile' && location.pathname === '/mypage') return 'nav-item active';
        if (path === '/' && location.pathname === '/report') return 'nav-item active';
        return location.pathname === path ? 'nav-item active' : 'nav-item';
    };

    const isMapPage = location.pathname === '/' || location.pathname === '/report';

    return (
        <div className="app-layout">
            <header className="app-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '0 16px' }}>
                {/* Left: QR Code Icon */}
                <button
                    onClick={() => setShowQrModal(true)}
                    style={{ background: 'transparent', border: 'none', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', padding: '8px 0', cursor: 'pointer', flex: 1 }}
                    aria-label="LINE公式アカウントのQRコードを表示"
                >
                    <MdQrCodeScanner size={28} />
                </button>

                {/* Center: Logo / Title */}
                <h1 style={{ flex: 2, textAlign: 'center', margin: 0, fontSize: '1.25rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    みまもりWAN
                </h1>

                {/* Right: Member Badge */}
                <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                    <div className="member-badge">
                        {currentUser && !currentUser.isAnonymous && memberNumber
                            ? `No.${String(memberNumber).padStart(6, '0')}`
                            : '見習い'}
                    </div>
                </div>
            </header>

            {/* QR Code Modal (Sibling to header/main) */}
            {showQrModal && (
                <div
                    onClick={() => setShowQrModal(false)}
                    style={{
                        position: 'fixed',
                        top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.7)',
                        zIndex: 10000, // Very high to cover everything
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'column',
                        animation: 'fadeIn 0.2s ease-in'
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()} // Prevent clicking the image from closing the modal
                        style={{
                            backgroundColor: 'white',
                            padding: '24px',
                            borderRadius: '16px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            maxWidth: '80%',
                            position: 'relative',
                            boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
                        }}
                    >
                        <button
                            onClick={() => setShowQrModal(false)}
                            style={{
                                position: 'absolute',
                                top: '8px',
                                right: '8px',
                                background: '#f3f4f6',
                                border: '1px solid #e5e7eb',
                                borderRadius: '50%',
                                width: '32px',
                                height: '32px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                color: '#4b5563'
                            }}
                        >
                            <MdClose size={20} />
                        </button>
                        <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: '#1f2937' }}>お友達追加はこちら🐾</h3>
                        <img
                            src="/line_qr.png"
                            alt="みまもりWANのLINE公式アカウントQRコード"
                            style={{ width: '200px', height: '200px', maxWidth: '100%', objectFit: 'contain', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                            onError={(e) => {
                                // Fallback placeholder if image doesn't exist yet
                                e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect fill="%23f3f4f6" width="200" height="200"/><text fill="%239ca3af" font-family="sans-serif" font-size="16" dy="10.5" font-weight="bold" x="50%" y="50%" text-anchor="middle">QR Image Placeholder</text></svg>';
                            }}
                        />
                        <p style={{ marginTop: '16px', fontSize: '0.85rem', color: '#6b7280', textAlign: 'center', marginBottom: 0 }}>
                            カメラアプリやLINEで<br />読み取ってください
                        </p>
                    </div>
                </div>
            )}

            <main className={`app-content ${isMapPage ? 'map-container-main' : 'scroll-page-main'}`}>
                <Outlet />
            </main>

            <nav className="bottom-nav">
                <Link to="/profile" className={isActive('/profile')}>
                    <span className="nav-icon">🐾</span>
                    <span className="nav-label">マイページ</span>
                </Link>
                <Link to="/" className={isActive('/')}>
                    <span className="nav-icon">🗺️</span>
                    <span className="nav-label">マップ</span>
                </Link>
                <Link to="/guide" className={isActive('/guide')}>
                    <span className="nav-icon">📖</span>
                    <span className="nav-label">ガイド</span>
                </Link>
            </nav>
        </div>
    );
};

export default Layout;
