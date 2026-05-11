import { customOrderTemplates, expansionOptions, houseBrandPlans } from "../data/business.ts";
import { branchSizes } from "../data/business.ts";
import { addLedger } from "./Economy.ts";
import { clamp, round } from "./Rng.ts";

export function openExpansion(state, optionId) {
  const option = expansionOptions.find((item) => item.id === optionId);
  if (!option) return { ok: false, message: "Expansion option not found." };
  if (state.cash < option.cost) return { ok: false, message: `Need $${option.cost} to open this expansion.` };
  if (state.stats.publicReputation < option.requiredReputation) return { ok: false, message: "Public reputation is too low for this expansion." };
  if (state.stats.creditScore < option.requiredCredit) return { ok: false, message: "Credit score is too low for this expansion." };
  addLedger(state, "branch-expansion", option.label, -option.cost);
  const facility = {
    id: `${option.id}-${state.day}`,
    optionId: option.id,
    type: option.type,
    label: option.label,
    openedDay: state.day,
    dailyUpkeep: option.dailyUpkeep,
    effects: structuredClone(option.effects),
  };
  state.facilities.push(facility);
  applyFacilityEffects(state, facility);
  state.stats.brandImage = clamp(state.stats.brandImage + 3, 0, 100);
  return { ok: true, message: `${option.label} opened.` };
}

function applyFacilityEffects(state, facility) {
  const effects = facility.effects || {};
  if (facility.type === "warehouse") {
    state.unlocked.warehouse = true;
    state.logistics.warehouseCapacity += effects.storageCapacity || 0;
    state.logistics.freightDiscount = Math.max(state.logistics.freightDiscount, effects.freightDiscount || 0);
    state.logistics.leadTimeReduction = Math.max(state.logistics.leadTimeReduction, effects.leadTimeReduction || 0);
  }
  if (facility.type === "service-center") {
    state.unlocked.serviceCenter = true;
    state.logistics.serviceCenterCapacity += effects.setupCapacity || 0;
    state.stats.calibrationAccuracy = clamp(state.stats.calibrationAccuracy + 4, 0, 100);
  }
  if (facility.type === "factory") {
    state.unlocked.factory = true;
    state.logistics.factoryCapacity += effects.customCapacity || 0;
  }
  if (facility.type === "branch") {
    state.unlocked.smallBranches = true;
    const nextBranch = branchSizes.find((branch) => branch.id === "small");
    if (nextBranch && state.branch.id === "tiny") {
      state.branch = structuredClone(nextBranch);
      state.currentBranchId = nextBranch.id;
      state.shopBounds = { width: nextBranch.floorWidth, height: nextBranch.floorHeight };
      state.player.x = Math.min(state.player.x + 80, nextBranch.floorWidth - 65);
      state.player.y = Math.min(state.player.y + 40, nextBranch.floorHeight - 65);
    }
    state.branches.push({
      id: facility.id,
      label: facility.label,
      size: "small",
      rentMonthly: 1800,
      utilitiesDaily: 22,
      miscDaily: 28,
      footTraffic: facility.effects.footTraffic || 1.4,
      storageCapacity: 55,
      displayCapacity: facility.effects.displayCapacity || 24,
      workbenchSlots: 2,
      staffSlots: facility.effects.staffSlots || 3,
      cleanliness: 70,
      security: 55,
      localReputation: state.stats.publicReputation,
      managerAssigned: null,
      maintenanceCostDaily: facility.dailyUpkeep,
      theftRisk: 0.018,
      damageRisk: 0.035,
      deliveryRangeKm: 28,
    });
    state.stats.publicReputation = clamp(state.stats.publicReputation + 2, 0, 100);
  }
}

export function launchHouseBrandBatch(state, planId) {
  const plan = houseBrandPlans.find((item) => item.id === planId);
  if (!plan) return { ok: false, message: "House-brand plan not found." };
  if (!state.unlocked.factory) return { ok: false, message: "Open a house-brand workshop first." };
  const cost = plan.unitCost * plan.batchSize;
  if (state.cash < cost) return { ok: false, message: `Need $${cost} to start this batch.` };
  addLedger(state, "factory-costs", `House-brand batch: ${plan.label}`, -cost);
  state.houseBrandBatches.push({
    id: `batch-${state.day}-${state.houseBrandBatches.length}`,
    planId: plan.id,
    label: plan.label,
    category: plan.category,
    batchSize: plan.batchSize,
    unitCost: plan.unitCost,
    sellPrice: plan.sellPrice,
    qcDifficulty: plan.qcDifficulty,
    startedDay: state.day,
    readyDay: state.day + plan.buildDays,
    status: "building",
  });
  return { ok: true, message: `${plan.label} batch started. Ready day ${state.day + plan.buildDays}.` };
}

