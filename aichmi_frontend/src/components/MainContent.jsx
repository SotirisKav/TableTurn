import React, { useRef, useEffect } from 'react';

// SineLineDivider: animated sine line (not filled)
const SineLineDivider = ({ height = 32, color = '#0a2c6b', speed = 0.018, strokeWidth = 3 }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let width = canvas.parentElement.offsetWidth;
    let t = 0;
    let animationId;

    const handleResize = () => {
      width = canvas.parentElement.offsetWidth;
      canvas.width = width;
      canvas.height = height;
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    function drawSineLine() {
      ctx.clearRect(0, 0, width, height);
      ctx.beginPath();
      for (let x = 0; x <= width; x += 2) {
        const y = height / 2 + Math.sin((x / width) * 4 * Math.PI + t) * (height / 2.5);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    function animate() {
      t += speed;
      drawSineLine();
      animationId = requestAnimationFrame(animate);
    }
    animate();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
    };
  }, [height, color, speed, strokeWidth]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: `${height}px`, display: 'block', background: 'transparent' }}
      height={height}
    />
  );
};

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
          {/* Sine line divider above How it Works */}
          <SineLineDivider height={32} color="#0a2c6b" speed={0.018} strokeWidth={3} />


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
    );
}

export default MainContent;