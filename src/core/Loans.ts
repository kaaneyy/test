import { takeLoan, processLoanPayments } from "./Economy.ts";

export { takeLoan, processLoanPayments };

export function getEligibleLoanOffers(state) {
  return state.loanOffers.map((offer) => ({
    ...offer,
    eligible: state.stats.creditScore >= offer.minCreditScore,
  }));
}
