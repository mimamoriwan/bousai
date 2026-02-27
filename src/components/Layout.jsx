import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Layout.css';

const Layout = () => {
    const location = useLocation();
    const { currentUser, memberNumber } = useAuth();

    const isActive = (path) => {
        if (path === '/profile' && location.pathname === '/mypage') return 'nav-item active';
        if (path === '/' && location.pathname === '/report') return 'nav-item active';
        return location.pathname === path ? 'nav-item active' : 'nav-item';
    };

    const isMapPage = location.pathname === '/' || location.pathname === '/report';

    return (
        <div className="app-layout">
            <header className="app-header">
                <h1>みまもりWAN</h1>
                <div className="member-badge">
                    {currentUser && !currentUser.isAnonymous && memberNumber
                        ? `みまもり隊員：No.${String(memberNumber).padStart(3, '0')}`
                        : 'みまもり隊員見習い'}
                </div>
            </header>

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
