import { addLedger, getInventoryItem } from "./Economy.ts";
import { pushNotification } from "./Notifications.ts";
import { clamp, round } from "./Rng.ts";

export function maybeTriggerAccident(state) {
  const staffRisk = state.employees.reduce((sum, employee) => sum + employee.mistakeRate * 0.012 + employee.fatigue * 0.0003, 0);
  const crowdRisk = Math.max(0, state.coffee.loungeBuzz - 40) * 0.00025;
  const cleanlinessRisk = Math.max(0, 55 - state.stats.storeCleanliness) * 0.00035;
  const chance = clamp(0.012 + staffRisk + crowdRisk + cleanlinessRisk, 0.005, 0.055);
  if (!state.rng.chance(chance)) return null;
  const candidates = state.inventory.filter((item) => item.stock > 0 && (item.category.toLowerCase().includes("guitar") || item.category.toLowerCase().includes("piano")));
  if (!candidates.length) return null;
  const item = state.rng.pick(candidates);
  item.stock -= 1;
  const isPiano = item.category.toLowerCase().includes("piano");
  const repairCost = round(Math.max(45, item.cost * (isPiano ? state.rng.range(0.08, 0.16) : state.rng.range(0.12, 0.28))), 2);
  const accident = {
    id: `accident-${state.day}-${state.damagedInventory.length}`,
    day: state.day,
    itemId: item.id,
    itemName: item.name,
    category: item.category,
    type: isPiano ? "Broken piano key" : "Dropped guitar",
    repairCost,
    status: "needs-repair",
    causedBy: state.employees.length && state.rng.chance(0.45) ? "staff" : "customer",
  };
  state.damagedInventory.unshift(accident);
  state.stats.publicReputation = clamp(state.stats.publicReputation - (accident.causedBy === "staff" ? 1.8 : 0.8), 0, 100);
  state.stats.storeCleanliness = clamp(state.stats.storeCleanliness - 2, 0, 100);
  pushNotification(state, "accident", accident.type, `${accident.itemName} removed from sellable stock until repaired.`);
  return accident;
}

export function repairDamagedInventory(state, accidentId) {
  const accident = state.damagedInventory.find((item) => item.id === accidentId);
  if (!accident || accident.status !== "needs-repair") return { ok: false, message: "Damaged inventory item not found." };
  const staffHelp = state.employees.reduce((sum, employee) => sum + (employee.assignment === "setup" ? employee.skills.guitarSetup * 0.0015 : 0), 0);
  const discount = clamp(state.player.skill.guitarSetup * 0.002 + staffHelp, 0, 0.35);
  const cost = round(accident.repairCost * (1 - discount), 2);
  if (state.cash < cost) return { ok: false, message: `Need $${cost} to repair this damaged stock.` };
  addLedger(state, "inventory-repair", `Inventory repair: ${accident.itemName}`, -cost);
  const item = getInventoryItem(state, accident.itemId);
  if (item) item.stock += 1;
  accident.status = "repaired";
  state.stats.industryHonor = clamp(state.stats.industryHonor + 0.8, 0, 100);
  pushNotification(state, "accident", "Damaged stock repaired", `${accident.itemName} returned to sellable inventory.`);
  return { ok: true, message: `${accident.itemName} repaired for $${cost}.` };
}
