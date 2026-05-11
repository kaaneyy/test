import { createInitialState, loadGame, resetSave, saveGame } from "./core/GameState.ts";
import { createCustomerForDay, askQuestion, evaluateRecommendation } from "./core/Customers.ts";
import { startCalibration, applyCalibrationAction, finalizeCalibration, buildDefectFromCalibration, beginFullscreenQte, resolveFullscreenQte } from "./core/Calibration.ts";
import { completeSaleTransaction, getAccessory, getInventoryItem, calculateSaleTotals, processEndOfDay, takeLoan, payTaxDeposit, buyStarterStock, processPendingInvoices } from "./core/Economy.ts";
import { applyServiceOutcome, processPendingDefects } from "./core/Reputation.ts";
import { acceptOutsideJob, completeOutsideJob, toggleJobChecklist, toggleJobShortcut } from "./core/Jobs.ts";
import { hireEmployee, assignEmployee, trainEmployee } from "./core/Employees.ts";
import { maybeTriggerDailyEvent } from "./core/Events.ts";
import { placeSupplierOrder, processSupplierOrders } from "./core/Suppliers.ts";
import { createWarrantyRecord, expireWarranties, resolveWarrantyClaim } from "./core/Warranty.ts";
import { launchHouseBrandBatch, openExpansion, processExpansionDaily, startCustomOrder } from "./core/Expansion.ts";
import { runStaffAudit } from "./core/Operations.ts";
import { applyPianoAction } from "./core/Piano.ts";
import { hostCoffeeChat, restockCoffee, sellCoffee } from "./core/Coffee.ts";
import { maybeTriggerAccident, repairDamagedInventory } from "./core/Accidents.ts";
import { fulfillOnlineOrder, maybePostOnlineOrder, processOnlineOrderDeadlines } from "./core/OnlineOrders.ts";
import { pruneNotifications, pushNotification } from "./core/Notifications.ts";
import { setupProcedures } from "./data/calibrationProfiles.ts";
import { ShopScene } from "./ui/ShopScene.ts";
import { renderDialoguePanel } from "./ui/DialoguePanel.ts";
import { renderCalibrationWorkbench } from "./ui/CalibrationWorkbench.ts";
import { renderLedgerPanel } from "./ui/LedgerPanel.ts";
import { renderReputationPanel } from "./ui/ReputationPanel.ts";
import { renderInventoryPanel } from "./ui/InventoryPanel.ts";
import { renderBankPanel, renderEmployeePanel, renderMapPanel, renderOperationsPanel, renderOutsideJobPanel } from "./ui/ManagementPanels.ts";
import { renderCoffeePanel } from "./ui/CoffeePanel.ts";
import { renderDayReport } from "./ui/DayReportPanel.ts";
import { renderNotifications } from "./ui/NotificationsPanel.ts";

const canvas = document.querySelector("#gameCanvas");
const sidePanel = document.querySelector("#sidePanel");
const hud = document.querySelector("#hud");
const toast = document.querySelector("#toast");
const modalRoot = document.querySelector("#modalRoot");
const notificationRoot = document.querySelector("#notificationRoot");
const scene = new ShopScene(canvas);
let state = createInitialState();
let dayReportTimer = null;



window.addEventListener("resize", () => scene.resize());
scene.resize();

window.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "e") interactNearby();
  if (event.key === "Escape") {
    state.ui.panel = "shop";
    render();
  }
});

document.body.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  const id = button.dataset.id;
  const result = await handleAction(action, button, id);
  if (result?.message) showToast(result.message);
  await saveGame(state);
  render();
});


function applyFatigueFromWork(minutes = 0) {
  const fatigue = state.player.fatigue;
  fatigue.actionsToday += 1;
  fatigue.level = Math.max(0, Math.min(70, Math.round(fatigue.actionsToday * 3 + Math.max(0, minutes - 10) * 0.08)));
}

function getFatiguePenalty() {
  return Math.round((state.player.fatigue?.level || 0) * 0.35);
}

