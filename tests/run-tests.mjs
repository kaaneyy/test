import assert from "node:assert/strict";
import { createInitialState } from "../src/core/GameState.ts";
import { createCustomerForDay, askQuestion, evaluateRecommendation } from "../src/core/Customers.ts";
import { startCalibration, applyCalibrationAction, scoreCalibration } from "../src/core/Calibration.ts";
import { calculateSaleTotals, completeSaleTransaction } from "../src/core/Economy.ts";
import { setupProcedures } from "../src/data/calibrationProfiles.ts";
import { acceptOutsideJob, completeOutsideJob } from "../src/core/Jobs.ts";
import { applyPianoAction, scorePianoInstall } from "../src/core/Piano.ts";
import { placeSupplierOrder, processSupplierOrders } from "../src/core/Suppliers.ts";
import { createWarrantyRecord, openWarrantyClaim, resolveWarrantyClaim } from "../src/core/Warranty.ts";
import { hostCoffeeChat, sellCoffee } from "../src/core/Coffee.ts";
import { repairDamagedInventory } from "../src/core/Accidents.ts";
import { fulfillOnlineOrder } from "../src/core/OnlineOrders.ts";

function testEconomy() {
  const state = createInitialState(10);
  const customer = createCustomerForDay(state);
  const instrument = state.inventory.find((item) => item.stock > 0);
  const service = setupProcedures.find((item) => item.id === "basic-setup");
  const sale = {
    id: "test-sale",
    customerLabel: customer.label,
    instrumentId: instrument.id,
    instrumentName: instrument.name,
    accessoryIds: ["clip-tuner", "basic-picks"],
    servicePrice: service.price,
  };
  const totals = calculateSaleTotals(state, sale);
  assert.equal(totals.productRevenue > instrument.sellPrice, true);
  assert.equal(totals.salesTax > 0, true);
  const before = state.cash;
  completeSaleTransaction(state, sale, 82);
  assert.equal(state.cash > before, true);
  assert.equal(state.taxDue > 0, true);
}

function testSatisfactionQuestions() {
  const state = createInitialState(11);
  const customer = createCustomerForDay(state);
  const before = customer.satisfaction;
  askQuestion(state, customer, "who-plays");
  askQuestion(state, customer, "budget-range");
  assert.equal(customer.discoveredFacts.length >= 3, true);
  assert.notEqual(customer.satisfaction, before);
  const instrument = state.inventory.find((item) => item.stock > 0);
  const result = evaluateRecommendation(customer, instrument, ["clip-tuner"], state);
  assert.equal(result.fitScore >= 0 && result.fitScore <= 100, true);
}

function testSameDayCustomerIntentVariety() {
  const state = createInitialState(111);
  const first = createCustomerForDay(state);
  const second = createCustomerForDay(state);
  const third = createCustomerForDay(state);
  const archetypes = new Set([first.archetypeId, second.archetypeId, third.archetypeId]);
  const goals = new Set([first.visitGoal.id, second.visitGoal.id, third.visitGoal.id]);
  assert.equal(archetypes.size > 1, true);
  assert.equal(goals.size > 1, true);
}

function testCalibrationScoring() {
  const state = createInitialState(12);
  const customer = createCustomerForDay(state);
  const instrument = state.inventory.find((item) => item.profileId === "ElectricGuitarStandard" && item.stock > 0);
  const calibration = startCalibration(state, instrument, customer, "full-setup");
  const rough = scoreCalibration(calibration, customer, 50, 70).score;
  for (const action of ["inspect", "tune", "tighten-truss", "wait-neck", "lower-bridge", "intonate-forward", "replace-strings", "stretch-strings", "clean-body", "fret-check", "play-test", "document"]) {
    applyCalibrationAction(calibration, action, state);
  }
  const improved = scoreCalibration(calibration, customer, 62, 75).score;
  assert.equal(improved >= rough - 20, true);
  assert.equal(improved >= 0 && improved <= 100, true);
}

function testPianoInstallScoring() {
  const state = createInitialState(13);
  state.day = 4;
  const accepted = acceptOutsideJob(state, "concert-hall-grand-piano");
  assert.equal(accepted.ok, true);
  for (const action of ["site-inspection", "protect-route", "level-placement", "humidity-reading", "acclimate", "pitch-raise", "fine-tune", "unison-cleanup", "octave-stretch", "key-leveling", "action-regulation", "pedal-regulation", "voice-hammers", "artist-playtest", "acceptance-report"]) {
    applyPianoAction(state, action);
  }
  const score = scorePianoInstall(state);
  assert.equal(score.score > 50, true);
  const result = completeOutsideJob(state);
  assert.equal(typeof result.accepted, "boolean");
}

function testSupplierAndWarranty() {
  const state = createInitialState(14);
  const order = placeSupplierOrder(state, "precisionne-p4-student", 1);
  assert.equal(order.ok, true);
  const pending = state.supplierOrders[0];
  state.day = pending.arrivalDay;
  const arrived = processSupplierOrders(state);
  assert.equal(arrived.length, 1);

  const warranty = createWarrantyRecord(
    state,
    { id: "sale-x", serviceId: "full-setup", customerLabel: "Tester", instrumentName: "Fendrake Streetcaster S-90" },
    { total: 400 },
    { risks: { discoverySeverity: 0.25 } },
    { documentationQuality: 40, dishonestActions: [] },
  );
  assert.equal(warranty.status, "active");
  const claim = openWarrantyClaim(state, {
    customerLabel: "Tester",
    instrumentName: "Fendrake Streetcaster S-90",
    severity: 0.4,
    dishonest: false,
    value: 400,
  });
  const resolved = resolveWarrantyClaim(state, claim.id, "honor");
  assert.equal(resolved.ok, true);
}

function testCoffeeRevenue() {
  const state = createInitialState(15);
  const before = state.cash;
  const sold = sellCoffee(state, 2);
  assert.equal(sold.ok, true);
  assert.equal(state.cash > before, true);
  const blocked = sellCoffee(state, 99);
  assert.equal(blocked.ok, false);
  state.coffee.dailyDemand = 6;
  const chat = hostCoffeeChat(state);
  assert.equal(chat.ok, true);
  assert.equal(state.coffee.cupsSold >= 3, true);
}

function testOnlineOrderAndAccidentRepair() {
  const state = createInitialState(16);
  const item = state.inventory.find((entry) => entry.stock > 0);
  const stockBefore = item.stock;
  state.onlineOrders.push({
    id: "online-test",
    day: 1,
    itemId: item.id,
    itemName: item.name,
    quantity: 1,
    gross: item.sellPrice,
    dueDay: 2,
    status: "posted",
  });
  const fulfilled = fulfillOnlineOrder(state, "online-test");
  assert.equal(fulfilled.ok, true);
  assert.equal(item.stock, stockBefore - 1);

  state.damagedInventory.push({
    id: "damage-test",
    day: 1,
    itemId: item.id,
    itemName: item.name,
    category: item.category,
    type: "Dropped guitar",
    repairCost: 50,
    status: "needs-repair",
    causedBy: "customer",
  });
  const repaired = repairDamagedInventory(state, "damage-test");
  assert.equal(repaired.ok, true);
  assert.equal(item.stock, stockBefore);
}

testEconomy();
testSatisfactionQuestions();
testSameDayCustomerIntentVariety();
testCalibrationScoring();
testPianoInstallScoring();
testSupplierAndWarranty();
testCoffeeRevenue();
testOnlineOrderAndAccidentRepair();
console.log("All tests passed.");
