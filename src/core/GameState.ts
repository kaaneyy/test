import { instruments } from "../data/instruments.ts";
import { accessories } from "../data/accessories.ts";
import { branchSizes, employeeCandidates, loanOffers } from "../data/business.ts";
import { outsideJobs } from "../data/jobs.ts";
import { SeededRng } from "./Rng.ts";

export const SAVE_KEY = "finetune-empire-save-v2";

export function createInitialState(seed = 44107) {
  const branch = structuredClone(branchSizes[0]);
  return {
    version: 1,
    seed,
    rng: new SeededRng(seed),
    day: 1,
    open: true,
    hour: 9,
    minute: 0,
    milestoneText: "Day 1: make your first sale and complete a real setup.",
    cash: 1450,
    bankBalance: 0,
    debt: 0,
    taxDue: 0,
    salesTaxRate: 0.08,
    serviceTaxRate: 0.04,
    inventory: structuredClone(instruments),
    accessories: structuredClone(accessories),
    branch,
    branches: [branch],
    currentBranchId: "tiny",
    shopBounds: {
      width: branch.floorWidth,
      height: branch.floorHeight,
    },
    ledger: [
      {
        day: 1,
        type: "opening",
        label: "Opening cash and starter stock",
        amount: 1450,
        balanceAfter: 1450,
      },
    ],
    stats: {
      creditScore: 545,
      publicReputation: 32,
      industryHonor: 28,
      brandImage: 34,
      customerSatisfactionAverage: 50,
      repeatCustomerRate: 8,
      referralRate: 5,
      legalRisk: 4,
      warrantyLiability: 0,
      staffMorale: 60,
      toolCondition: 72,
      calibrationAccuracy: 45,
      deliveryPunctuality: 58,
      supplierTrust: 38,
      artistVenueTrust: 22,
      localCommunityTrust: 32,
      storeCleanliness: 72,
    },
    employees: [],
    employeeCandidates: structuredClone(employeeCandidates),
    loanOffers: structuredClone(loanOffers),
    loans: [],
    activeCustomer: null,
    customerQueue: [],
    customerHistory: [],
    customerIntentTracker: {
      day: 1,
      usedArchetypes: [],
      usedGoals: [],
    },
    shopVisitors: [],
    coffee: {
      price: 4,
      cost: 0.85,
      cupsSold: 0,
      servedToday: 0,
      dailyDemand: 2,
      demandDay: 1,
      revenue: 0,
      beansStock: 32,
      loungeBuzz: 18,
      seating: 6,
    },
    activeSale: null,
    activeCalibration: null,
    activeOutsideJob: null,
    outsideJobs: structuredClone(outsideJobs),
    supplierOrders: [],
    pendingInvoices: [],
    onlineOrders: [],
    damagedInventory: [],
    warranties: [],
    warrantyClaims: [],
    facilities: [],
    houseBrandBatches: [],
    customOrders: [],
    audits: [],
    activePianoInstall: null,
    dayReport: null,
    notifications: [],
    logistics: {
      warehouseCapacity: 0,
      warehouseUsed: 0,
      freightDiscount: 0,
      leadTimeReduction: 0,
      serviceCenterCapacity: 0,
      factoryCapacity: 0,
    },
    pendingDefects: [],
    reviews: [],
    shelfDisplay: [null, null, null],
    incidents: [],
    randomEventsSeen: [],
    dayGoals: { customersTarget: 2, customersServed: 0 },
    unlocked: {
      bank: false,
      employees: false,
      outsideJobs: false,
      smallBranches: false,
      warehouse: false,
      factory: false,
      serviceCenter: false,
    },
    settings: {
      servicePriceMultiplier: 1,
      productMarkupMood: "fair",
    },
    player: {
      created: false,
      skillPoints: 10,
      x: 215,
      y: 320,
      speed: 165,
      facing: "down",
      skill: {
        sales: 46,
        guitarSetup: 48,
        documentation: 36,
        accounting: 32,
        repair: 30,
        fame: 30,
        insight: 30,
        economy: 30,
        honesty: 30,
      },
      fatigue: {
        actionsToday: 0,
        level: 0,
      },
    },
    ui: {
      panel: "welcome",
      toast: "",
      selectedInventoryId: null,
      selectedAccessoryIds: [],
      selectedServiceId: "basic-setup",
      selectedOutsideJobId: null,
      qte: null,
      selectedShelfSlot: null,
    },
  };
}

export function reviveState(rawState) {
  const state = rawState || createInitialState();
  const fresh = createInitialState(state.seed || 44107);
  for (const key of ["supplierOrders", "pendingInvoices", "onlineOrders", "damagedInventory", "warranties", "warrantyClaims", "facilities", "houseBrandBatches", "customOrders", "audits", "notifications"]) {
    if (!Array.isArray(state[key])) state[key] = [];
  }
  if (!state.customerIntentTracker) state.customerIntentTracker = structuredClone(fresh.customerIntentTracker);
  if (!Array.isArray(state.shopVisitors)) state.shopVisitors = [];
  state.coffee = { ...fresh.coffee, ...(state.coffee || {}) };
  state.logistics = { ...fresh.logistics, ...(state.logistics || {}) };
  state.shopBounds = { ...fresh.shopBounds, ...(state.shopBounds || {}) };
  state.unlocked = { ...fresh.unlocked, ...(state.unlocked || {}) };
  state.stats = { ...fresh.stats, ...(state.stats || {}) };
  state.ui = { ...fresh.ui, ...(state.ui || {}) };
  if (state.ui.toast?.startsWith("Simulation disclaimer:")) state.ui.toast = "";
  if (!("activePianoInstall" in state)) state.activePianoInstall = null;
  if (!("dayReport" in state)) state.dayReport = null;
  state.rng = new SeededRng(state.seed || 44107);
  for (let i = 0; i < (state.day || 1) * 13 + (state.ledger?.length || 0); i += 1) {
    state.rng.next();
  }
  return state;
}

export async function saveGame(state) {
  if (typeof localStorage === "undefined") return false;
  const copy = structuredClone(state);
  delete copy.rng;
  localStorage.setItem(SAVE_KEY, JSON.stringify(copy));
  if (typeof fetch !== "undefined") {
    try {
      await fetch("/api/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(copy) });
    } catch {}
  }
  return true;
}

export async function loadGame() {
  if (typeof fetch !== "undefined") {
    try {
      const response = await fetch("/api/load");
      const payload = await response.json();
      if (payload?.state) return reviveState(payload.state);
    } catch {}
  }
  if (typeof localStorage === "undefined") return null;
  const saved = localStorage.getItem(SAVE_KEY);
  if (!saved) return null;
  try {
    return reviveState(JSON.parse(saved));
  } catch (error) {
    console.warn("Could not load save", error);
    return null;
  }
}

export async function resetSave() {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(SAVE_KEY);
  if (typeof fetch !== "undefined") {
    try {
      await fetch("/api/reset", { method: "POST" });
    } catch {}
  }
}

export function getDayMilestone(day) {
  const milestones = {
    1: "Day 1: basic sales and first setup.",
    2: "Day 2: more customers and first accessory upsell.",
    3: "Day 3: balance price, patience, and setup quality.",
    4: "Day 4: outside jobs unlock. Leaving the shop costs time.",
    5: "Day 5: rent and tax warning. Keep cash breathing.",
    6: "Day 6: bank loan offers appear.",
    7: "Day 7: hire a helper if cash and reputation allow.",
  };
  return milestones[day] || "Survive, document, reinvest, and keep the instruments honest.";
}