function handleAction(action, button, id) {
  switch (action) {
    case "tab":
      state.ui.panel = id;
      return;
    case "spawn-customer":
      if (!state.activeCustomer) state.activeCustomer = createCustomerForDay(state);
      state.ui.panel = "dialogue";
      return { message: `${state.activeCustomer.name} approaches the counter.` };
    case "ask-question":
      applyFatigueFromWork(4);
      return askQuestion(state, state.activeCustomer, id);
    case "start-sale":
      return startSaleFromButton(button);
    case "haggle-offer":
      return resolveHaggle(button.dataset.mode || "counter");
    case "calibration-action":
      return applyCalibrationAction(state.activeCalibration, id, state);
    case "start-fullscreen-qte":
      return beginFullscreenQte(state, state.activeCalibration);
    case "qte-choice":
      return resolveFullscreenQte(state, button.dataset.step);
    case "finalize-calibration":
      return finalizeCurrentSale();
    case "end-day":
      return endDay();
    case "create-character":
      return createCharacter(button);
    case "save":
      return saveGame(state).then(() => ({ message: "Game saved." }));
    case "load":
      return loadGame().then((loaded) => { state = loaded || state; return { message: "Game loaded." }; });
    case "reset":
      return resetSave().then(() => {
      state = createInitialState();
      state.activeCustomer = createCustomerForDay(state);
      return { message: "Fresh shop, fresh ledger, same suspicious rent." };
      });
    case "take-loan":
      return takeLoan(state, id);
    case "order-stock":
      return placeSupplierOrder(state, id, 1);
    case "fulfill-online-order":
      return fulfillOnlineOrder(state, id);
    case "repair-damaged":
      return repairDamagedInventory(state, id);
    case "resolve-claim":
      return resolveWarrantyClaim(state, id, button.dataset.resolution);
    case "open-expansion":
      return openExpansion(state, id);
    case "launch-house-brand":
      return launchHouseBrandBatch(state, id);
    case "start-custom-order":
      return startCustomOrder(state, id);
    case "run-audit":
      return runStaffAudit(state, id);
    case "piano-action":
      return applyPianoAction(state, id);
    case "sell-coffee":
      return sellCoffee(state, button.dataset.cups);
    case "host-coffee-chat":
      return hostCoffeeChat(state);
    case "restock-coffee":
      return restockCoffee(state);
    case "pay-tax":
      return payTaxDeposit(state, 100);
    case "buy-starter-stock":
      return buyStarterStock(state);
    case "hire-employee":
      return hireEmployee(state, id);
    case "assign-employee":
      return assignEmployee(state, id, button.dataset.assignment);
    case "train-employee":
      return trainEmployee(state, id);
    case "accept-job":
      return acceptOutsideJob(state, id);
    case "toggle-job-step":
      toggleJobChecklist(state, id);
      return;
    case "toggle-job-shortcut":
      toggleJobShortcut(state, id);
      return;
    case "complete-job":
      return completeOutsideJob(state);
    case "close-day-report":
      state.dayReport = null;
      return;
    default:
      return;
  }
}

function startSaleFromButton(button) {
  const customer = state.activeCustomer;
  const instrumentId = button.dataset.instrument;
  const instrument = getInventoryItem(state, instrumentId);
  if (!customer || !instrument) return { message: "No customer or instrument selected." };
  const accessoryIds = (button.dataset.accessories || "").split(",").filter(Boolean);
  const serviceId = button.dataset.service || "basic-setup";
  const service = setupProcedures.find((item) => item.id === serviceId) || setupProcedures[1];
  const evalResult = evaluateRecommendation(customer, instrument, accessoryIds, state);
  const accessories = accessoryIds.map((accessoryId) => getAccessory(state, accessoryId)).filter(Boolean);
  const sale = {
    id: `sale-${state.day}-${state.ledger.length}`,
    customerId: customer.id,
    customerLabel: customer.label,
    instrumentId: instrument.id,
    instrumentName: instrument.name,
    accessoryIds,
    accessoryNames: accessories.map((item) => item.name),
    serviceId,
    servicePrice: service.price * state.settings.servicePriceMultiplier,
    recommendationFit: evalResult.fitScore,
  };
  sale.totals = calculateSaleTotals(state, sale);
  state.activeSale = sale;
  startCalibration(state, instrument, customer, serviceId);
  state.ui.panel = "calibration";
  return { message: `Sale prepared. Payment waits until ${service.label.toLowerCase()} is complete.` };
}

