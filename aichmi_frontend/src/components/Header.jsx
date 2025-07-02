import { Link } from 'react-router-dom';

function Header() {
    return (
        <>
        <header className="header">
          <nav className="nav">
            <div className="nav-container">
              <a href="/" className="logo">AIchmi</a>
              <ul className="nav-links">
                <li><Link to="/">Home</Link></li>
                <li><Link to="/browse-restaurants">Browse Restaurants</Link></li>
                <li><Link to="/about">About</Link></li>
              </ul>
              <button className="mobile-menu-toggle" aria-label="Toggle menu">
                <span></span>
                <span></span>
                <span></span>
              </button>
            </div>
          </nav>
        </header>
        </>
    );
}

export default Header;