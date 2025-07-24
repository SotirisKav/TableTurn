import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';

function Header() {
    const [user, setUser] = useState(null);
    const [userInfo, setUserInfo] = useState(null);

    useEffect(() => {
        // Check if user is logged in
        const userData = localStorage.getItem('user');
        const token = localStorage.getItem('accessToken');
        
        if (userData && token) {
            setUser(JSON.parse(userData));
            
            // Fetch additional user info for dashboard access
            fetch('/api/dashboard/user-info', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })
            .then(res => res.json())
            .then(data => {
                if (!data.error) {
                    setUserInfo(data);
                }
            })
            .catch(console.error);
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
                {user && userInfo ? (
                  <>
                    <li>
                      <Link to={`/dashboard/${userInfo.restaurantId}`} className="nav-dashboard">
                        Dashboard
                        {userInfo.role === 'admin' && <span className="admin-badge">Admin</span>}
                      </Link>
                    </li>
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