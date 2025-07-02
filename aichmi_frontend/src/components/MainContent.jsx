import { useEffect, useRef } from 'react';

function MainContent() {
    // Refs for animation
    const howStepsRef = useRef([]);
    const testimonialRef = useRef(null);

    useEffect(() => {
        // Intersection Observer for How It Works steps
        const observer = new window.IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                entry.target.classList.add('visible');
              }
            });
          },
          { threshold: 0.2 }
        );
        howStepsRef.current.forEach((el) => el && observer.observe(el));
        if (testimonialRef.current) observer.observe(testimonialRef.current);
        return () => {
          howStepsRef.current.forEach((el) => el && observer.unobserve(el));
          if (testimonialRef.current) observer.unobserve(testimonialRef.current);
        };
    }, []);
    return (
        <>
        <main className="main">
          <section className="about-section" id="about">
            <div className="container">
              <div className="about-content fade-in">
                <h2>Discover Aichmi</h2>
                <p>AICHMI connects you to top Greek restaurants and venues, offering seamless AI-powered reservations for any occasion — romantic dinners, celebrations, or group events. Start your journey to unforgettable dining today.</p>
                <a href="/browse-restaurants" className="cta-button secondary">Explore Restaurants</a>
              </div>
            </div>
          </section>

          {/* Greek key/meander divider */}
          <div className="greek-divider" aria-hidden="true">
            <svg width="100%" height="24" viewBox="0 0 600 24" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
              <path d="M0 12 H24 V0 H48 V24 H72 V0 H96 V24 H120 V0 H144 V24 H168 V0 H192 V24 H216 V0 H240 V24 H264 V0 H288 V24 H312 V0 H336 V24 H360 V0 H384 V24 H408 V0 H432 V24 H456 V0 H480 V24 H504 V0 H528 V24 H552 V0 H576 V24 H600" stroke="#1e3a8a" strokeWidth="2"/>
            </svg>
          </div>

          {/* How It Works Section */}
          <section className="how-it-works-section">
            <div className="container">
              <h3 className="how-title">How It Works</h3>
              <div className="how-steps">
                <div className="how-step fade-in-step" ref={el => howStepsRef.current[0] = el}>
                  <div className="how-icon">
                    {/* Magnifying glass icon */}
                    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="16" r="10" stroke="#1e3a8a" strokeWidth="2"/><line x1="25" y1="25" x2="34" y2="34" stroke="#1e3a8a" strokeWidth="2" strokeLinecap="round"/></svg>
                  </div>
                  <h4>Browse</h4>
                  <p>Explore curated Greek restaurants and venues across Kos.</p>
                </div>
                <div className="how-step fade-in-step" ref={el => howStepsRef.current[1] = el}>
                  <div className="how-icon">
                    {/* Calendar icon */}
                    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="10" width="24" height="18" rx="3" stroke="#1e3a8a" strokeWidth="2"/><rect x="12" y="16" width="6" height="6" rx="1" fill="#1e3a8a"/><rect x="22" y="16" width="6" height="6" rx="1" fill="#e0f2fe" stroke="#1e3a8a" strokeWidth="1"/></svg>
                  </div>
                  <h4>Reserve</h4>
                  <p>Book your table in seconds with a seamless, elegant form.</p>
                </div>
                <div className="how-step fade-in-step" ref={el => howStepsRef.current[2] = el}>
                  <div className="how-icon">
                    {/* Plate/cutlery icon */}
                    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="18" cy="18" r="10" stroke="#1e3a8a" strokeWidth="2"/><rect x="16" y="10" width="4" height="12" rx="2" fill="#1e3a8a"/><rect x="10" y="16" width="2" height="8" rx="1" fill="#e0f2fe" stroke="#1e3a8a" strokeWidth="1"/><rect x="24" y="16" width="2" height="8" rx="1" fill="#e0f2fe" stroke="#1e3a8a" strokeWidth="1"/></svg>
                  </div>
                  <h4>Enjoy</h4>
                  <p>Arrive and savor authentic Greek hospitality, stress-free.</p>
                </div>
              </div>
            </div>
          </section>
        </main>
        </>
    );
}

export default MainContent;