function finalizeCurrentSale() {
  const customer = state.activeCustomer;
  const sale = state.activeSale;
  const calibration = state.activeCalibration;
  if (!customer || !sale || !calibration) return { message: "No active sale/setup to finish." };
  const result = finalizeCalibration(state, customer);
  const fatiguePenalty = getFatiguePenalty();
  const blendedSatisfaction = Math.max(0, Math.round(customer.satisfaction * 0.35 + result.satisfaction * 0.65 - fatiguePenalty));
  const instrument = getInventoryItem(state, sale.instrumentId);
  const totals = completeSaleTransaction(state, sale, blendedSatisfaction);
  applyFatigueFromWork(calibration.elapsedMinutes);
  const haggleNote = sale.haggleMode ? ` (${sale.haggleMode} haggle)` : "";
  const reviewLine = sale.haggleMode === "give-in"
    ? `I paid below industry and got below industry product. ${blendedSatisfaction}/100.`
    : `${sale.customerLabel}: ${blendedSatisfaction}/100 after buying ${sale.instrumentName}${haggleNote}.`;
  pushNotification(state, "review", "Review posted", reviewLine);
  createWarrantyRecord(state, sale, totals, result, calibration);
  applyServiceOutcome(state, {
    satisfaction: blendedSatisfaction,
    setupScore: result.score,
    technicalQuality: result.score,
    dishonest: calibration.dishonestActions.length > 0,
    legalRiskAdd: result.risks.damageRisk > 30 ? 2 : 0,
    warrantyLiabilityAdd: result.risks.discoverySeverity * totals.total * 0.2,
  });
  const defect = buildDefectFromCalibration(state, calibration, result, customer, instrument, sale);
  if (defect) state.pendingDefects.push(defect);
  state.player.skill.guitarSetup = Math.min(100, state.player.skill.guitarSetup + 1.2);
  state.player.skill.sales = Math.min(100, state.player.skill.sales + 0.8);
  state.activeCustomer = null;
  state.activeSale = null;
  state.activeCalibration = null;
  state.ui.panel = "shop";
  return { message: `Paid $${totals.total.toFixed(2)}. Setup ${result.score}/100, satisfaction ${blendedSatisfaction}/100.` };
}

function endDay() {
  const dayEnded = state.day;
  const fatigueBeforeReset = state.player.fatigue.level;
  const cashBefore = state.cash;
  const ledgerCountBefore = state.ledger.length;
  const events = [];
  const discovered = processPendingDefects(state);
  if (discovered.length) {
    state.ui.toast = `${discovered.length} earlier defect(s) were discovered after customers left the shop.`;
    events.push(`${discovered.length} earlier defect(s) were discovered.`);
  }
  processEndOfDay(state);
  const arrivals = processSupplierOrders(state);
  const paidInvoices = processPendingInvoices(state);
  const missedOnlineOrders = processOnlineOrderDeadlines(state);
  expireWarranties(state);
  processExpansionDaily(state);
  const accident = maybeTriggerAccident(state);
  const onlineOrder = maybePostOnlineOrder(state);
  maybeTriggerDailyEvent(state);
  if (arrivals.length) {
    state.ui.toast = `${arrivals.length} supplier order(s) arrived.`;
    events.push(`${arrivals.length} supplier order(s) arrived.`);
  }
  if (paidInvoices.length) {
    state.ui.toast = `${paidInvoices.length} invoice payment(s) cleared.`;
    events.push(`${paidInvoices.length} invoice payment(s) cleared.`);
  }
  if (missedOnlineOrders.length) events.push(`${missedOnlineOrders.length} online order(s) missed their deadline.`);
  if (accident) events.push(`${accident.type}: ${accident.itemName} needs inventory repair.`);
  if (onlineOrder) events.push(`New online order posted: ${onlineOrder.quantity} x ${onlineOrder.itemName}.`);
  if (!state.activeCustomer && state.day <= 7) state.activeCustomer = createCustomerForDay(state);
  state.player.fatigue.actionsToday = 0;
  state.player.fatigue.level = Math.max(0, Math.round(fatigueBeforeReset * 0.35));
  state.dayReport = buildDayReport(state, dayEnded, cashBefore, ledgerCountBefore, events);
  void saveGame(state);
  scheduleDayReportUnlock();
  return { message: `Day ${state.day} begins. ${state.milestoneText}` };
}

