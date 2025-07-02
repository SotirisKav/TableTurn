import { useState, useEffect } from 'react';

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

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentImageIndex((prevIndex) => 
                prevIndex === heroImages.length - 1 ? 0 : prevIndex + 1
            );
        }, 8000); //change img every 8 seconds

        return () => clearInterval(interval);
    }, [heroImages.length]);

    return (
        <>
        <section className="hero">
          <div className="hero-image">
            {heroImages.map((image, index) => (
                <img 
                    key={index}
                    src={image.url} 
                    alt={image.alt}
                    className={`hero-slide ${index === currentImageIndex ? 'active' : ''}`}
                    loading={index === 0 ? "eager" : "lazy"}
                />
            ))}
          </div>
          <div className="hero-overlay">
            <div className="hero-content" style={{ color: currentImageIndex === 2 ? 'var(--aegean-blue)' : 'white' }}>
              <h1 className="hero-title">Welcome to AIchmi - Booking Service</h1>
              <p className="hero-subtitle">Experience authentic Greek dining on the enchanting island of Kos</p>
              <a href="/browse-restaurants" className="cta-button primary">Browse Restaurants</a>
            </div>
          </div>
        </section>
        </>
    );
}

export default HeroSection;