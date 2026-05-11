import { addLedger } from "./Economy.ts";
import { clamp } from "./Rng.ts";

export function hireEmployee(state, candidateId) {
  const candidate = state.employeeCandidates.find((item) => item.id === candidateId);
  if (!candidate) return { ok: false, message: "Candidate not found." };
  if (!state.unlocked.employees && state.day < 7) return { ok: false, message: "Hiring unlocks on day 7." };
  if (state.cash < candidate.wageDaily * 3) return { ok: false, message: "Keep at least a few days of wages before hiring." };
  if (state.employees.length >= state.branch.staffSlots) return { ok: false, message: "This branch has no staff slot left." };
  const employee = {
    ...structuredClone(candidate),
    hiredDay: state.day,
    fatigue: 0,
    assignment: "counter",
    trainingLevel: 0,
  };
  state.employees.push(employee);
  state.employeeCandidates = state.employeeCandidates.filter((item) => item.id !== candidateId);
  addLedger(state, "wages", `Hiring paperwork and first-day onboarding: ${employee.name}`, -candidate.wageDaily);
  state.stats.staffMorale = clamp(state.stats.staffMorale + 3, 0, 100);
  return { ok: true, message: `${employee.name} hired as ${employee.role}.` };
}

export function assignEmployee(state, employeeId, assignment) {
  const employee = state.employees.find((item) => item.id === employeeId);
  if (!employee) return { ok: false, message: "Employee not found." };
  employee.assignment = assignment;
  employee.morale = clamp(employee.morale + 1, 0, 100);
  return { ok: true, message: `${employee.name} assigned to ${assignment}.` };
}

export function trainEmployee(state, employeeId) {
  const employee = state.employees.find((item) => item.id === employeeId);
  if (!employee) return { ok: false, message: "Employee not found." };
  const cost = 120;
  if (state.cash < cost) return { ok: false, message: "Not enough cash for training." };
  addLedger(state, "training", `Training: ${employee.name}`, -cost);
  employee.trainingLevel += 1;
  employee.skills.sales = clamp(employee.skills.sales + 4 + employee.learningRate / 25, 0, 100);
  employee.skills.guitarSetup = clamp(employee.skills.guitarSetup + 4 + employee.learningRate / 24, 0, 100);
  employee.skills.documentation = clamp(employee.skills.documentation + 3 + employee.learningRate / 30, 0, 100);
  employee.morale = clamp(employee.morale + 4, 0, 100);
  employee.mistakeRate = Math.max(0.02, employee.mistakeRate - 0.015);
  employee.shortcutTendency = Math.max(0.01, employee.shortcutTendency - 0.01);
  return { ok: true, message: `${employee.name} improved through training.` };
}

export function getStaffEffects(state) {
  const counter = state.employees.filter((employee) => employee.assignment === "counter");
  const setup = state.employees.filter((employee) => employee.assignment === "setup");
  const books = state.employees.filter((employee) => employee.assignment === "books");
  return {
    salesHelp: counter.reduce((sum, employee) => sum + employee.skills.sales * 0.12 + employee.friendliness * 0.06, 0),
    setupHelp: setup.reduce((sum, employee) => sum + employee.skills.guitarSetup * 0.16 - employee.shortcutTendency * 20, 0),
    accountingHelp: books.reduce((sum, employee) => sum + employee.skills.documentation * 0.16 + employee.honesty * 0.05, 0),
    risk: state.employees.reduce((sum, employee) => sum + employee.mistakeRate + employee.shortcutTendency * 0.5, 0),
  };
}
