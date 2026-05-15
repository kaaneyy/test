import { createInitialState, loadGame, resetSave, saveGame } from "./core/GameState.ts";
import { createCustomerForDay, askQuestion, evaluateRecommendation } from "./core/Customers.ts";
import { startCalibration, applyCalibrationAction, finalizeCalibration, buildDefectFromCalibration, beginFullscreenQte, resolveFullscreenQte, getCalibrationReadiness, calibrationActions, estimateAdjustmentCost } from "./core/Calibration.ts";
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
import { fulfillOnlineOrder, maybePostOnlineOrder, processOnlineOrderDeadlines, postGuaranteedOnlineOrder } from "./core/OnlineOrders.ts";
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

canvas.addEventListener("click", (event) => {
  const slot = scene.getShelfSlotFromClick(event, state);
  if (slot === null || slot === undefined) return;
  state.ui.selectedShelfSlot = slot;
  state.ui.panel = "inventory";
  showToast(`Shelf ${slot + 1} selected. Choose an item from inventory to place.`);
  render();
});

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
    event.preventDefault();
  }
  if (state.ui.qte?.active) {
    handleQteKey(event.key.toUpperCase());
    return;
  }
  if (key === "e") interactNearby();
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
      return applyCalibrationActionWithCost(id);
    case "start-fullscreen-qte":
      return startKeyboardQte();
    case "auto-adjust":
      return runAutoAdjust();
    case "pitch-special":
      return pitchSpecialEdition();
    case "answer-roamer":
      return answerRoamer(button.dataset.mode || "neutral");
    case "assign-shelf":
      return assignShelf(button.dataset.slot, id);
    case "clear-shelf":
      return clearShelf(button.dataset.slot);
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
      return fulfillOnlineOrderAndBackfill(id);
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


function applyCalibrationActionWithCost(actionId) {
  const result = applyCalibrationAction(state.activeCalibration, actionId, state);
  if (!result?.ok) return result;
  const action = calibrationActions.find((item) => item.id === actionId);
  const cost = action?.shortcut ? 0 : estimateAdjustmentCost(action);
  state.cash = Math.max(-999999, state.cash - cost);
  if (state.activeSale) {
    state.activeSale.adjustmentCost = (state.activeSale.adjustmentCost || 0) + cost;
    const projectedProfit = (state.activeSale.totals?.profit || 0) - state.activeSale.adjustmentCost;
    if (projectedProfit < 0) {
      pushNotification(state, "warning", "Adjustment cost warning", `Adjustments on ${state.activeSale.instrumentName} are now below profit by $${Math.abs(projectedProfit).toFixed(2)}.`);
    }
    if (projectedProfit < 0 && state.activeCustomer) {
      state.activeCustomer.satisfaction = Math.min(100, state.activeCustomer.satisfaction + 4);
      if (!state.activeCustomer.trustBuilt) {
        state.activeCustomer.label = `${state.activeCustomer.label} (trust-building)`;
        state.activeCustomer.trustBuilt = true;
      }
    }
  }
  return { ...result, message: `${result.message} | Adjustment cost -$${cost.toFixed(2)}` };
}


function handleQteKey(key) {
  const qte = state.ui.qte;
  if (!qte?.active) return;
  if (Date.now() > qte.endsAt) {
    state.ui.qte = null;
    showToast("QTE failed: time expired.");
    return;
  }
  const expected = qte.sequence[qte.index];
  if (key === expected) {
    qte.index += 1;
    if (qte.index >= qte.sequence.length) {
      state.activeCalibration.documentationQuality += 12;
      state.activeCalibration.explanationQuality += 10;
      state.ui.qte = null;
      showToast("QTE success: setup confidence improved.");
    }
  } else {
    state.activeCalibration.damageRisk = Math.min(100, state.activeCalibration.damageRisk + 3);
  }
}

function runAutoAdjust() {
  const calibration = state.activeCalibration;
  if (!calibration) return { message: "No active setup." };
  const readiness = getCalibrationReadiness(calibration);
  const map = { inspect: "inspect", relief: "tune", action: "raise-bridge", "nut-check": "lubricate-nut", intonation: "intonate-back", tune: "tune", stretch: "stretch-strings", "play-test": "play-test", document: "document", clean: "clean-body" };
  let total = 0;
  for (const step of readiness.missingSteps) {
    const actionId = map[step];
    if (!actionId) continue;
    const result = applyCalibrationActionWithCost(actionId);
    if (result?.ok) total += estimateAdjustmentCost(calibrationActions.find((a) => a.id === actionId)) * 1.35;
  }
  state.cash -= total;
  return { message: `Auto-adjust applied required steps. Premium labor -$${total.toFixed(2)}.` };
}

