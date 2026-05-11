import { getBrandImageLabel } from "../core/Reputation.ts";

export function renderReputationPanel(state) {
  const s = state.stats;
  return `
    <section class="panel-section">
      <h2>Trust and Risk</h2>
      <div class="stat-grid">
        ${stat("Public Reputation", s.publicReputation)}
        ${stat("Industry Honor", s.industryHonor)}
        ${stat("Brand Image", s.brandImage)}
        ${stat("Legal Risk", s.legalRisk, true)}
        ${stat("Avg Satisfaction", s.customerSatisfactionAverage)}
        ${stat("Calibration Accuracy", s.calibrationAccuracy)}
        ${stat("Tool Condition", s.toolCondition)}
        ${stat("Cleanliness", s.storeCleanliness)}
      </div>
      <p class="quote">Brand identity: ${getBrandImageLabel(s.brandImage)}</p>
      <h3>Reviews</h3>
      <ul class="review-list">
        ${state.reviews.slice(0, 8).map((review) => `
          <li>
            <strong>${review.score}/100</strong>
            <span>${review.text}</span>
            <small>Day ${review.day || state.day} | ${review.customerLabel || "customer"}</small>
          </li>
        `).join("") || "<li>No reviews yet. Peaceful, in a suspiciously quiet way.</li>"}
      </ul>
      <h3>Incidents</h3>
      <ul class="fact-list">
        ${state.incidents.slice(0, 5).map((incident) => `<li>${incident.title}: ${incident.description}</li>`).join("") || "<li>No public incidents yet.</li>"}
      </ul>
    </section>
  `;
}

function stat(label, value, inverse = false) {
  const pct = Math.max(0, Math.min(100, value));
  const color = inverse ? `hsl(${120 - pct * 1.2} 58% 40%)` : `hsl(${pct * 1.2} 58% 36%)`;
  return `
    <div class="stat">
      <span>${label}</span>
      <strong>${Math.round(value)}</strong>
      <i style="--bar:${pct}%;--color:${color}"></i>
    </div>
  `;
}