function buildDayReport(state, dayEnded, cashBefore, ledgerCountBefore, events) {
  const newEntries = state.ledger.slice(0, Math.max(0, state.ledger.length - ledgerCountBefore));
  const revenue = newEntries.filter((entry) => entry.amount > 0 && !entry.meta?.accountingOnly).reduce((sum, entry) => sum + entry.amount, 0);
  const expenses = newEntries.filter((entry) => entry.amount < 0 && !entry.meta?.accountingOnly).reduce((sum, entry) => sum + Math.abs(entry.amount), 0);
  return {
    dayEnded,
    createdAt: Date.now(),
    unlockAt: Date.now() + 5000,
    summary: `Day ${dayEnded} closed. You cannot skip this report for 5 seconds, because the ledger deserves eye contact.`,
    cashChange: state.cash - cashBefore,
    endingCash: state.cash,
    revenue,
    expenses,
    publicReputation: state.stats.publicReputation,
    industryHonor: state.stats.industryHonor,
    events,
  };
}

function scheduleDayReportUnlock() {
  if (dayReportTimer) clearTimeout(dayReportTimer);
  dayReportTimer = setTimeout(() => {
    const closeButton = document.querySelector("#closeDayReport");
    if (closeButton) {
      closeButton.disabled = false;
      closeButton.textContent = "Continue";
    }
  }, 5000);
}

function interactNearby() {
  const nearby = scene.getNearbyInteractable(state);
  if (!nearby) return;
  const panels = {
    counter: "dialogue",
    workbench: "calibration",
    storage: "inventory",
    door: "map",
    ledger: "ledger",
    coffee: "coffee",
  };
  state.ui.panel = panels[nearby.id] || "shop";
  render();
}

function render() {
  pruneNotifications(state);
  renderHud();
  renderPanel();
  renderModal();
  notificationRoot.innerHTML = renderNotifications(state);
  toast.textContent = state.ui.toast || "";
  document.querySelectorAll("[data-action='tab']").forEach((button) => {
    button.classList.toggle("active", button.dataset.id === state.ui.panel);
  });
}

function renderModal() {
  modalRoot.innerHTML = `${renderDayReport(state.dayReport)}${renderQteModal(state)}`;
  if (state.dayReport) {
    const closeButton = document.querySelector("#closeDayReport");
    const remaining = Math.max(0, Math.ceil((state.dayReport.unlockAt - Date.now()) / 1000));
    if (closeButton) {
      closeButton.disabled = remaining > 0;
      closeButton.textContent = remaining > 0 ? `Continue in ${remaining}` : "Continue";
    }
    if (remaining > 0) scheduleDayReportUnlock();
  }
}

function renderHud() {
  hud.innerHTML = `
    <div><strong>Day ${state.day}</strong><span>${state.milestoneText}</span></div>
    <div><strong>$${state.cash.toFixed(2)}</strong><span>cash</span></div>
    <div><strong>${Math.round(state.stats.publicReputation)}</strong><span>public rep</span></div>
    <div><strong>${Math.round(state.stats.industryHonor)}</strong><span>industry honor</span></div>
    <div><strong>${Math.round(state.stats.creditScore)}</strong><span>credit</span></div>
    <div><strong>${Math.round(state.player.fatigue.level)}</strong><span>fatigue</span></div>
  `;
}

