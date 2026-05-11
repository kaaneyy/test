export function renderDayReport(report) {
  if (!report) return "";
  return `
    <div class="modal-backdrop" id="dayReportBackdrop">
      <section class="day-report" role="dialog" aria-modal="true" aria-labelledby="dayReportTitle">
        <h2 id="dayReportTitle">Day ${report.dayEnded} Report</h2>
        <p class="quote">${report.summary}</p>
        <div class="stat-grid">
          <div class="stat"><span>Cash change</span><strong>${money(report.cashChange)}</strong></div>
          <div class="stat"><span>Ending cash</span><strong>${money(report.endingCash)}</strong></div>
          <div class="stat"><span>Revenue</span><strong>${money(report.revenue)}</strong></div>
          <div class="stat"><span>Expenses</span><strong>${money(report.expenses)}</strong></div>
          <div class="stat"><span>Public rep</span><strong>${Math.round(report.publicReputation)}</strong></div>
          <div class="stat"><span>Industry honor</span><strong>${Math.round(report.industryHonor)}</strong></div>
        </div>
        <h3>Notable Events</h3>
        <ul class="fact-list">
          ${report.events.map((event) => `<li>${event}</li>`).join("") || "<li>No unusual events. Suspiciously peaceful.</li>"}
        </ul>
        <button class="primary" id="closeDayReport" data-action="close-day-report" disabled>Continue in 5</button>
      </section>
    </div>
  `;
}

function money(value) {
  const prefix = value < 0 ? "-" : "";
  return `${prefix}$${Math.abs(value).toFixed(2)}`;
}
