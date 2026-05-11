import { availableOutsideJobs } from "../core/Jobs.ts";
import { getEligibleLoanOffers } from "../core/Loans.ts";
import { describeBranch, getBranchSizes } from "../core/Branches.ts";
import { getExpansionData } from "../core/Expansion.ts";
import { getAuditTypes } from "../core/Operations.ts";
import { renderPianoInstallPanel } from "./PianoInstallPanel.ts";

export function renderBankPanel(state) {
  const offers = getEligibleLoanOffers(state);
  return `
    <section class="panel-section">
      <h2>Bank and Credit</h2>
      <div class="stat-grid">
        <div class="stat"><span>Credit Score</span><strong>${Math.round(state.stats.creditScore)}</strong></div>
        <div class="stat"><span>Debt</span><strong>$${state.debt.toFixed(2)}</strong></div>
        <div class="stat"><span>Legal Risk</span><strong>${Math.round(state.stats.legalRisk)}</strong></div>
        <div class="stat"><span>Cash Flow Mood</span><strong>${state.cash > 1200 ? "steady" : "tight"}</strong></div>
      </div>
      ${state.unlocked.bank ? `
        <div class="inventory-list">
          ${offers.map((offer) => `
            <article class="mini-card">
              <div class="spread"><strong>${offer.label}</strong><span>$${offer.principal}</span></div>
              <p>${offer.use}</p>
              <p class="muted">Monthly interest ${(offer.interestRateMonthly * 100).toFixed(1)}%, payment $${offer.paymentAmount} every ${offer.paymentEveryDays} days, min credit ${offer.minCreditScore}.</p>
              <button data-action="take-loan" data-id="${offer.id}" ${offer.eligible ? "" : "disabled"}>${offer.eligible ? "Take loan" : "Credit too low"}</button>
            </article>
          `).join("")}
        </div>
      ` : "<p>Loan offers unlock on day 6 or when a bank event appears.</p>"}
    </section>
  `;
}

