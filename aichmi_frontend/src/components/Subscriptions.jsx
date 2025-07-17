import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import ScrollFloat from './ScrollFloat';
import ScrollDescription from './ScrollDescription'; // Add this import

gsap.registerPlugin(ScrollTrigger);

function Subscriptions() {
  const navigate = useNavigate();
  const [isSelected, setIsSelected] = useState(false);
  const scrollContainerRef = useRef(null);

  useEffect(() => {
    ScrollTrigger.refresh();
  }, []);

  const plan = {
    id: 'professional',
    name: 'Professional',
    price: '79',
    period: 'month',
    features: [
      'Advanced AI with custom responses',
      'Unlimited bookings',
      'Priority support',
      'Advanced analytics & insights',
      'Custom branding options',
      'Multi-language support',
      'Integration with existing systems',
      'Mobile-friendly booking pages',
      'Real-time availability updates'
    ]
  };

  const handlePlanSelect = () => {
    setIsSelected(true);
    alert(`You selected the ${plan.name} plan for €${plan.price}/${plan.period}. Payment integration coming soon!`);
  };

  const benefits = [
    {
      title: "AI-Powered Efficiency",
      description: "Our intelligent system handles reservations 24/7, reducing staff workload and increasing customer satisfaction while providing seamless booking experiences for your guests."
    },
    {
      title: "Modern User Experience",
      description: "Beautiful, mobile-first design that converts visitors into customers with smooth booking flows, ensuring your restaurant stands out in the digital landscape."
    },
    {
      title: "Data-Driven Insights",
      description: "Understand your customers better with detailed analytics and booking pattern insights that help you optimize operations and increase revenue."
    },
    {
      title: "Local Expertise",
      description: "Built specifically for Greek hospitality, understanding local culture and customer expectations to provide authentic experiences that resonate with both locals and tourists."
    }
  ];

  return (
    <div className="subscriptions-page" ref={scrollContainerRef}>
      <div className="container">
        <div className="subscriptions-hero">
          <h1 className="subscriptions-title">Partner with AICHMI</h1>
          <p className="subscriptions-subtitle">
            Transform your restaurant's digital presence and join Greece's most innovative booking platform
          </p>
          
          <div className="subscriptions-stats">
            <div className="stat-item">
              <span className="stat-number">50+</span>
              <span className="stat-label">Partner Restaurants</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">10K+</span>
              <span className="stat-label">Monthly Bookings</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">95%</span>
              <span className="stat-label">Customer Satisfaction</span>
            </div>
          </div>
        </div>

        <div className="wave-separator">
          <svg viewBox="0 0 1200 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="m0,60c150,0 271,-40 600,-40s450,40 600,40v60H0z" fill="var(--cream)"></path>
          </svg>
        </div>

        <div className="pricing-section">
          <h2 className="pricing-title">Choose Your Plan</h2>
          <p className="pricing-subtitle">Start your digital transformation today</p>
          
          <div className="single-plan-container">
            <div className={`pricing-card single ${isSelected ? 'selected' : ''}`}>
              <div className="popular-badge">Most Popular</div>
              
              <div className="plan-header">
                <h3 className="plan-name">{plan.name}</h3>
                <div className="plan-price">
                  <span className="price-amount">€{plan.price}</span>
                  <span className="price-period">/{plan.period}</span>
                </div>
              </div>
              
              <ul className="plan-features">
                {plan.features.map((feature, index) => (
                  <li key={index} className="feature-item">
                    <span className="feature-check">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
              
              <button 
                className="cta-button primary plan-button"
                onClick={handlePlanSelect}
              >
                Get Started
              </button>
            </div>
          </div>
        </div>

        <div className="subscriptions-benefits">
        <h2 className="benefits-title">Why Choose AICHMI?</h2>

        <div className="benefits-content">
          {benefits.map((benefit, index) => (
            <div key={index} className="benefit-block">
              <ScrollFloat
                scrollContainerRef={scrollContainerRef}
                containerClassName="benefit-title-container"
                textClassName="benefit-title-text"
                animationDuration={1.2}
                ease="back.out(1.7)"
                scrollStart="top bottom-=150px"
                scrollEnd="center center-=50px"
                stagger={0.03}
              >
                {benefit.title}
              </ScrollFloat>
              <ScrollDescription
                scrollContainerRef={scrollContainerRef}
                containerClassName="benefit-description-container"
                textClassName="benefit-description-text"
                animationDuration={2}
                ease="power2.out"
                scrollStart="center center+=100px"
                scrollEnd="bottom center+=200px"
                stagger={0.015}
              >
                {benefit.description}
                </ScrollDescription>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Subscriptions;