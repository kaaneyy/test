import { branchSizes } from "../data/business.ts";

export function getBranchSizes() {
  return branchSizes;
}

export function describeBranch(branch) {
  return `${branch.label}: ${branch.displayCapacity} display slots, ${branch.workbenchSlots} workbench slot(s), ${branch.staffSlots} staff slot(s), $${branch.rentMonthly}/month rent.`;
}
