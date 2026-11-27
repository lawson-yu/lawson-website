export function HomeParticleTransition() {
  return (
    <section
      className="particle-transition home-particle-transition"
      data-screen="transition"
      data-home-motion="particle-transition"
      aria-labelledby="home-particle-transition-title"
    >
      <div className="particle-transition__pin">
        <div className="particle-transition__copy">
          <h2 id="home-particle-transition-title">
            <span>从一个想法，<span className="particle-transition__capsule" aria-hidden="true" /></span>
            <span>到真正<em>可用的产品。</em></span>
          </h2>
          <p>用设计理清体验，用代码完成落地。</p>
        </div>
      </div>
    </section>
  );
}
