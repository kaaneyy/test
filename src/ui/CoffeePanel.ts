export function renderCoffeePanel(state) {
  return `
    <section class="panel-section">
      <h2>Coffee Lounge</h2>
      <p>The coffee corner gives browsers somewhere to sit, talk, and slowly become customers. It is small money, but it feeds public reputation and referrals.</p>
      <div class="stat-grid">
        <div class="stat"><span>Price</span><strong>$${state.coffee.price.toFixed(2)}</strong></div>
        <div class="stat"><span>Beans</span><strong>${state.coffee.beansStock}</strong></div>
        <div class="stat"><span>Cups sold</span><strong>${state.coffee.cupsSold}</strong></div>
        <div class="stat"><span>Coffee revenue</span><strong>$${state.coffee.revenue.toFixed(2)}</strong></div>
        <div class="stat"><span>Lounge buzz</span><strong>${Math.round(state.coffee.loungeBuzz)}</strong></div>
        <div class="stat"><span>Seats</span><strong>${state.coffee.seating}</strong></div>
      </div>
      <div class="button-stack">
        <button data-action="sell-coffee" data-cups="1">Serve one coffee</button>
        <button data-action="sell-coffee" data-cups="3">Serve table of three</button>
        <button data-action="host-coffee-chat">Host a listening-table chat</button>
        <button data-action="restock-coffee">Restock beans $18</button>
      </div>
      <h3>Customer Area Rules</h3>
      <ul class="fact-list">
        <li>Customers can browse racks, sit, drink coffee, and talk in the marked customer floor area.</li>
        <li>Staff-only areas are behind the counter, storage, and the setup bench.</li>
        <li>Coffee-first visitors gain patience when served before a sales pitch.</li>
      </ul>
    </section>
  `;
}
