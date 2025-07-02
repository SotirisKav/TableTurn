function Header() {
    return (
        <>
        <header className="header">
          <nav className="nav">
            <div className="nav-container">
              <a href="/" className="logo">AIchmi</a>
              <ul className="nav-links">
                <li><a href="/">Home</a></li>
                <li><a href="/reservation">Make Reservation</a></li>
                <li><a href="#about">About</a></li>
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