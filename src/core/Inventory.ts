import { recommendInventory, chooseRecommendedAccessories } from "./Customers.ts";

export function getStockSummary(state) {
  const instruments = state.inventory.filter((item) => item.stock > 0);
  const accessories = state.accessories.filter((item) => item.stock > 0);
  return {
    instrumentCount: instruments.reduce((sum, item) => sum + item.stock, 0),
    accessoryCount: accessories.reduce((sum, item) => sum + item.stock, 0),
    inventoryValue: instruments.reduce((sum, item) => sum + item.cost * item.stock, 0) + accessories.reduce((sum, item) => sum + item.cost * item.stock, 0),
  };
}

export function getRecommendationsForCustomer(state, customer) {
  const recommendations = recommendInventory(state, customer);
  return recommendations.map((entry) => ({
    ...entry,
    accessories: chooseRecommendedAccessories(state, customer, entry.item, 3),
  }));
}
