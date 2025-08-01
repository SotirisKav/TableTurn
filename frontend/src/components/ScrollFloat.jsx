import { useEffect, useMemo, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const ScrollFloat = ({
  children,
  scrollContainerRef,
  containerClassName = "",
  textClassName = "",
  animationDuration = 1,
  ease = 'back.out(1.7)',
  scrollStart = 'top bottom-=100px',
  scrollEnd = 'bottom center',
  stagger = 0.05
}) => {
  const containerRef = useRef(null);

  const splitText = useMemo(() => {
    const text = typeof children === 'string' ? children : '';
    return text.split("").map((char, index) => (
      <span className="char" key={index}>
        {char === " " ? "\u00A0" : char}
      </span>
    ));
  }, [children]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Refresh ScrollTrigger to ensure proper detection
    ScrollTrigger.refresh();

    const charElements = el.querySelectorAll('.char');

    // Set initial state
    gsap.set(charElements, {
      opacity: 0,
      yPercent: 120,
      scaleY: 2.3,
      scaleX: 0.7,
      transformOrigin: '50% 0%'
    });

    // Create the animation
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: el,
        start: scrollStart,
        end: scrollEnd,
        scrub: 1,
        markers: false, // Set to true for debugging
        onUpdate: self => {
          // Force animation based on scroll progress
          const progress = self.progress;
          gsap.to(charElements, {
            duration: 0.1,
            opacity: progress > 0.1 ? 1 : 0,
            yPercent: 120 - (120 * progress),
            scaleY: 2.3 - (1.3 * progress),
            scaleX: 0.7 + (0.3 * progress),
            stagger: stagger,
            ease: "none"
          });
        }
      }
    });

    return () => {
      tl.kill();
      ScrollTrigger.getAll().forEach(trigger => {
        if (trigger.trigger === el) {
          trigger.kill();
        }
      });
    };
  }, [scrollContainerRef, animationDuration, ease, scrollStart, scrollEnd, stagger]);

  return (
    <h2 ref={containerRef} className={`scroll-float ${containerClassName}`}>
      <span className={`scroll-float-text ${textClassName}`}>
        {splitText}
      </span>
    </h2>
  );
};

export default ScrollFloat;