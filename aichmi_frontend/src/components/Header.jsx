import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';

function Header() {
    const [user, setUser] = useState(null);

    useEffect(() => {
        // Check if user is logged in
        const userData = localStorage.getItem('user');
        if (userData) {
            setUser(JSON.parse(userData));
        }
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        setUser(null);
        window.location.href = '/';
    };

    return (
        <header className="header">
          <nav className="nav">
            <div className="nav-container">
              <Link to="/" className="logo">AIchmi</Link>
              <ul className="nav-links">
                <li><Link to="/">Home</Link></li>
                <li><Link to="/browse-restaurants">Browse Restaurants</Link></li>
                <li><Link to="/about">About</Link></li>
                {user ? (
                  <>
                    <li><Link to="/dashboard">Dashboard</Link></li>
                    <li>
                      <button onClick={handleLogout} className="nav-logout-btn">
                        Log Out
                      </button>
                    </li>
                  </>
                ) : (
                  <li>
                    <Link to="/login" className="nav-owner-login">
                      <span className="owner-login-text">Log In</span>
                      <span className="owner-login-subtitle">(Restaurant owners only)</span>
                    </Link>
                  </li>
                )}
              </ul>
              <button className="mobile-menu-toggle" aria-label="Toggle menu">
                <span></span>
                <span></span>
                <span></span>
              </button>
            </div>
          </nav>
        </header>
    );
}

export default Header;