function renderPanel() {
  const panel = state.ui.panel;
  if (panel === "dialogue") sidePanel.innerHTML = renderDialoguePanel(state);
  else if (panel === "calibration") sidePanel.innerHTML = renderCalibrationWorkbench(state);
  else if (panel === "ledger") sidePanel.innerHTML = renderLedgerPanel(state);
  else if (panel === "reputation") sidePanel.innerHTML = renderReputationPanel(state);
  else if (panel === "inventory") sidePanel.innerHTML = renderInventoryPanel(state);
  else if (panel === "bank") sidePanel.innerHTML = renderBankPanel(state);
  else if (panel === "employees") sidePanel.innerHTML = renderEmployeePanel(state);
  else if (panel === "operations") sidePanel.innerHTML = renderOperationsPanel(state);
  else if (panel === "coffee") sidePanel.innerHTML = renderCoffeePanel(state);
  else if (panel === "map") sidePanel.innerHTML = renderMapPanel(state);
  else if (panel === "outside-job") sidePanel.innerHTML = renderOutsideJobPanel(state);
  else sidePanel.innerHTML = state.player.created ? renderWelcomePanel() : renderCharacterCreator();
}


function createCharacter(button) {
  const key = button.dataset.skill;
  if (!key) {
    state.player.created = true;
    state.ui.panel = "welcome";
    return { message: "Character created. Open shop." };
  }
  if (state.player.skillPoints <= 0) return { message: "No skill points left." };
  if (!(key in state.player.skill)) return { message: "Unknown skill." };
  state.player.skill[key] += 2;
  state.player.skillPoints -= 1;
  return { message: `${key} increased.` };
}

function resolveHaggle(mode) {
  if (!state.activeSale) return { message: "No active sale to haggle." };
  state.activeSale.haggleMode = mode;
  if (mode === "give-in") state.activeSale.servicePrice *= 0.75;
  if (mode === "counter") state.activeSale.servicePrice *= 0.9;
  return { message: `Haggle set: ${mode}.` };
}

function renderCharacterCreator() {
  const trees = ["sales", "repair", "fame", "insight", "economy", "honesty"];
  return `
    <section class="panel-section">
      <h2>Create Character</h2>
      <p>Distribute skill points into your skill trees before day one.</p>
      <p class="pill">Points left: ${state.player.skillPoints}</p>
      <div class="action-grid">
        ${trees.map((tree) => `<button data-action="create-character" data-skill="${tree}">${tree}: ${Math.round(state.player.skill[tree] || 0)} (+2)</button>`).join("")}
      </div>
      <button class="primary" data-action="create-character">Start game</button>
    </section>
  `;
}

function renderWelcomePanel() {
  return `
    <section class="panel-section">
      <h2>Open Shop</h2>
      <p>Move with WASD or arrow keys. Press E near the counter, workbench, storage, ledger desk, or door. Use the panel buttons for management screens.</p>
      <p class="quote">Small disclaimer: this is a simulation inspired by real setup practices. It is not a substitute for professional training, especially for expensive, antique, electrical, fragile, or concert-level instruments.</p>
      <div class="button-stack">
        <button data-action="tab" data-id="dialogue">Go to counter</button>
        <button data-action="tab" data-id="calibration">Open workbench</button>
        <button data-action="tab" data-id="ledger">Review ledger</button>
      </div>
    </section>
  `;
}


function renderQteModal(state) {
  const qte = state.ui.qte;
  if (!qte) return "";
  const options = ["RELIEF", "ACTION", "INTONATION", "TUNING"];
  return `
    <div class="fullscreen-qte">
      <section class="qte-card">
        <h2>Full-Screen Setup QTE</h2>
        <p>Follow pro adjustment order for ${qte.profileLabel}. This teaches sequence and rewards precise work.</p>
        <div class="qte-target">Target sequence: ${qte.target.join(" → ")}</div>
        <p class="muted">Chosen: ${qte.chosen.join(" → ") || "none"}</p>
        <ul class="fact-list">${qte.education.map((line)=>`<li>${line}</li>`).join("")}</ul>
        <div class="qte-grid">${options.map((o)=>`<button data-action="qte-choice" data-step="${o}">${o}</button>`).join("")}</div>
      </section>
    </div>
  `;
}

function showToast(message) {
  state.ui.toast = message;
  toast.textContent = message;
}

function frame() {
  scene.update(state);
  scene.draw(state);
  requestAnimationFrame(frame);
}

async function initializeGame() {
  const loaded = await loadGame();
  state = loaded || createInitialState();
  if (!state.activeCustomer) state.activeCustomer = createCustomerForDay(state);
  render();
  requestAnimationFrame(frame);
}

initializeGame();
