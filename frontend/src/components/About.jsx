function About() {
  return (
    <div className="about-page">
      <div className="about-container">
        <h1 className="about-title">Our Story</h1>
        <p className="about-lead">TableTurn was started by two friends with a shared love for Greek culture, food, and technology.</p>
        <div className="about-divider">
          <svg viewBox="0 0 120 18" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M0 9 H12 V0 H24 V18 H36 V0 H48 V18 H60 V0 H72 V18 H84 V0 H96 V18 H108 V0 H120" stroke="#1e3a8a" strokeWidth="2"/></svg>
        </div>
        <div className="about-body">
          <p>
            On a sunlit evening in Kos, we realized how hard it was for travelers and locals alike to discover authentic Greek venues and make reservations without hassle. We wanted to create something that felt local, thoughtful, and modern—something that would make every booking feel as warm as a Greek welcome.
          </p>
          <p>
            With backgrounds in software and hospitality, we set out to build TableTurn: a platform that connects people to the best of Greece, powered by elegant design and smart technology. Our journey began with a handful of restaurants and a simple idea: make booking seamless, beautiful, and personal.
          </p>
          <p>
            Today, TableTurn is growing to include not just restaurants, but unique venues and festivals across Greece. Our mission is to bring unforgettable Greek moments to everyone, everywhere—one reservation at a time.
          </p>
          <p className="about-signature">— The TableTurn Founders</p>
        </div>
      </div>
    </div>
  );
}

export default About; 