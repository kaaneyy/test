import { addLedger, getInventoryItem } from "./Economy.ts";
import { pushNotification } from "./Notifications.ts";
import { clamp, round } from "./Rng.ts";

export function maybePostOnlineOrder(state) {
  const chance = clamp(0.16 + state.stats.publicReputation / 850 + state.stats.brandImage / 1100, 0.08, 0.38);
  if (!state.rng.chance(chance)) return null;
  const candidates = state.inventory.filter((item) => item.stock > 0 && item.sellPrice < 1200);
  if (!candidates.length) return null;
  const item = state.rng.pick(candidates);
  const quantity = item.sellPrice < 120 ? state.rng.int(1, 3) : 1;
  const order = {
    id: `online-${state.day}-${state.onlineOrders.length}`,
    day: state.day,
    itemId: item.id,
    itemName: item.name,
    quantity,
    gross: round(item.sellPrice * quantity * 1.03, 2),
    dueDay: state.day + state.rng.int(1, 3),
    status: "posted",
  };
  state.onlineOrders.unshift(order);
  pushNotification(state, "online-order", "Online order posted", `${quantity} x ${item.name} requested. Fulfill from inventory before day ${order.dueDay}.`);
  return order;
}

export function fulfillOnlineOrder(state, orderId) {
  const order = state.onlineOrders.find((item) => item.id === orderId);
  if (!order || order.status !== "posted") return { ok: false, message: "Online order not found." };
  const item = getInventoryItem(state, order.itemId);
  if (!item || item.stock < order.quantity) return { ok: false, message: "Not enough stock to fulfill that online order." };
  item.stock -= order.quantity;
  order.status = "fulfilled";
  addLedger(state, "online-sales", `Online order fulfilled: ${order.itemName}`, order.gross);
  state.stats.publicReputation = clamp(state.stats.publicReputation + 0.8, 0, 100);
  pushNotification(state, "online-order", "Online order fulfilled", `${order.itemName} shipped from stock.`);
  return { ok: true, message: `Fulfilled online order for $${order.gross}.` };
}

export function processOnlineOrderDeadlines(state) {
  const expired = [];
  for (const order of state.onlineOrders) {
    if (order.status === "posted" && order.dueDay < state.day) {
      order.status = "missed";
      state.stats.publicReputation = clamp(state.stats.publicReputation - 1.5, 0, 100);
      expired.push(order);
      pushNotification(state, "online-order", "Online order missed", `${order.itemName} was not fulfilled in time.`);
    }
  }
  return expired;
}


export function postGuaranteedOnlineOrder(state) {
  const candidates = state.inventory.filter((item) => item.stock > 0 && item.sellPrice < 1200);
  if (!candidates.length) return null;
  const item = state.rng.pick(candidates);
  const order = {
    id: `online-guaranteed-${state.day}-${state.onlineOrders.length}`,
    day: state.day,
    itemId: item.id,
    itemName: item.name,
    quantity: 1,
    gross: round(item.sellPrice * 1.03, 2),
    dueDay: state.day + 2,
    status: "posted",
  };
  state.onlineOrders.unshift(order);
  pushNotification(state, "online-order", "Guaranteed online order", `Daily baseline order posted: ${item.name}.`);
  return order;
}