function pitchSpecialEdition() {
  const customer = state.activeCustomer;
  if (!customer) return { message: "No customer to pitch." };
  if (customer.knowledge < 45) {
    customer.satisfaction = Math.min(100, customer.satisfaction + 6);
    customer.responseLog.unshift("They believed the special-edition story and felt excited.");
    return { message: "Special-edition pitch landed with this beginner customer." };
  }
  customer.satisfaction = Math.max(0, customer.satisfaction - 4);
  customer.responseLog.unshift("They asked for provenance and challenged the special-edition claim.");
  return { message: "Pitch backfired: informed customer asked for proof." };
}



function assignShelf(slot, instrumentId) {
  const idx = slot === undefined || slot === null || slot === "" ? Number(state.ui.selectedShelfSlot) : Number(slot);
  const item = state.inventory.find((it) => it.id === instrumentId && it.stock > 0);
  if (!Number.isInteger(idx) || idx < 0 || idx > 2 || !item) return { message: "Cannot place this instrument on shelf." };
  state.shelfDisplay[idx] = { id: item.id, name: item.name, bonus: item.qualityTier === "Collector" ? 8 : 4, debuff: item.condition.includes("neglected") ? -7 : -2 };
  return { message: `${item.name} placed on shelf ${idx + 1}.` };
}

function clearShelf(slot) {
  const idx = Number(slot);
  if (!Number.isInteger(idx) || idx < 0 || idx > 2) return { message: "Invalid shelf slot." };
  state.shelfDisplay[idx] = null;
  return { message: `Shelf ${idx + 1} cleared.` };
}


function startKeyboardQte() {
  const calibration = state.activeCalibration;
  if (!calibration) return { message: "No active setup." };
  const keys = ["A", "S", "D", "F", "J", "K", "L"];
  const sequence = Array.from({ length: 8 }, () => keys[Math.floor(state.rng.next() * keys.length)]);
  state.ui.qte = { active: true, sequence, index: 0, endsAt: Date.now() + 9000 };
  return { message: "QTE started: type the key sequence before timer ends." };
}

function answerRoamer(mode) {
  if (state.ui.lastRoamerAnswerDay === state.day) return { message: "You already answered a roaming bubble today." };
  const delta = mode === "honest" ? { rep: 1.2, cash: 0 } : mode === "dishonest" ? { rep: -1.8, cash: 15 } : { rep: 0.4, cash: 6 };
  state.stats.publicReputation = Math.max(0, Math.min(100, state.stats.publicReputation + delta.rep));
  state.cash += delta.cash;
  state.ui.lastRoamerAnswerDay = state.day;
  return { message: `Roaming customer answer: ${mode}. Reputation ${delta.rep >= 0 ? "+" : ""}${delta.rep.toFixed(1)}${delta.cash ? `, tip +$${delta.cash}` : ""}.` };
}

function getRunningProfitToday() {
  const today = state.day;
  const todayEntries = state.ledger.filter((entry) => entry.day === today && !entry.meta?.accountingOnly);
  return todayEntries.reduce((sum, entry) => sum + entry.amount, 0);
}

function finalizeCurrentSale() {
  const customer = state.activeCustomer;
  const sale = state.activeSale;
  const calibration = state.activeCalibration;
  if (!customer || !sale || !calibration) return { message: "No active sale/setup to finish." };
  const readiness = getCalibrationReadiness(calibration);
  if (!readiness.ready) {
    const missing = readiness.missingSteps.length ? `Missing steps: ${readiness.missingSteps.join(", ")}.` : "";
    const riskNote = readiness.buzzRisk > 55 ? ` Buzz risk is too high (${Math.round(readiness.buzzRisk)}).` : "";
    return { message: `Adjustment not ready for sale. ${missing}${riskNote}`.trim() };
  }
  const result = finalizeCalibration(state, customer);
  const fatiguePenalty = getFatiguePenalty();
  const blendedSatisfaction = Math.max(0, Math.round(customer.satisfaction * 0.35 + result.satisfaction * 0.65 - fatiguePenalty));
  const instrument = getInventoryItem(state, sale.instrumentId);
  const totals = completeSaleTransaction(state, sale, blendedSatisfaction);
  const adjustmentCost = sale.adjustmentCost || 0;
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
  state.dayGoals.customersServed = (state.dayGoals.customersServed || 0) + 1;
  state.activeCustomer = null;
  state.activeSale = null;
  state.activeCalibration = null;
  state.ui.panel = "shop";
  return { message: `Paid $${totals.total.toFixed(2)}. Setup ${result.score}/100, satisfaction ${blendedSatisfaction}/100. Adjustment spend $${adjustmentCost.toFixed(2)}.` };
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
  let onlineOrder = maybePostOnlineOrder(state);
  const todayPosted = state.onlineOrders.filter((order) => order.day === state.day && order.status === "posted").length;
  if (todayPosted < 1) onlineOrder = postGuaranteedOnlineOrder(state) || onlineOrder;
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
  state.dayGoals.customersServed = 0;
  state.dayGoals.customersTarget = 2 + Math.floor(state.rng.next() * 3);
  state.dayGoals.ordersFulfilled = 0;
  state.dayGoals.ordersTarget = 1;
  postGuaranteedOnlineOrder(state);
  state.player.fatigue.actionsToday = 0;
  state.player.fatigue.level = Math.max(0, Math.round(fatigueBeforeReset * 0.35));
  state.dayReport = buildDayReport(state, dayEnded, cashBefore, ledgerCountBefore, events);
  void saveGame(state);
  scheduleDayReportUnlock();
  return { message: `Day ${state.day} begins. ${state.milestoneText}` };
}

