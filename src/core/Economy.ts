import { clamp, round } from "./Rng.ts";
import { getDayMilestone } from "./GameState.ts";

export function addLedger(state, type, label, amount, meta = {}) {
  const cashImpact = meta.accountingOnly ? 0 : amount;
  state.cash = round(state.cash + cashImpact, 2);
  const entry = {
    day: state.day,
    type,
    label,
    amount: round(amount, 2),
    balanceAfter: round(state.cash, 2),
    meta,
  };
  state.ledger.unshift(entry);
  if (state.ledger.length > 120) state.ledger.length = 120;
  return entry;
}

export function getInventoryItem(state, id) {
  return state.inventory.find((item) => item.id === id);
}

export function getAccessory(state, id) {
  return state.accessories.find((item) => item.id === id);
}

export function calculateSaleTotals(state, sale) {
  const instrument = getInventoryItem(state, sale.instrumentId);
  const accessories = (sale.accessoryIds || []).map((id) => getAccessory(state, id)).filter(Boolean);
  const servicePrice = sale.servicePrice || 0;
  const instrumentPrice = instrument ? instrument.sellPrice : 0;
  const accessoryPrice = accessories.reduce((sum, item) => sum + item.sellPrice, 0);
  const productRevenue = instrumentPrice + accessoryPrice;
  const serviceRevenue = servicePrice;
  const salesTax = productRevenue * state.salesTaxRate;
  const serviceTax = serviceRevenue * state.serviceTaxRate;
  const total = productRevenue + serviceRevenue + salesTax + serviceTax;
  const costOfGoods = (instrument ? instrument.cost : 0) + accessories.reduce((sum, item) => sum + item.cost, 0);
  return {
    instrument,
    accessories,
    productRevenue: round(productRevenue, 2),
    serviceRevenue: round(serviceRevenue, 2),
    salesTax: round(salesTax, 2),
    serviceTax: round(serviceTax, 2),
    total: round(total, 2),
    costOfGoods: round(costOfGoods, 2),
    grossMargin: round(productRevenue + serviceRevenue - costOfGoods, 2),
  };
}

export function completeSaleTransaction(state, sale, satisfactionScore) {
  const totals = calculateSaleTotals(state, sale);
  if (totals.instrument) totals.instrument.stock = Math.max(0, totals.instrument.stock - 1);
  for (const accessory of totals.accessories) {
    if (accessory.stock < 90) accessory.stock = Math.max(0, accessory.stock - 1);
  }

  state.taxDue = round(state.taxDue + totals.salesTax + totals.serviceTax, 2);
  addLedger(state, "sales-revenue", `Sale: ${totals.instrument?.name || "service"}`, totals.productRevenue, { saleId: sale.id });
  if (totals.serviceRevenue) addLedger(state, "service-revenue", "Setup/service labor", totals.serviceRevenue, { saleId: sale.id });
  addLedger(state, "tax-collected", "Sales/service tax collected", totals.salesTax + totals.serviceTax, { liability: true });
  addLedger(state, "cogs", "Cost of goods sold", -totals.costOfGoods, { accountingOnly: true });

  const review = buildReviewFromSatisfaction(state.day, satisfactionScore, sale.customerLabel, sale.instrumentName);
  state.reviews.unshift(review);
  state.customerHistory.unshift({
    day: state.day,
    label: sale.customerLabel,
    satisfaction: satisfactionScore,
    instrument: sale.instrumentName,
    total: totals.total,
  });
  updateAveragesAfterCustomer(state, satisfactionScore);
  return totals;
}

export function buildReviewFromSatisfaction(day, score, customerLabel, instrumentName) {
  let text = "Fair enough. I got what I paid for.";
  if (score >= 96) text = "They asked what I actually needed and made the instrument feel like mine.";
  else if (score >= 81) text = "Great service, clear explanations, and the setup felt carefully done.";
  else if (score >= 61) text = "Solid shop. Not flashy, but the guitar left playable.";
  else if (score >= 41) text = "Cheap-ish, but I am not sure they understood what I wanted.";
  else if (score >= 21) text = "My guitar buzzed after a week and the whole thing felt rushed.";
  else text = "They sold me stuff I did not need and the setup was a mess.";
  return {
    day,
    customerLabel,
    instrumentName,
    score,
    text,
  };
}