export function startCustomOrder(state, templateId) {
  const template = customOrderTemplates.find((item) => item.id === templateId);
  if (!template) return { ok: false, message: "Custom order template not found." };
  if (state.stats.industryHonor < template.requiredHonor) return { ok: false, message: "Industry honor is too low for this custom order." };
  if (state.cash < template.cost - template.deposit) return { ok: false, message: "Need more cash to cover custom-order build risk." };
  addLedger(state, "custom-order-deposit", `Deposit: ${template.label}`, template.deposit);
  addLedger(state, "custom-order-cost", `Build costs: ${template.label}`, -template.cost);
  state.customOrders.push({
    id: `custom-${state.day}-${state.customOrders.length}`,
    templateId: template.id,
    label: template.label,
    revenue: template.revenue,
    cost: template.cost,
    deposit: template.deposit,
    dueDay: state.day + template.leadDays,
    patienceRisk: template.patienceRisk,
    specRisk: template.specRisk,
    status: "building",
  });
  return { ok: true, message: `${template.label} started. Due day ${state.day + template.leadDays}.` };
}

export function processExpansionDaily(state) {
  const upkeep = state.facilities.reduce((sum, item) => sum + item.dailyUpkeep, 0);
  if (upkeep > 0) addLedger(state, "branch-maintenance", "Facility upkeep", -upkeep);

  for (const batch of state.houseBrandBatches) {
    if (batch.status === "building" && batch.readyDay <= state.day) {
      const qc = state.stats.industryHonor * 0.55 + state.stats.calibrationAccuracy * 0.45 - batch.qcDifficulty + state.rng.range(-10, 10);
      batch.status = qc >= 0 ? "ready" : "defective";
      if (batch.status === "ready") {
        state.inventory.push({
          id: `${batch.planId}-${batch.id}`,
          name: batch.label,
          brand: "FineTune",
          model: batch.label.replace("FineTune ", ""),
          category: batch.category,
          categoryGroup: batch.category.includes("Bass") ? "Basses" : "Guitars",
          cost: batch.unitCost,
          sellPrice: batch.sellPrice,
          condition: "House-brand QC passed",
          qualityTier: "Student",
          weightKg: 3.4,
          spaceUnits: 2,
          warrantyRisk: 0.18,
          setupRequired: true,
          targetCustomerTags: ["house-brand", "student", "value"],
          maintenanceNeeds: ["qc-report", "setup"],
          supplier: "FineTune Workshop",
          leadTimeDays: 0,
          rarity: "House batch",
          authenticity: "FineTune QC sheet",
          profileId: batch.category.includes("Bass") ? "BassGuitarStandard" : "ElectricGuitarStandard",
          stock: batch.batchSize,
          recommendedAccessories: ["clip-tuner", "gig-bag-basic", "setup-plan-full"],
        });
        state.stats.brandImage = clamp(state.stats.brandImage + 2, 0, 100);
      } else {
        state.stats.publicReputation = clamp(state.stats.publicReputation - 3, 0, 100);
        state.stats.industryHonor = clamp(state.stats.industryHonor - 5, 0, 100);
      }
    }
  }

  for (const order of state.customOrders) {
    if (order.status === "building" && order.dueDay <= state.day) {
      const specScore = state.stats.industryHonor / 100 - order.specRisk + state.rng.range(-0.2, 0.25);
      if (specScore >= 0) {
        const finalPayment = order.revenue - order.deposit;
        addLedger(state, "custom-order-revenue", `Custom order delivered: ${order.label}`, finalPayment);
        order.status = "delivered";
        state.stats.industryHonor = clamp(state.stats.industryHonor + 3, 0, 100);
        state.stats.publicReputation = clamp(state.stats.publicReputation + 1, 0, 100);
      } else {
        order.status = "rework";
        addLedger(state, "custom-order-rework", `Rework: ${order.label}`, -Math.min(260, order.cost * 0.18));
        state.stats.industryHonor = clamp(state.stats.industryHonor - 4, 0, 100);
        state.stats.legalRisk = clamp(state.stats.legalRisk + 3, 0, 100);
      }
    }
  }
}

export function getExpansionData() {
  return { expansionOptions, houseBrandPlans, customOrderTemplates };
}
