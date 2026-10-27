'use client';

export default function OverallFeedback({ feedback }) {
  if (!feedback) return null;
  const {
    summary, strengths = [], areas_for_improvement: areas = [], priority_recommendations: priorities = [],
    practice_suggestions: practice = [], estimated_level: level, level_disclaimer: disclaimer,
  } = feedback;

  return (
    <div className="si-feedback">
      <div className="si-feedback-top">
        {summary && <p className="si-feedback-summary">{summary}</p>}
        {level && (
          <div className="si-level-card">
            <small>Informal level estimate</small>
            <strong>{level}</strong>
            <p>{disclaimer}</p>
          </div>
        )}
      </div>

      <div className="si-feedback-grid">
        <section className="si-fb-block tone-good">
          <h3><span aria-hidden="true">✓</span> Strengths</h3>
          {strengths.length ? <ul>{strengths.map((s, i) => <li key={i}>{s}</li>)}</ul> : <p className="si-muted">—</p>}
        </section>
        <section className="si-fb-block tone-work">
          <h3><span aria-hidden="true">↗</span> Areas for improvement</h3>
          {areas.length ? <ul>{areas.map((s, i) => <li key={i}>{s}</li>)}</ul> : <p className="si-muted">—</p>}
        </section>
      </div>

      {priorities.length > 0 && (
        <section className="si-fb-block si-priorities">
          <h3><span aria-hidden="true">★</span> Priority recommendations</h3>
          <ol>{priorities.map((s, i) => <li key={i}>{s}</li>)}</ol>
        </section>
      )}

      {practice.length > 0 && (
        <section className="si-practice">
          <h3>Practice next</h3>
          <div className="si-practice-grid">
            {practice.map((p, i) => (
              <article key={i} className="si-practice-card">
                <span className="si-practice-num">{i + 1}</span>
                <h4>{p.title}</h4>
                <p>{p.instructions}</p>
                {p.example && <blockquote lang="pt-BR">{p.example}</blockquote>}
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