export function updateAveragesAfterCustomer(state, satisfaction) {
  const oldAverage = state.stats.customerSatisfactionAverage;
  const count = Math.max(1, state.customerHistory.length);
  state.stats.customerSatisfactionAverage = round((oldAverage * Math.max(0, count - 1) + satisfaction) / count, 1);
  state.stats.repeatCustomerRate = clamp(round(state.stats.repeatCustomerRate + (satisfaction - 55) / 30, 1), 0, 100);
  state.stats.referralRate = clamp(round(state.stats.referralRate + (satisfaction - 60) / 35, 1), 0, 100);
}

export function processEndOfDay(state) {
  const branch = state.branch;
  const dailyRent = branch.rentMonthly / 30;
  const utility = branch.utilitiesDaily;
  const misc = branch.miscDaily + Math.max(0, 80 - state.stats.storeCleanliness) * 0.15;
  addLedger(state, "rent", "Daily rent allocation", -dailyRent);
  addLedger(state, "utilities", "Utilities", -utility);
  addLedger(state, "misc", "Cleaning, bags, card fees, and tiny mysterious expenses", -misc);

  const payroll = state.employees.reduce((sum, employee) => sum + employee.wageDaily, 0);
  if (payroll > 0) {
    addLedger(state, "wages", "Daily payroll", -payroll);
    state.stats.staffMorale = clamp(state.stats.staffMorale + 0.4, 0, 100);
  }

  processLoanPayments(state);
  state.stats.storeCleanliness = clamp(state.stats.storeCleanliness - branch.cleanlinessDecay, 0, 100);
  state.stats.toolCondition = clamp(state.stats.toolCondition - 0.8, 0, 100);

  if (state.cash < 0) {
    state.stats.creditScore = clamp(state.stats.creditScore - 10, 300, 850);
    state.stats.legalRisk = clamp(state.stats.legalRisk + 2, 0, 100);
    state.ui.toast = "Cash went negative. Credit takes a hit and suppliers start looking nervous.";
  }

  if (state.day === 5) {
    state.ui.toast = `Rent and taxes are coming due. Current tax liability is $${round(state.taxDue, 2)}.`;
  }
  if (state.day === 6) {
    state.unlocked.bank = true;
    state.ui.toast = "Bank offers are available. A loan can help, but payments do not care about your dreams.";
  }
  if (state.day >= 7 && state.cash > 1600 && state.stats.publicReputation >= 34) {
    state.unlocked.employees = true;
  }

  state.day += 1;
  state.hour = 9;
  state.minute = 0;
  state.open = true;
  state.activeCustomer = null;
  state.activeSale = null;
  state.activeCalibration = null;
  state.milestoneText = getDayMilestone(state.day);
  if (state.day === 4) state.unlocked.outsideJobs = true;
  return state;
}

export function createPendingInvoice(state, label, amount, dueDays, risk = 0.12) {
  const invoice = {
    id: `invoice-${state.day}-${state.pendingInvoices.length}`,
    label,
    amount: round(amount, 2),
    issuedDay: state.day,
    dueDay: state.day + dueDays,
    risk,
    status: "open",
  };
  state.pendingInvoices.push(invoice);
  addLedger(state, "invoice-issued", `Invoice issued: ${label}`, 0, { accountingOnly: true, amount });
  return invoice;
}