export function renderEmployeePanel(state) {
  return `
    <section class="panel-section">
      <h2>Employees</h2>
      <p class="muted">Delegation helps, but your shop still owns the consequences.</p>
      <h3>Team</h3>
      <div class="inventory-list">
        ${state.employees.map((employee) => `
          <article class="mini-card">
            <div class="spread"><strong>${employee.name}</strong><span>${employee.assignment}</span></div>
            <p>${employee.role}. Wage $${employee.wageDaily}/day. Specialty: ${employee.specialty}</p>
            <p class="muted">Sales ${Math.round(employee.skills.sales)}, setup ${Math.round(employee.skills.guitarSetup)}, docs ${Math.round(employee.skills.documentation)}, morale ${Math.round(employee.morale)}</p>
            <div class="button-row">
              <button data-action="assign-employee" data-id="${employee.id}" data-assignment="counter">Counter</button>
              <button data-action="assign-employee" data-id="${employee.id}" data-assignment="setup">Setup</button>
              <button data-action="assign-employee" data-id="${employee.id}" data-assignment="books">Books</button>
              <button data-action="train-employee" data-id="${employee.id}">Train $120</button>
            </div>
          </article>
        `).join("") || "<p>No staff yet. You are the whole empire, which is heroic and terrible for lunch breaks.</p>"}
      </div>
      <h3>Candidates</h3>
      <div class="inventory-list">
        ${state.employeeCandidates.map((candidate) => `
          <article class="mini-card">
            <div class="spread"><strong>${candidate.name}</strong><span>$${candidate.wageDaily}/day</span></div>
            <p>${candidate.role}. ${candidate.specialty}</p>
            <p class="muted">Sales ${candidate.skills.sales}, setup ${candidate.skills.guitarSetup}, docs ${candidate.skills.documentation}, honesty ${candidate.honesty}.</p>
            <button data-action="hire-employee" data-id="${candidate.id}" ${state.day >= 7 || state.unlocked.employees ? "" : "disabled"}>${state.day >= 7 || state.unlocked.employees ? "Hire" : "Unlocks day 7"}</button>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

export function renderMapPanel(state) {
  const jobs = availableOutsideJobs(state);
  return `
    <section class="panel-section">
      <h2>Branch Map and Outside Jobs</h2>
      <p>Leaving the store costs time and can lose walk-ins unless an employee covers the counter. Big jobs pay only after acceptance.</p>
      <h3>Current Branch</h3>
      <p class="quote">${describeBranch(state.branch)}</p>
      <h3>Available Jobs</h3>
      <div class="inventory-list">
        ${jobs.map((job) => `
          <article class="mini-card ${job.advanced ? "advanced" : ""}">
            <div class="spread"><strong>${job.title}</strong><span>$${job.payment}</span></div>
            <p>${job.description}</p>
            <p class="muted">Location: ${job.location}. Duration ${job.durationHours}h. Travel cost $${job.travelCost}. ${job.advanced ? "Advanced high-risk contract." : ""}</p>
            <button data-action="accept-job" data-id="${job.id}">Accept job</button>
          </article>
        `).join("") || "<p>Outside jobs unlock on day 4.</p>"}
      </div>
      <h3>Future Branch Sizes</h3>
      <ul class="fact-list">
        ${getBranchSizes().map((branch) => `<li>${describeBranch(branch)}</li>`).join("")}
      </ul>
      ${renderExpansionControls(state)}
    </section>
  `;
}

export function renderOutsideJobPanel(state) {
  const job = state.activeOutsideJob;
  if (!job) return renderMapPanel(state);
  return `
    <section class="panel-section">
      <h2>${job.title}</h2>
      <p>${job.description}</p>
      <div class="stat-grid">
        <div class="stat"><span>Payment after acceptance</span><strong>$${job.payment}</strong></div>
        <div class="stat"><span>Travel spent</span><strong>$${job.travelCost}</strong></div>
        <div class="stat"><span>Public use</span><strong>${job.publicUseFactor}</strong></div>
        <div class="stat"><span>Value risk</span><strong>${job.valueFactor}</strong></div>
      </div>
      <h3>Proper Procedure</h3>
      ${job.pianoProfileId ? renderPianoInstallPanel(state) : ""}
      <div class="button-stack">
        ${job.checklist.map((item) => `
          <button data-action="toggle-job-step" data-id="${item.id}" class="${job.completedChecklist.includes(item.id) ? "selected" : ""}">
            ${job.completedChecklist.includes(item.id) ? "[x] " : ""}${item.label}
          </button>
        `).join("")}
      </div>
      <h3>Shortcuts</h3>
      <div class="button-stack">
        ${job.shortcuts.map((item) => `
          <button data-action="toggle-job-shortcut" data-id="${item.id}" class="danger-button ${job.shortcutsTaken.includes(item.id) ? "selected" : ""}">
            ${job.shortcutsTaken.includes(item.id) ? "[x] " : ""}${item.label}
          </button>
        `).join("")}
      </div>
      <button class="primary" data-action="complete-job">Complete and request acceptance</button>
    </section>
  `;
}

function renderExpansionControls(state) {
  const { expansionOptions, houseBrandPlans, customOrderTemplates } = getExpansionData();
  return `
    <h3>Expansion</h3>
    <div class="inventory-list">
      ${expansionOptions.map((option) => `
        <article class="mini-card">
          <div class="spread"><strong>${option.label}</strong><span>$${option.cost}</span></div>
          <p>${option.description}</p>
          <p class="muted">Requires reputation ${option.requiredReputation}, credit ${option.requiredCredit}. Upkeep $${option.dailyUpkeep}/day.</p>
          <button data-action="open-expansion" data-id="${option.id}">Open</button>
        </article>
      `).join("")}
    </div>
    <h3>House Brand</h3>
    <div class="inventory-list">
      ${houseBrandPlans.map((plan) => `
        <article class="mini-card">
          <div class="spread"><strong>${plan.label}</strong><span>${plan.batchSize} units</span></div>
          <p>${plan.description}</p>
          <p class="muted">Cost $${plan.unitCost * plan.batchSize}, build ${plan.buildDays} days, QC difficulty ${plan.qcDifficulty}.</p>
          <button data-action="launch-house-brand" data-id="${plan.id}" ${state.unlocked.factory ? "" : "disabled"}>${state.unlocked.factory ? "Start batch" : "Needs workshop"}</button>
        </article>
      `).join("")}
    </div>
    <h3>Custom Orders</h3>
    <div class="inventory-list">
      ${customOrderTemplates.map((template) => `
        <article class="mini-card">
          <div class="spread"><strong>${template.label}</strong><span>$${template.revenue}</span></div>
          <p>${template.description}</p>
          <p class="muted">Deposit $${template.deposit}, cost $${template.cost}, lead ${template.leadDays} days, required honor ${template.requiredHonor}.</p>
          <button data-action="start-custom-order" data-id="${template.id}">Accept order</button>
        </article>
      `).join("")}
    </div>
  `;
}

export function renderOperationsPanel(state) {
  const audits = getAuditTypes();
  return `
    <section class="panel-section">
      <h2>Operations</h2>
      <div class="stat-grid">
        <div class="stat"><span>Warehouse</span><strong>${state.logistics.warehouseUsed}/${state.logistics.warehouseCapacity || state.branch.storageCapacity}</strong></div>
        <div class="stat"><span>Freight discount</span><strong>${Math.round((state.logistics.freightDiscount || 0) * 100)}%</strong></div>
        <div class="stat"><span>Service capacity</span><strong>${state.logistics.serviceCenterCapacity}</strong></div>
        <div class="stat"><span>Factory capacity</span><strong>${state.logistics.factoryCapacity}</strong></div>
      </div>
      <h3>Staff Audits and Tool Schedules</h3>
      <div class="inventory-list">
        ${audits.map((audit) => `
          <article class="mini-card">
            <div class="spread"><strong>${audit.label}</strong><span>$${audit.cost}</span></div>
            <p>${audit.description}</p>
            <p class="muted">Cooldown ${audit.cooldownDays} days.</p>
            <button data-action="run-audit" data-id="${audit.id}">Run</button>
          </article>
        `).join("")}
      </div>
      <h3>Facilities</h3>
      <ul class="fact-list">
        ${state.facilities.map((facility) => `<li>${facility.label}, opened day ${facility.openedDay}, upkeep $${facility.dailyUpkeep}/day.</li>`).join("") || "<li>No extra facilities yet.</li>"}
      </ul>
      <h3>House Brand Batches</h3>
      <ul class="fact-list">
        ${state.houseBrandBatches.map((batch) => `<li>${batch.label}: ${batch.status}, ready day ${batch.readyDay}.</li>`).join("") || "<li>No batches in progress.</li>"}
      </ul>
      <h3>Custom Orders</h3>
      <ul class="fact-list">
        ${state.customOrders.map((order) => `<li>${order.label}: ${order.status}, due day ${order.dueDay}.</li>`).join("") || "<li>No custom orders yet.</li>"}
      </ul>
      <h3>Recent Audits</h3>
      <ul class="fact-list">
        ${state.audits.slice(0, 6).map((audit) => `<li>Day ${audit.day}: ${audit.label}</li>`).join("") || "<li>No audits yet.</li>"}
      </ul>
    </section>
  `;
}
