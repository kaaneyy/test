import { addLedger } from "./Economy.ts";
import { clamp, round } from "./Rng.ts";

export function sellCoffee(state, cups = 1) {
  ensureCoffeeDemand(state);
  const count = Math.max(1, Number(cups) || 1);
  const remainingDemand = Math.max(0, state.coffee.dailyDemand - state.coffee.servedToday);
  if (remainingDemand <= 0) return { ok: false, message: "No one else wants coffee right now. The espresso machine cannot print money." };
  if (count > remainingDemand) return { ok: false, message: `Only ${remainingDemand} coffee order(s) are realistic right now.` };
  if (state.coffee.beansStock < count) return { ok: false, message: "Coffee beans are out. The lounge is now just chairs with ambition." };
  const revenue = state.coffee.price * count;
  const cost = state.coffee.cost * count;
  state.coffee.beansStock -= count;
  state.coffee.cupsSold += count;
  state.coffee.servedToday += count;
  state.coffee.revenue = round(state.coffee.revenue + revenue, 2);
  state.coffee.loungeBuzz = clamp(state.coffee.loungeBuzz + count * 1.8, 0, 100);
  addLedger(state, "coffee-revenue", `Coffee bar: ${count} cup(s)`, revenue);
  addLedger(state, "coffee-cogs", "Coffee beans and cups", -cost);
  if (state.activeCustomer?.visitGoal?.id === "coffee-browse") {
    state.activeCustomer.satisfaction = clamp(state.activeCustomer.satisfaction + 6, 0, 100);
    state.activeCustomer.discoveredFacts.push("Coffee made them linger, so the sale conversation has more room to breathe.");
  }
  state.stats.publicReputation = clamp(state.stats.publicReputation + 0.2 * count, 0, 100);
  return { ok: true, message: `Sold ${count} coffee cup(s) for $${round(revenue, 2)}.` };
}

export function hostCoffeeChat(state) {
  ensureCoffeeDemand(state);
  const cups = Math.min(3, Math.max(1, Math.floor((state.stats.publicReputation + state.coffee.loungeBuzz) / 42)));
  const result = sellCoffee(state, cups);
  if (!result.ok) return result;
  state.coffee.loungeBuzz = clamp(state.coffee.loungeBuzz + 7, 0, 100);
  state.stats.referralRate = clamp(state.stats.referralRate + 1.2, 0, 100);
  state.stats.localCommunityTrust = clamp(state.stats.localCommunityTrust + 1.4, 0, 100);
  return { ok: true, message: `${result.message} The lounge chat nudged referrals upward.` };
}

export function ensureCoffeeDemand(state) {
  if (state.coffee.demandDay === state.day) return;
  const activeBonus = state.activeCustomer?.visitGoal?.id === "coffee-browse" ? 2 : state.activeCustomer ? 1 : 0;
  const ambient = Math.floor(state.stats.publicReputation / 32) + Math.floor(state.coffee.loungeBuzz / 35);
  state.coffee.demandDay = state.day;
  state.coffee.servedToday = 0;
  state.coffee.dailyDemand = clamp(1 + activeBonus + ambient, 1, state.coffee.seating + 2);
}

export function restockCoffee(state) {
  const cost = 18;
  if (state.cash < cost) return { ok: false, message: "Not enough cash to restock coffee beans." };
  addLedger(state, "coffee-supplies", "Coffee bean restock", -cost);
  state.coffee.beansStock += 36;
  return { ok: true, message: "Coffee beans restocked." };
}