function fulfillOnlineOrderAndBackfill(orderId) {
  const result = fulfillOnlineOrder(state, orderId);
  if (!result?.ok) return result;
  const pendingCount = state.onlineOrders.filter((order) => order.status === "posted").length;
  if (pendingCount < 1) postGuaranteedOnlineOrder(state);
  return result;
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
  const cards = [
    { icon: "🗓️", value: `Day ${state.day}` },
    { icon: "💵", value: `$${state.cash.toFixed(2)}` },
    { icon: "⭐", value: `${Math.round(state.stats.publicReputation)}` },
    { icon: "🏛️", value: `${Math.round(state.stats.industryHonor)}` },
    { icon: "🏦", value: `${Math.round(state.stats.creditScore)}` },
    { icon: "😮‍💨", value: `${Math.round(state.player.fatigue.level)}` },
    { icon: "📈", value: `$${getRunningProfitToday().toFixed(2)}` },
    { icon: "🧑‍🤝‍🧑", value: `${state.dayGoals.customersServed}/${state.dayGoals.customersTarget}` },
    { icon: "📦", value: `${state.dayGoals.ordersFulfilled ?? 0}/${state.dayGoals.ordersTarget ?? 1}` },
  ];
  hud.innerHTML = `<div class="hud-line">${cards.map((c)=>`<div class="hud-pill"><span>${c.icon}</span><strong>${c.value}</strong></div>`).join("")}</div>`;
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
      <h3>Roaming Customer Bubble</h3>
      <p class="quote">A browsing customer asks: "Is this model really special edition?"</p>
      <div class="button-row">
        <button data-action="answer-roamer" data-mode="honest">Answer honest</button>
        <button data-action="answer-roamer" data-mode="neutral">Answer neutral</button>
        <button data-action="answer-roamer" data-mode="dishonest" class="danger-button">Answer dishonest</button>
      </div>
      <h3>Simplified Store View (2D zones)</h3>
      <div class="store-zones">
        <div class="store-zone"><strong>Front Counter</strong><span>Customer intake and sales talk</span></div>
        <div class="store-zone"><strong>Shelves</strong><span>Guitars / Keys / Drums display</span></div>
        <div class="store-zone"><strong>Adjustment Bench</strong><span>Setup, repair, QTE work</span></div>
        <div class="store-zone"><strong>Back Area</strong><span>Storage, packing, receiving</span></div>
      </div>
    </section>
  `;
}


function renderQteModal(state) {
  const qte = state.ui.qte;
  if (!qte?.active) return "";
  const remaining = Math.max(0, ((qte.endsAt - Date.now()) / 1000).toFixed(1));
  return `
    <div class="fullscreen-qte">
      <section class="qte-card">
        <h2>Full-Screen Keyboard QTE</h2>
        <p>Press the random key sequence before time runs out.</p>
        <div class="qte-target">${qte.sequence.map((k, i) => i < qte.index ? "✓" : k).join(" ")}</div>
        <p class="muted">Next key: <strong>${qte.sequence[qte.index] || "Done"}</strong> | Time left: ${remaining}s</p>
        <p class="quote">Wrong keys increase setup risk. Correct sequence boosts documentation and explanation quality.</p>
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
  state.dayGoals = { customersTarget: 2, customersServed: 0, ordersFulfilled: 0, ordersTarget: 1, ...(state.dayGoals || {}) };
  if (!state.activeCustomer) state.activeCustomer = createCustomerForDay(state);
  const todayPosted = state.onlineOrders.filter((order) => order.day === state.day && order.status === "posted").length;
  if (todayPosted < 1) postGuaranteedOnlineOrder(state);
  render();
  requestAnimationFrame(frame);
}

initializeGame();
