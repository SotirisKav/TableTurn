import { useEffect, useMemo, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const ScrollDescription = ({
  children,
  scrollContainerRef,
  containerClassName = "",
  textClassName = "",
  animationDuration = 1.5,
  ease = 'power2.out',
  scrollStart = 'top bottom-=50px',
  scrollEnd = 'bottom center+=150px',
  stagger = 0.015
}) => {
  const containerRef = useRef(null);

  const splitText = useMemo(() => {
    const text = typeof children === 'string' ? children : '';
    // Split by words and preserve spaces properly
    const words = text.split(/(\s+)/);
    return words.map((segment, index) => {
      if (segment.match(/\s+/)) {
        // This is whitespace
        return <span className="word-space" key={index}>{segment}</span>;
      } else {
        // This is a word
        return <span className="word" key={index}>{segment}</span>;
      }
    });
  }, [children]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    ScrollTrigger.refresh();

    const wordElements = el.querySelectorAll('.word');

    // Set initial state - make sure they're completely hidden
    gsap.set(wordElements, {
      opacity: 0,
      yPercent: 80,
      scale: 0.8,
      transformOrigin: '50% 50%'
    });

    // Create the animation with delayed start
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: el,
        start: scrollStart,
        end: scrollEnd,
        scrub: 2,
        markers: false,
        onUpdate: self => {
          const progress = self.progress;
          // Only start animating when we're 30% through the scroll trigger
          const adjustedProgress = Math.max(0, (progress - 0.3) / 0.7);
          
          gsap.to(wordElements, {
            duration: 0.1,
            opacity: adjustedProgress > 0 ? Math.min(1, adjustedProgress * 1.5) : 0,
            yPercent: 80 - (80 * adjustedProgress),
            scale: 0.8 + (0.2 * adjustedProgress),
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
    <div ref={containerRef} className={`scroll-description ${containerClassName}`}>
      <div className={`scroll-description-text ${textClassName}`}>
        {splitText}
      </div>
    </div>
  );
};

export default ScrollDescription;