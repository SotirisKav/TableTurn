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

function DoBusiness() {
  return (
    <>
      {/* Sine line divider above the section */}
      <SineLineDivider height={32} color="#0a2c6b" speed={0.018} strokeWidth={3} />
      
      <section className="do-business-section">
        <div className="do-business-content">
          <h2 className="business-title">Ready to Join AICHMI's Digital Revolution?</h2>
          <p className="business-subtitle">
            Transform your restaurant's online presence and connect with thousands of hungry customers across Greece
          </p>
          
          <a href="/subscriptions" className="cta-button primary business-cta-button">
            Start Your Journey
          </a>
          
          <p className="business-note">
            Join 50+ restaurants already using AICHMI
          </p>
        </div>
      </section>
    </>
  );
}

export default DoBusiness;