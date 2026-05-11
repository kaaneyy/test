import { getAvailableQuestions, getServiceForCustomer, recommendInventory, chooseRecommendedAccessories } from "../core/Customers.ts";

export function renderDialoguePanel(state) {
  const customer = state.activeCustomer;
  if (!customer) {
    return `
      <section class="panel-section">
        <h2>Counter</h2>
        <p>No customer is at the counter yet. Open the store or wait for the next walk-in.</p>
        <button data-action="spawn-customer">Call next customer</button>
      </section>
    `;
  }
  const questions = getAvailableQuestions(customer).slice(0, 8);
  const recommendations = recommendInventory(state, customer);
  const top = recommendations[0]?.item;
  const service = getServiceForCustomer(customer);
  const accessories = top ? chooseRecommendedAccessories(state, customer, top, 3) : [];
  return `
    <section class="panel-section">
      <h2>${customer.name}</h2>
      <div class="pill-row">
        <span class="pill">${customer.label}</span>
        <span class="pill">Mood ${Math.round(customer.mood)}</span>
        <span class="pill">Patience ${Math.round(customer.patienceRemaining)}</span>
        <span class="pill">Satisfaction ${Math.round(customer.satisfaction)}</span>
      </div>
      <p class="quote">"${customer.opener}"</p>
      <div class="subgrid">
        <div>
          <h3>Ask</h3>
          <div class="button-stack">
            ${questions.map((q) => `<button data-action="ask-question" data-id="${q.id}" title="${q.tags.join(", ")}">${q.text}</button>`).join("")}
          </div>
        </div>
        <div>
          <h3>Discovered</h3>
          <ul class="fact-list">
            ${customer.discoveredFacts.slice(-7).map((fact) => `<li>${fact}</li>`).join("")}
          </ul>
        </div>
      </div>
      <h3>Recommend</h3>
      <button data-action="pitch-special">Pitch as special edition</button>
      <div class="recommendations">
        ${recommendations.map(({ item, score }) => renderRecommendation(state, item, score, customer)).join("") || "<p>No suitable stock in budget. You may need to order inventory.</p>"}
      </div>
      ${top ? `
        <div class="sale-card">
          <h3>Haggle Handling</h3>
          <p>Some NPCs negotiate hard. Counter, give in, or hold line before finalizing setup.</p>
          <div class="button-row">
            <button data-action="haggle-offer" data-mode="counter">Counter offer</button>
            <button data-action="haggle-offer" data-mode="give-in">Give in</button>
            <button data-action="haggle-offer" data-mode="hold">Hold line</button>
          </div>
        </div>
      
        <div class="sale-card">
          <h3>Quick Sale Bundle</h3>
          <p>${top.name} + ${accessories.map((item) => item.name).join(", ")} + ${service.label}</p>
          <button data-action="start-sale" data-instrument="${top.id}" data-accessories="${accessories.map((item) => item.id).join(",")}" data-service="${service.id}">Recommend this bundle</button>
        </div>
      ` : ""}
      <h3>Latest Responses</h3>
      <ul class="fact-list">
        ${customer.responseLog.slice(0, 4).map((line) => `<li>${line}</li>`).join("") || "<li>Ask a question to reveal useful clues.</li>"}
      </ul>
    </section>
  `;
}

function renderRecommendation(state, item, score, customer) {
  const accessories = chooseRecommendedAccessories(state, customer, item, 3);
  const service = getServiceForCustomer(customer);
  const accessoryNames = accessories.map((acc) => acc.name).join(", ");
  const total = item.sellPrice + accessories.reduce((sum, acc) => sum + acc.sellPrice, 0) + service.price;
  return `
    <article class="mini-card">
      <div class="spread">
        <strong>${item.name}</strong>
        <span>$${item.sellPrice}</span>
      </div>
      <p>${item.category}, ${item.condition}, ${item.qualityTier}. Fit score ${Math.round(score)}.</p>
      <p class="muted">Suggested add-ons: ${accessoryNames || "none"}.</p>
      <button data-action="start-sale" data-instrument="${item.id}" data-accessories="${accessories.map((acc) => acc.id).join(",")}" data-service="${service.id}">Recommend</button>
      <span class="muted">Bundle est. $${Math.round(total)}</span>
    </article>
  `;
}