export function processPendingInvoices(state) {
  const paid = [];
  for (const invoice of state.pendingInvoices) {
    if (invoice.status === "open" && invoice.dueDay <= state.day) {
      const late = state.rng.chance(invoice.risk * (1.2 - state.stats.publicReputation / 160));
      if (late) {
        invoice.dueDay += state.rng.int(2, 5);
        invoice.risk = Math.min(0.75, invoice.risk + 0.08);
        state.stats.creditScore = clamp(state.stats.creditScore - 2, 300, 850);
      } else {
        invoice.status = "paid";
        addLedger(state, "invoice-payment", `Invoice paid: ${invoice.label}`, invoice.amount);
        state.stats.creditScore = clamp(state.stats.creditScore + 2, 300, 850);
        paid.push(invoice);
      }
    }
  }
  state.pendingInvoices = state.pendingInvoices.filter((invoice) => invoice.status !== "paid");
  return paid;
}

export function processLoanPayments(state) {
  for (const loan of state.loans) {
    loan.daysSincePayment += 1;
    if (loan.daysSincePayment >= loan.paymentEveryDays && loan.remainingPrincipal > 0) {
      const interest = loan.remainingPrincipal * (loan.interestRateMonthly / 30) * loan.daysSincePayment;
      const principalPaid = Math.min(loan.remainingPrincipal, loan.paymentAmount - interest);
      if (state.cash >= loan.paymentAmount) {
        addLedger(state, "loan-interest", `Loan interest: ${loan.label}`, -interest);
        addLedger(state, "loan-principal", `Loan principal: ${loan.label}`, -principalPaid);
        loan.remainingPrincipal = round(loan.remainingPrincipal - principalPaid, 2);
        loan.daysSincePayment = 0;
        state.stats.creditScore = clamp(state.stats.creditScore + 4, 300, 850);
      } else {
        addLedger(state, "loan-penalty", `Missed loan payment: ${loan.label}`, -loan.penalty);
        loan.daysSincePayment = 0;
        loan.missedPayments += 1;
        state.stats.creditScore = clamp(state.stats.creditScore - 24, 300, 850);
        state.stats.legalRisk = clamp(state.stats.legalRisk + 5, 0, 100);
      }
    }
  }
  state.loans = state.loans.filter((loan) => loan.remainingPrincipal > 0.01);
  state.debt = round(state.loans.reduce((sum, loan) => sum + loan.remainingPrincipal, 0), 2);
}

export function takeLoan(state, offerId) {
  const offer = state.loanOffers.find((loan) => loan.id === offerId);
  if (!offer) return { ok: false, message: "Loan offer not found." };
  if (state.stats.creditScore < offer.minCreditScore) {
    return { ok: false, message: "Credit score is too low for this offer." };
  }
  const loan = {
    ...structuredClone(offer),
    startedDay: state.day,
    remainingPrincipal: offer.principal,
    daysSincePayment: 0,
    missedPayments: 0,
  };
  state.loans.push(loan);
  state.debt = round(state.debt + offer.principal, 2);
  addLedger(state, "loan-principal", `Loan received: ${offer.label}`, offer.principal);
  state.stats.creditScore = clamp(state.stats.creditScore - 3, 300, 850);
  return { ok: true, message: `${offer.label} funded.` };
}

export function payTaxDeposit(state, amount) {
  const payment = Math.min(amount, state.taxDue, state.cash);
  if (payment <= 0) return { ok: false, message: "No tax payment made." };
  state.taxDue = round(state.taxDue - payment, 2);
  addLedger(state, "tax-payment", "Tax deposit paid", -payment);
  state.stats.creditScore = clamp(state.stats.creditScore + 2, 300, 850);
  state.stats.legalRisk = clamp(state.stats.legalRisk - 1, 0, 100);
  return { ok: true, message: `Paid $${round(payment, 2)} toward taxes.` };
}

export function buyStarterStock(state) {
  const target = state.inventory.find((item) => item.id === "fendrake-streetcaster-entry");
  if (!target || state.cash < target.cost) return { ok: false, message: "Not enough cash for starter stock." };
  addLedger(state, "inventory-purchase", `Restocked ${target.name}`, -target.cost);
  target.stock += 1;
  state.stats.supplierTrust = clamp(state.stats.supplierTrust + 1, 0, 100);
  return { ok: true, message: "One starter guitar added to inventory." };
}
