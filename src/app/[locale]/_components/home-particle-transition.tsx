// 对接 #47：文章区使用 id="featured-articles" 和 data-home-motion="featured-articles"，作品区使用 data-home-motion="home-projects"；本组件放在两者之间。
export function HomeParticleTransition() {
  return (
    <section
      className="home-particle-transition"
      data-home-motion="particle-transition"
      aria-labelledby="home-particle-transition-title"
    >
      <div className="home-particle-transition__copy">
        <h2 id="home-particle-transition-title">
          从一个想法，
          <span>到真正可用的产品。</span>
        </h2>
        <p>用设计理清体验，用代码完成落地。</p>
      </div>
    </section>
  );
}
