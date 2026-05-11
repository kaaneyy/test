import { customerArchetypes, dialogueQuestions } from "../data/customerArchetypes.ts";
import { setupProcedures } from "../data/calibrationProfiles.ts";
import { clamp, round } from "./Rng.ts";

const visitGoals = [
  {
    id: "first-instrument",
    label: "First instrument",
    openerTone: "I need a starting point that will not make me quit in week two.",
    desiredTags: ["beginner", "student", "comfort"],
  },
  {
    id: "gift",
    label: "Gift purchase",
    openerTone: "This is a gift, so I need it to look thoughtful and not explode the budget.",
    desiredTags: ["gift", "beginner", "presentation"],
  },
  {
    id: "repair-intake",
    label: "Repair intake",
    openerTone: "I mostly need someone to tell me what is wrong before I make it worse.",
    desiredTags: ["repair", "setup", "documentation"],
  },
  {
    id: "accessory-run",
    label: "Accessory run",
    openerTone: "I came in for small stuff, but I might look around if something makes sense.",
    desiredTags: ["care", "strings", "accessory"],
  },
  {
    id: "school-quote",
    label: "School quote",
    openerTone: "I need durable gear, clean paperwork, and no mystery fees.",
    desiredTags: ["school", "durable", "warranty"],
  },
  {
    id: "stage-emergency",
    label: "Stage emergency",
    openerTone: "I have a deadline. Good enough is only good if it survives public use.",
    desiredTags: ["touring", "stage", "reliable"],
  },
  {
    id: "collector-preview",
    label: "Collector preview",
    openerTone: "I care about condition, originality, and whether the paperwork feels serious.",
    desiredTags: ["collector", "documentation", "status"],
  },
  {
    id: "coffee-browse",
    label: "Coffee and browse",
    openerTone: "I am browsing today. Coffee first, financial decisions later.",
    desiredTags: ["coffee", "accessory", "community"],
  },
];

export function createCustomerForDay(state) {
  const scripted = {
    1: "nervous-beginner",
    2: "parent-child",
    3: "teen-metal-player",
    4: "rich-collector",
    5: "school-teacher",
    6: "touring-guitarist",
    7: "careful-researcher",
  };
  resetIntentTrackerIfNeeded(state);
  const useScripted = state.customerIntentTracker.usedArchetypes.length === 0;
  const scriptedArchetype = customerArchetypes.find((item) => item.id === scripted[state.day]);
  const archetype = useScripted && scriptedArchetype ? scriptedArchetype : pickDifferentArchetype(state);
  const visitGoal = pickDifferentGoal(state, archetype);
  state.customerIntentTracker.usedArchetypes.push(archetype.id);
  state.customerIntentTracker.usedGoals.push(visitGoal.id);
  const knowledge = state.rng.int(archetype.knowledgeRange[0], archetype.knowledgeRange[1]);
  const budget = state.rng.int(archetype.budgetRange[0], archetype.budgetRange[1]);
  const mood = state.rng.int(archetype.moodRange[0], archetype.moodRange[1]);
  const urgency = state.rng.int(archetype.urgencyRange[0], archetype.urgencyRange[1]);
  const name = state.rng.pick(archetype.names);
  return {
    id: `cust-${state.day}-${Date.now()}-${Math.floor(state.rng.next() * 10000)}`,
    archetypeId: archetype.id,
    label: archetype.label,
    name,
    opener: `${archetype.opener} ${visitGoal.openerTone}`,
    visitGoal,
    knowledge,
    budget,
    mood,
    urgency,
    traits: structuredClone(archetype.traits),
    desiredTags: mergeTags(archetype.desiredTags, visitGoal.desiredTags),
    setupPreferenceId: archetype.setupPreferenceId,
    appreciates: [...archetype.appreciates],
    annoys: [...archetype.annoys],
    accessoryTags: [...archetype.accessoryTags],
    visibleClues: [...archetype.visibleClues],
    discoveredFacts: [`Walked in with a visible intention: ${visitGoal.label.toLowerCase()}.`],
    askedQuestions: [],
    responseLog: [],
    satisfaction: clamp(mood + state.stats.publicReputation * 0.08 - urgency * 0.05, 0, 100),
    patienceRemaining: archetype.traits.patience,
    needsDiscovered: 0,
    technicalComfort: knowledge > 55 ? 70 : knowledge > 30 ? 46 : 22,
    hiddenExpectations: buildHiddenExpectations(archetype, knowledge),
  };
}

function resetIntentTrackerIfNeeded(state) {
  if (!state.customerIntentTracker || state.customerIntentTracker.day !== state.day) {
    state.customerIntentTracker = {
      day: state.day,
      usedArchetypes: [],
      usedGoals: [],
    };
  }
}

function pickDifferentArchetype(state) {
  const used = new Set(state.customerIntentTracker.usedArchetypes);
  const candidates = customerArchetypes.filter((item) => !used.has(item.id));
  if (!candidates.length) {
    state.customerIntentTracker.usedArchetypes = [];
    return state.rng.pick(customerArchetypes);
  }
  return state.rng.pick(candidates);
}

