import { Outlet, Link, useLocation } from 'react-router-dom';
import './Layout.css';

const Layout = () => {
    const location = useLocation();

    const isActive = (path) => {
        return location.pathname === path ? 'nav-item active' : 'nav-item';
    };

    return (
        <div className="app-layout">
            <header className="app-header">
                <h1>みまもりWAN</h1>
            </header>

            <main className="app-content">
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
