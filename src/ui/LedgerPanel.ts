export function renderLedgerPanel(state) {
  const entries = state.ledger.slice(0, 28);
  const profitToday = state.ledger
    .filter((entry) => entry.day === state.day && !entry.meta?.accountingOnly)
    .reduce((sum, entry) => sum + entry.amount, 0);
  return `
    <section class="panel-section">
      <h2>Ledger</h2>
      <div class="stat-grid">
        <div class="stat"><span>Cash</span><strong>$${state.cash.toFixed(2)}</strong></div>
        <div class="stat"><span>Tax Due</span><strong>$${state.taxDue.toFixed(2)}</strong></div>
        <div class="stat"><span>Debt</span><strong>$${state.debt.toFixed(2)}</strong></div>
        <div class="stat"><span>Today</span><strong>$${profitToday.toFixed(2)}</strong></div>
      </div>
      <div class="button-row">
        <button data-action="pay-tax">Pay $100 tax deposit</button>
        <button data-action="buy-starter-stock">Buy starter guitar</button>
      </div>
      <h3>Receivables and Warranty</h3>
      <ul class="fact-list">
        ${state.pendingInvoices.map((invoice) => `<li>${invoice.label}: $${invoice.amount} due day ${invoice.dueDay}, risk ${Math.round(invoice.risk * 100)}%.</li>`).join("") || "<li>No invoices waiting on late-paying institutions.</li>"}
      </ul>
      <ul class="fact-list">
        ${state.warrantyClaims.slice(0, 6).map((claim) => `
          <li>
            ${claim.instrumentName}: $${claim.estimatedCost} ${claim.status}, ${claim.inWarranty ? "covered" : "out of warranty"}.
            ${claim.status === "open" ? `<button data-action="resolve-claim" data-id="${claim.id}" data-resolution="honor">Honor</button> <button data-action="resolve-claim" data-id="${claim.id}" data-resolution="deny" class="danger-button">Deny</button>` : ""}
          </li>
        `).join("") || "<li>No warranty claims open.</li>"}
      </ul>
      <table class="ledger-table">
        <thead><tr><th>Day</th><th>Type</th><th>Entry</th><th>Amount</th></tr></thead>
        <tbody>
          ${entries.map((entry) => `
            <tr>
              <td>${entry.day}</td>
              <td>${entry.type}</td>
              <td>${entry.label}${entry.meta?.accountingOnly ? " (accounting)" : ""}</td>
              <td class="${entry.amount < 0 ? "neg" : "pos"}">${entry.amount < 0 ? "-" : "+"}$${Math.abs(entry.amount).toFixed(2)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </section>
  `;
}