function pickDifferentGoal(state, archetype) {
  const used = new Set(state.customerIntentTracker.usedGoals);
  const matching = visitGoals.filter((goal) => !used.has(goal.id) && goal.desiredTags.some((tag) => archetype.desiredTags.includes(tag) || archetype.accessoryTags?.join(" ").includes(tag)));
  const candidates = matching.length ? matching : visitGoals.filter((goal) => !used.has(goal.id));
  if (!candidates.length) {
    state.customerIntentTracker.usedGoals = [];
    return state.rng.pick(visitGoals);
  }
  return state.rng.pick(candidates);
}

function mergeTags(base, extra) {
  return Array.from(new Set([...base, ...extra]));
}

function buildHiddenExpectations(archetype, knowledge) {
  const expectations = [];
  if (archetype.desiredTags.includes("collector")) expectations.push("Wants provenance and presentation handled delicately.");
  if (archetype.desiredTags.includes("school")) expectations.push("Needs clean invoices, durability, and serial documentation.");
  if (archetype.desiredTags.includes("touring")) expectations.push("Will punish unstable tuning in public use.");
  if (archetype.desiredTags.includes("studio")) expectations.push("Will notice bad intonation and electronics noise.");
  if (knowledge < 25) expectations.push("Needs simple explanations without embarrassment.");
  if (knowledge > 75) expectations.push("Will notice vague claims and skipped measurements.");
  return expectations;
}

export function getAvailableQuestions(customer) {
  return dialogueQuestions.filter((question) => !customer.askedQuestions.includes(question.id));
}

export function askQuestion(state, customer, questionId) {
  const question = dialogueQuestions.find((item) => item.id === questionId);
  if (!question) return { ok: false, message: "Question not found." };
  customer.askedQuestions.push(question.id);
  customer.patienceRemaining = clamp(customer.patienceRemaining - question.timeCost - customer.urgency * 0.03, 0, 100);

  const appreciated = question.tags.some((tag) => customer.appreciates.includes(tag));
  const annoyed = question.tags.some((tag) => customer.annoys.includes(tag));
  const tooTechnical = question.tags.includes("technical") && customer.technicalComfort < 35;
  const tooBasic = question.tags.includes("simple") && customer.knowledge > 70;
  const tooMany = customer.askedQuestions.length > 5 && customer.urgency > 55;

  let delta = 0;
  if (appreciated) delta += 7;
  if (annoyed) delta -= 5;
  if (tooTechnical) delta -= 8;
  if (tooBasic) delta -= 5;
  if (tooMany) delta -= 6;
  if (question.tags.includes("budget") && customer.traits.priceSensitivity > 65) delta += 7;
  if (question.tags.includes("documentation") && customer.traits.honestySensitivity > 80) delta += 6;
  if (question.tags.includes("setup") && customer.knowledge > 50) delta += 4;

  customer.satisfaction = clamp(round(customer.satisfaction + delta, 1), 0, 100);
  customer.needsDiscovered += question.reveals.length;

  const clue = revealClue(customer, question);
  customer.discoveredFacts.push(clue);
  const response = buildQuestionResponse(customer, question, delta, clue);
  customer.responseLog.unshift(response);
  return { ok: true, message: response, clue, delta };
}

function revealClue(customer, question) {
  if (question.reveals.includes("budget")) return `Likely budget: around $${Math.round(customer.budget * 0.85)} to $${Math.round(customer.budget)}.`;
  if (question.reveals.includes("knowledge")) {
    if (customer.knowledge < 16) return "Seems to know almost nothing and may hide it.";
    if (customer.knowledge < 36) return "Beginner vocabulary: some common terms, few details.";
    if (customer.knowledge < 61) return "Hobbyist: notices feel, action, and obvious tuning issues.";
    if (customer.knowledge < 81) return "Experienced: asks about specs, tone, intonation, and build quality.";
    if (customer.knowledge < 96) return "Professional: likely to detect calibration errors and weak documentation.";
    return "Expert/collector level: may detect fraud, poor fretwork, swapped parts, and humidity mistakes.";
  }
  if (question.reveals.includes("use")) return customer.hiddenExpectations[0] || "Use case is becoming clearer.";
  if (question.reveals.includes("setupPreference")) return `Preference clue: ${customer.setupPreferenceId.replace("Modifier", "").replace(/([A-Z])/g, " $1").trim()}.`;
  if (question.reveals.includes("accessory")) return customer.traits.accessoryOpenness > 55 ? "Open to useful accessories if they are explained plainly." : "Likely to reject accessories that feel like padding.";
  if (question.reveals.includes("careDiscipline")) return customer.traits.careDiscipline > 60 ? "Seems able to follow care advice." : "May neglect maintenance unless the plan is simple.";
  if (question.reveals.includes("publicUse")) return customer.traits.publicUse > 0.75 ? "Public-use risk is high. A failure could become visible." : "Mostly private use, but defects can still come back later.";
  return customer.visibleClues[0] || "A small useful clue surfaces.";
}

