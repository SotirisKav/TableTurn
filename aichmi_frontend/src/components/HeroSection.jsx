import { useState, useEffect, useRef } from 'react';
import '../styles/HeroSection.css';

function HeroSection() {
    //array of hero images 
    const heroImages = [
        {
            url: "https://imageresizer.yachtsbt.com/blog/images/Kos/iStock-1436672557.jpg?method=crop&width=1700&height=1275&format=jpeg",
            alt: "Traditional Greek restaurant terrace overlooking the Aegean Sea"
        },
        {
            url: "https://media.tacdn.com/media/photo-m/1280/29/a7/8c/40/caption.jpg",
            alt: "Beautiful sunset view over Kos Island with traditional Greek taverna by the sea"
        },
        {
            url: "https://a.travel-assets.com/findyours-php/viewfinder/images/res70/73000/73439-Kos.jpg",
            alt: "Greek cuisine and dining experience in Kos"
        }
    ];

    const textColours = [
        "#ffffff", // white
        "#f0f0f0", // light grey
        "#e0e0e0"  // lighter grey
    ]
    
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const heroContentRef = useRef(null);
    const [wavePhase, setWavePhase] = useState(0);
    const [wind, setWind] = useState(0);
    const windRef = useRef(0);
    const animationFrameRef = useRef();
    const lastMouseX = useRef(null);
    const lastTime = useRef(null);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentImageIndex((prevIndex) => 
                prevIndex === heroImages.length - 1 ? 0 : prevIndex + 1
            );
        }, 8000);

        if (heroContentRef.current) {
            heroContentRef.current.classList.add('fade-in-hero');
        }

        // Animate the wave: slower, more random, left-to-right
        function animateWave() {
            setWavePhase(prev => prev + 0.012); // slower
            windRef.current *= 0.97; // even more subtle inertia
            setWind(windRef.current);
            animationFrameRef.current = requestAnimationFrame(animateWave);
        }
        animationFrameRef.current = requestAnimationFrame(animateWave);

        // Wind effect on mouse movement velocity
        const handleMouseMove = (e) => {
            const x = e.clientX || (e.touches && e.touches[0].clientX) || 0;
            const now = performance.now();
            if (lastMouseX.current !== null && lastTime.current !== null) {
                const dx = x - lastMouseX.current;
                const dt = now - lastTime.current;
                if (dt > 0) {
                    // Velocity in px/ms, scale for effect
                    const velocity = dx / dt;
                    // Clamp and scale for realism
                    const gust = Math.max(-1, Math.min(1, velocity)) * 12; // much more subtle
                    // Add gust to wind (inertia will decay it)
                    windRef.current += gust;
                }
            }
            lastMouseX.current = x;
            lastTime.current = now;
        };
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('touchmove', handleMouseMove);
        return () => {
            clearInterval(interval);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('touchmove', handleMouseMove);
            cancelAnimationFrame(animationFrameRef.current);
        };
    }, [heroImages.length]);

    // Generate more random wave path (sum of 3 sine waves)
    function getWavePath(phase, wind) {
        const amplitude1 = 18 + wind * 0.2;
        const amplitude2 = 7 + wind * 0.08;
        const amplitude3 = 4 + wind * 0.05;
        const freq1 = 2 * Math.PI / 1440 * 2; // 2 full waves
        const freq2 = 2 * Math.PI / 1440 * 3.5; // 3.5 full waves
        const freq3 = 2 * Math.PI / 1440 * 7; // 7 full waves
        let path = `M0,80`;
        for (let x = 0; x <= 1440; x += 20) {
            const y = 80
                + Math.sin(freq1 * x + phase) * amplitude1
                + Math.sin(freq2 * x + phase * 1.7) * amplitude2
                + Math.sin(freq3 * x + phase * 2.3) * amplitude3;
            path += ` L${x},${y}`;
        }
        path += ' L1440,120 L0,120 Z';
        return path;
    }

    return (
        <>
        <section className="hero no-hero-gap" aria-label="Aichmi Hero Section">
          <div className="hero-image parallax-bg">
            {heroImages.map((image, index) => (
                <img 
                    key={index}
                    src={image.url} 
                    alt={image.alt}
                    className={`hero-slide ${index === currentImageIndex ? 'active' : ''}`}
                    loading={index === 0 ? "eager" : "lazy"}
                />
            ))}
            {/* Ensure overlay is flush with image by placing overlay inside hero-image */}
            <div className="hero-overlay">
              <div ref={heroContentRef} className="hero-content" style={{ color: currentImageIndex === 2 ? 'var(--aegean-blue)' : 'white' }}>
                <h1 className="hero-title">Welcome to AIchmi - Booking Service</h1>
                <p className="hero-subtitle">Experience authentic Greek dining on the enchanting island of Kos</p>
                <a href="/browse-restaurants" className="cta-button primary hero-cta" tabIndex={0} aria-label="Browse Restaurants">Browse Restaurants</a>
              </div>
            </div>
            {/* Animated & interactive SVG wave at the bottom, moved further down */}
            <div className="hero-wave" aria-hidden="true" style={{ bottom: '-30px' }}>
              <svg viewBox="0 0 1440 120" width="100%" height="110" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
                <path d={getWavePath(wavePhase, wind)} fill="#e0f2fe"/>
              </svg>
            </div>
          </div>
        </section>
        </>
    );
}

export default HeroSection;