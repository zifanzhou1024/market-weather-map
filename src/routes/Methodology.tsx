export default function Methodology() {
  return (
    <main className="page-shell">
      <section className="page-heading">
        <p className="eyebrow">Methodology</p>
        <h2>How the map works</h2>
        <p>This static site explains market regimes. It does not provide financial advice.</p>
      </section>
      <div className="methodology-grid">
        <section className="panel">
          <h3>GitHub-only architecture</h3>
          <p>
            Public market datasets are fetched by scheduled GitHub Actions, normalized into static JSON under
            <code> public/data</code>, and served by the site without runtime provider credentials.
          </p>
        </section>
        <section className="panel">
          <h3>Score interpretation</h3>
          <p>
            The weather score combines volatility, rates, liquidity, and Fed-published financial stress and
            conditions indexes. Positive readings indicate more supportive conditions; deeply negative readings
            indicate fragile or stressed conditions.
          </p>
        </section>
        <section className="panel">
          <h3>Limitations</h3>
          <p>
            Inputs are delayed public data and may be stale, revised, or unavailable. The score is a descriptive
            dashboard signal only, not a forecast, recommendation, or financial advice.
          </p>
        </section>
      </div>
    </main>
  );
}