function buildQuestionResponse(customer, question, delta, clue) {
  let tone = "They answer normally.";
  if (delta >= 8) tone = "They relax and give a useful answer.";
  else if (delta >= 3) tone = "They seem to appreciate the direction.";
  else if (delta <= -8) tone = "They stiffen up and the conversation gets colder.";
  else if (delta <= -3) tone = "They answer, but with a little impatience.";
  return `${tone} ${clue}`;
}

export function chooseRecommendedAccessories(state, customer, instrument, maxCount = 3) {
  const desiredIds = instrument?.recommendedAccessories || [];
  const candidates = state.accessories
    .filter((item) => item.stock > 0 && (desiredIds.includes(item.id) || item.tags.some((tag) => customer.accessoryTags.join(" ").includes(tag) || customer.desiredTags.includes(tag))))
    .sort((a, b) => scoreAccessoryForCustomer(b, customer) - scoreAccessoryForCustomer(a, customer));
  return candidates.slice(0, maxCount);
}

function scoreAccessoryForCustomer(accessory, customer) {
  let score = 0;
  for (const tag of accessory.tags) {
    if (customer.desiredTags.includes(tag)) score += 12;
    if (customer.accessoryTags.join(" ").includes(tag)) score += 8;
  }
  if (accessory.sellPrice > customer.budget * 0.12 && customer.traits.priceSensitivity > 70) score -= 16;
  if (accessory.tags.includes("collector") && customer.desiredTags.includes("collector")) score += 20;
  if (accessory.tags.includes("documentation") && customer.traits.honestySensitivity > 80) score += 14;
  return score;
}

export function recommendInventory(state, customer) {
  return state.inventory
    .filter((item) => item.stock > 0 && item.sellPrice <= customer.budget * 1.08)
    .map((item) => {
      const shelf = (state.shelfDisplay || []).find((slot) => slot?.id === item.id);
      const shelfDelta = shelf ? shelf.bonus + shelf.debuff : 0;
      return { item, score: scoreInstrumentForCustomer(item, customer) + shelfDelta };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

export function scoreInstrumentForCustomer(instrument, customer) {
  let score = 20;
  for (const tag of instrument.targetCustomerTags) {
    if (customer.desiredTags.includes(tag)) score += 18;
    if (customer.accessoryTags.join(" ").includes(tag)) score += 4;
  }
  const priceRatio = instrument.sellPrice / customer.budget;
  if (priceRatio <= 0.75) score += customer.traits.priceSensitivity > 60 ? 14 : 4;
  if (priceRatio > 1) score -= 25 + (priceRatio - 1) * 60;
  if (instrument.qualityTier === "Collector" && customer.desiredTags.includes("collector")) score += 35;
  if (instrument.qualityTier === "Entry" && customer.knowledge > 70) score -= 26;
  if (instrument.condition.includes("poorly") && customer.knowledge > 60) score -= 10;
  if (instrument.condition.includes("neglected") && customer.traits.riskTolerance < 35) score -= 18;
  if (instrument.category.includes("acoustic") && customer.desiredTags.includes("electric")) score -= 18;
  if (instrument.category.includes("Electric") && customer.desiredTags.includes("acoustic")) score -= 14;
  return round(score, 1);
}

export function evaluateRecommendation(customer, instrument, accessoryIds, state) {
  const score = scoreInstrumentForCustomer(instrument, customer);
  const accessoryTotal = accessoryIds
    .map((id) => state.accessories.find((item) => item.id === id))
    .filter(Boolean)
    .reduce((sum, item) => sum + item.sellPrice, 0);
  const totalPrice = instrument.sellPrice + accessoryTotal;
  let satisfactionDelta = (score - 50) * 0.45;
  if (totalPrice > customer.budget && customer.traits.priceSensitivity > 55) satisfactionDelta -= (totalPrice - customer.budget) / 12;
  if (accessoryIds.length > 3 && customer.traits.accessoryOpenness < 55) satisfactionDelta -= 10;
  if (accessoryIds.length > 0 && customer.traits.accessoryOpenness > 60) satisfactionDelta += 5;
  if (customer.needsDiscovered < 3) satisfactionDelta -= 9;
  if (customer.needsDiscovered >= 6) satisfactionDelta += 8;
  customer.satisfaction = clamp(round(customer.satisfaction + satisfactionDelta, 1), 0, 100);
  return {
    fitScore: clamp(round(score, 1), 0, 100),
    satisfactionDelta: round(satisfactionDelta, 1),
    totalPrice: round(totalPrice, 2),
  };
}

export function getServiceForCustomer(customer) {
  if (customer.desiredTags.includes("collector")) return setupProcedures.find((item) => item.id === "collector-conservation");
  if (customer.desiredTags.includes("touring")) return setupProcedures.find((item) => item.id === "stage-ready");
  if (customer.desiredTags.includes("studio")) return setupProcedures.find((item) => item.id === "stage-ready") || setupProcedures[2];
  if (customer.knowledge > 60) return setupProcedures.find((item) => item.id === "full-setup");
  return setupProcedures.find((item) => item.id === "basic-setup");
}
