import { calibrationProfiles, preferenceModifiers, setupProcedures } from "../data/calibrationProfiles.ts";
import { clamp, round } from "./Rng.ts";

export const calibrationActions = [
  { id: "inspect", label: "Intake inspection", step: "inspect", minutes: 8, help: "Check condition, string gauge, tuning, relief, action, nut, frets, bridge, and electronics if present." },
  { id: "tune", label: "Tune with digital tuner", step: "tune", minutes: 5, help: "Brings all strings close to reference before measuring." },
  { id: "tighten-truss", label: "Tighten truss rod 1/8 turn", step: "relief", minutes: 7, help: "Reduces relief. Risk rises if repeated quickly without settling." },
  { id: "loosen-truss", label: "Loosen truss rod 1/8 turn", step: "relief", minutes: 7, help: "Adds relief. Useful for backbow or hard buzzing under attack." },
  { id: "wait-neck", label: "Let neck settle", step: "settle", minutes: 18, help: "Lowers truss-rod risk and makes the next measurement more trustworthy." },
  { id: "raise-bridge", label: "Raise bridge saddles slightly", step: "action", minutes: 8, help: "Raises action and lowers buzz risk at the cost of comfort." },
  { id: "lower-bridge", label: "Lower bridge saddles slightly", step: "action", minutes: 8, help: "Improves comfort but can create buzz if relief or frets are not right." },
  { id: "file-nut", label: "File nut slots carefully", step: "nut-check", minutes: 14, help: "Lowers first-position effort. Too low causes open-string buzz and can require nut replacement." },
  { id: "lubricate-nut", label: "Lubricate nut and saddles", step: "nut-check", minutes: 5, help: "Improves tuning return, especially after bends or tremolo use." },
  { id: "intonate-forward", label: "Move saddles forward for flat strings", step: "intonation", minutes: 10, help: "Reduces flat 12th-fret errors, but overdoing it makes notes sharp." },
  { id: "intonate-back", label: "Move saddles back for sharp strings", step: "intonation", minutes: 10, help: "Reduces sharp 12th-fret errors, but overdoing it makes notes flat." },
  { id: "raise-pickups", label: "Raise pickups", step: "pickup-height", minutes: 7, help: "Adds output. Too close can cause warble and magnetic pull." },
  { id: "lower-pickups", label: "Lower pickups", step: "pickup-height", minutes: 7, help: "Reduces pull and harshness. Too low sounds weak." },
  { id: "clean-electronics", label: "Clean pots and switch", step: "electronics", minutes: 10, help: "Reduces scratchy noise on electric instruments." },
  { id: "replace-strings", label: "Install fresh strings", step: "strings", minutes: 14, help: "Improves tone and stability, but gauge changes require full setup checks." },
  { id: "stretch-strings", label: "Stretch strings and retune", step: "stretch", minutes: 10, help: "Improves tuning stability after restringing." },
  { id: "clean-body", label: "Clean body and hardware", step: "clean", minutes: 8, help: "Improves presentation and customer trust." },
  { id: "condition-board", label: "Condition fretboard if appropriate", step: "clean", minutes: 8, help: "Useful on dry unfinished boards; not every board needs oil." },
  { id: "fret-check", label: "Check frets with rocker", step: "fret-check", minutes: 10, help: "Finds uneven frets before promising buzz-free low action." },
  { id: "play-test", label: "Play test with customer style", step: "play-test", minutes: 12, help: "Catches buzz, unstable tuning, and preference mismatch." },
  { id: "qte-focus", label: "Quick focus event", step: "qte", minutes: 3, help: "Mini quick-time style check. Success improves outcome; failure blurs judgement." },
  { id: "document", label: "Document final measurements", step: "document", minutes: 10, help: "Raises honor and lowers legal risk on valuable work." },
  { id: "honest-warning", label: "Warn about limits before overpromising", step: "honesty", minutes: 4, help: "May lower short-term excitement but protects trust." },
  { id: "skip-intonation", label: "Shortcut: skip full intonation", step: "shortcut", minutes: -8, shortcut: true, severity: 0.45, dishonest: false },
  { id: "old-strings-charge", label: "Dishonest shortcut: charge for strings but use old ones", step: "shortcut", minutes: -12, shortcut: true, severity: 0.8, dishonest: true },
  { id: "too-low-action", label: "Shortcut: set action impressively low", step: "shortcut", minutes: -6, shortcut: true, severity: 0.5, dishonest: false },
];

export function startCalibration(state, instrument, customer, serviceId) {
  const profile = calibrationProfiles[instrument.profileId] || calibrationProfiles.ElectricGuitarStandard;
  const service = setupProcedures.find((item) => item.id === serviceId) || setupProcedures[1];
  const modifier = preferenceModifiers[customer?.setupPreferenceId] || preferenceModifiers.BluesRockModifier;
  const measurements = makeInitialMeasurements(state, instrument, profile);
  const calibration = {
    id: `cal-${Date.now()}-${Math.floor(state.rng.next() * 10000)}`,
    instrumentId: instrument.id,
    instrumentName: instrument.name,
    profileId: profile.id,
    serviceId: service.id,
    customerId: customer?.id || null,
    customerLabel: customer?.label || "Walk-in customer",
    preferenceId: modifier.id,
    measurements,
    steps: {},
    skippedSteps: [],
    dishonestActions: [],
    log: [`Started ${service.label} for ${instrument.name}.`],
    elapsedMinutes: 0,
    damageRisk: 0,
    documentationQuality: 0,
    explanationQuality: 0,
    irreversibleChange: false,
    trussMovesSinceSettle: 0,
    finalized: false,
    finalScore: null,
    qteStreak: 0,
  };
  state.activeCalibration = calibration;
  return calibration;
}

function makeInitialMeasurements(state, instrument, profile) {
  const conditionNoise = {
    "New factory setup": 0.7,
    "New but poorly set up": 1.25,
    "Used good": 1.0,
    "Used neglected": 1.65,
    "Collector mint": 0.85,
    Vintage: 1.4,
    Damaged: 2.0,
  }[instrument.condition] || 1.0;
  const r = state.rng;
  const intonation = Array.from({ length: 6 }, () => round(r.range(-10, 10) * conditionNoise, 1));
  const tuning = Array.from({ length: 6 }, () => round(r.range(-13, 13) * conditionNoise, 1));
  const category = instrument.category.toLowerCase();
  const isElectric = category.includes("electric") || category.includes("collector") || category.includes("bass");
  return {
    stringGauge: category.includes("bass") ? "45-105" : instrument.category.includes("acoustic") ? "12-53" : "10-46",
    reliefMm: round(profile.reliefIdealMm + r.range(-0.13, 0.16) * conditionNoise, 2),
    lowEActionMm: round(profile.lowEActionIdealMm + r.range(-0.45, 0.5) * conditionNoise, 2),
    highEActionMm: round(profile.highEActionIdealMm + r.range(-0.35, 0.42) * conditionNoise, 2),
    nutLowMm: round(profile.nutLowIdealMm + r.range(-0.1, 0.13) * conditionNoise, 2),
    nutHighMm: round(profile.nutHighIdealMm + r.range(-0.08, 0.09) * conditionNoise, 2),
    intonationCents: intonation,
    tuningCents: tuning,
    pickupBassMm: isElectric ? round((profile.pickupBassSideMm || 2.4) + r.range(-0.8, 0.9), 2) : null,
    pickupTrebleMm: isElectric ? round((profile.pickupTrebleSideMm || 2.0) + r.range(-0.7, 0.8), 2) : null,
    electronicsNoise: isElectric ? round(r.range(8, 34) * conditionNoise, 1) : 0,
    humidityPercent: round(r.range(34, 61), 1),
    buzzRisk: round(r.range(18, 52) * conditionNoise, 1),
    tuningStability: round(clamp(62 - Math.max(...tuning.map(Math.abs)) * 1.7 - conditionNoise * 7, 0, 100), 1),
    cleanliness: round(clamp(70 - conditionNoise * 14 + r.range(-10, 12), 0, 100), 1),
    fretEvenness: round(clamp(78 - conditionNoise * 12 + r.range(-12, 10), 0, 100), 1),
    stringsFresh: instrument.condition.includes("New"),
    playTestPassed: false,
    warnedLimitations: false,
  };
}

export function applyCalibrationAction(calibration, actionId, state) {
  const action = calibrationActions.find((item) => item.id === actionId);
  if (!action || calibration.finalized) return { ok: false, message: "Action unavailable." };
  const m = calibration.measurements;
  calibration.elapsedMinutes = Math.max(0, calibration.elapsedMinutes + action.minutes);
  calibration.steps[action.step] = (calibration.steps[action.step] || 0) + 1;

  if (action.shortcut) {
    calibration.skippedSteps.push(action.id);
    if (action.dishonest) calibration.dishonestActions.push(action.id);
    calibration.damageRisk = clamp(calibration.damageRisk + action.severity * 12, 0, 100);
  }

  switch (actionId) {
    case "inspect":
      calibration.documentationQuality += 4;
      calibration.explanationQuality += 3;
      break;
    case "tune":
      m.tuningCents = m.tuningCents.map((value) => round(value * 0.25, 1));
      m.tuningStability = clamp(m.tuningStability + 6, 0, 100);
      break;
    case "tighten-truss":
      m.reliefMm = round(m.reliefMm - 0.04, 2);
      calibration.trussMovesSinceSettle += 1;
      calibration.damageRisk = clamp(calibration.damageRisk + Math.max(0, calibration.trussMovesSinceSettle - 1) * 3.5, 0, 100);
      break;
    case "loosen-truss":
      m.reliefMm = round(m.reliefMm + 0.04, 2);
      calibration.trussMovesSinceSettle += 1;
      calibration.damageRisk = clamp(calibration.damageRisk + Math.max(0, calibration.trussMovesSinceSettle - 1) * 3.5, 0, 100);
      break;
    case "wait-neck":
      calibration.trussMovesSinceSettle = 0;
      calibration.damageRisk = clamp(calibration.damageRisk - 4, 0, 100);
      break;
    case "raise-bridge":
      m.lowEActionMm = round(m.lowEActionMm + 0.12, 2);
      m.highEActionMm = round(m.highEActionMm + 0.1, 2);
      m.buzzRisk = clamp(m.buzzRisk - 8, 0, 100);
      break;
    case "lower-bridge":
      m.lowEActionMm = round(m.lowEActionMm - 0.12, 2);
      m.highEActionMm = round(m.highEActionMm - 0.1, 2);
      m.buzzRisk = clamp(m.buzzRisk + 9, 0, 100);
      break;
    case "file-nut":
      m.nutLowMm = round(m.nutLowMm - 0.035, 2);
      m.nutHighMm = round(m.nutHighMm - 0.025, 2);
      if (m.nutLowMm < 0.18 || m.nutHighMm < 0.09) {
        m.buzzRisk = clamp(m.buzzRisk + 18, 0, 100);
        calibration.damageRisk = clamp(calibration.damageRisk + 12, 0, 100);
        calibration.irreversibleChange = true;
      }
      break;
    case "lubricate-nut":
      m.tuningStability = clamp(m.tuningStability + 8, 0, 100);
      break;
    case "intonate-forward":
      m.intonationCents = m.intonationCents.map((value) => round(value < 0 ? value * 0.45 : value + 1.2, 1));
      break;
    case "intonate-back":
      m.intonationCents = m.intonationCents.map((value) => round(value > 0 ? value * 0.45 : value - 1.2, 1));
      break;
    case "raise-pickups":
      if (m.pickupBassMm !== null) {
        m.pickupBassMm = round(m.pickupBassMm - 0.25, 2);
        m.pickupTrebleMm = round(m.pickupTrebleMm - 0.22, 2);
        if (m.pickupBassMm < 1.6 || m.pickupTrebleMm < 1.4) m.buzzRisk = clamp(m.buzzRisk + 8, 0, 100);
      }
      break;
    case "lower-pickups":
      if (m.pickupBassMm !== null) {
        m.pickupBassMm = round(m.pickupBassMm + 0.25, 2);
        m.pickupTrebleMm = round(m.pickupTrebleMm + 0.22, 2);
      }
      break;
    case "clean-electronics":
      m.electronicsNoise = clamp(m.electronicsNoise - 18, 0, 100);
      break;
    case "replace-strings":
      m.stringsFresh = true;
      m.tuningCents = m.tuningCents.map((value) => round(value * 0.4 + state.rng.range(-5, 5), 1));
      m.tuningStability = clamp(m.tuningStability - 5, 0, 100);
      break;
    case "stretch-strings":
      m.tuningCents = m.tuningCents.map((value) => round(value * 0.28, 1));
      m.tuningStability = clamp(m.tuningStability + 18, 0, 100);
      break;
    case "clean-body":
      m.cleanliness = clamp(m.cleanliness + 18, 0, 100);
      break;
    case "condition-board":
      m.cleanliness = clamp(m.cleanliness + 9, 0, 100);
      if (m.humidityPercent > 58) calibration.damageRisk = clamp(calibration.damageRisk + 2, 0, 100);
      break;
    case "fret-check":
      m.fretEvenness = clamp(m.fretEvenness + 2, 0, 100);
      calibration.documentationQuality += 4;
      break;
    case "qte-focus":
      {
        const success = state.rng.next() > 0.35;
        if (success) {
          calibration.qteStreak += 1;
          calibration.documentationQuality += 3;
          m.tuningStability = clamp(m.tuningStability + 4, 0, 100);
        } else {
          calibration.damageRisk = clamp(calibration.damageRisk + 4, 0, 100);
          m.buzzRisk = clamp(m.buzzRisk + 5, 0, 100);
        }
      }
      break;
    case "play-test":
      m.playTestPassed = estimateBuzzRisk(calibration) < 36 && m.tuningStability > 58;
      m.buzzRisk = clamp(m.buzzRisk - 3, 0, 100);
      calibration.explanationQuality += 3;
      break;
    case "document":
      calibration.documentationQuality += 24;
      break;
    case "honest-warning":
      m.warnedLimitations = true;
      calibration.explanationQuality += 8;
      break;
    case "skip-intonation":
      calibration.steps.intonation = 0;
      break;
    case "old-strings-charge":
      m.stringsFresh = false;
      m.tuningStability = clamp(m.tuningStability - 14, 0, 100);
      break;
    case "too-low-action":
      m.lowEActionMm = round(m.lowEActionMm - 0.25, 2);
      m.highEActionMm = round(m.highEActionMm - 0.22, 2);
      m.buzzRisk = clamp(m.buzzRisk + 22, 0, 100);
      break;
    default:
      break;
  }

  const msg = `${action.label}: ${summarizeMeasurements(calibration)}`;
  calibration.log.unshift(msg);
  return { ok: true, message: msg };
}


export function beginFullscreenQte(state, calibration) {
  const profile = calibrationProfiles[calibration.profileId] || calibrationProfiles.ElectricGuitarStandard;
  const target = ["RELIEF", "ACTION", "INTONATION", "TUNING"];
  state.ui.qte = {
    target,
    chosen: [],
    profileLabel: profile.label,
    education: [
      "Relief first: neck geometry must stabilize before fine action work.",
      "Action second: set playability before intonation.",
      "Intonation after geometry: pitch mapping depends on final action.",
      "Tuning last: always verify after all adjustments."
    ]
  };
  return { ok: true, message: "Fullscreen setup QTE started." };
}

export function resolveFullscreenQte(state, step) {
  const qte = state.ui.qte;
  const calibration = state.activeCalibration;
  if (!qte || !calibration) return { ok: false, message: "No active QTE." };
  qte.chosen.push(step);
  if (qte.chosen.length < qte.target.length) return { ok: true, message: `Step ${qte.chosen.length}/${qte.target.length} locked.` };
  const matches = qte.target.filter((item, idx) => qte.chosen[idx] === item).length;
  calibration.documentationQuality += matches * 5;
  calibration.explanationQuality += matches * 4;
  calibration.damageRisk = clamp(calibration.damageRisk - matches * 2, 0, 100);
  state.ui.qte = null;
  return { ok: true, message: `QTE complete: ${matches}/${qte.target.length} correct sequence hits.` };
}

export function scoreCalibration(calibration, customer = null, playerSkill = 50, toolCondition = 70) {
  const profile = calibrationProfiles[calibration.profileId] || calibrationProfiles.ElectricGuitarStandard;
  const modifier = preferenceModifiers[calibration.preferenceId] || preferenceModifiers.BluesRockModifier;
  const service = setupProcedures.find((item) => item.id === calibration.serviceId) || setupProcedures[1];
  const m = calibration.measurements;

  const lowIdeal = profile.lowEActionIdealMm + (modifier.actionShiftMm || 0);
  const highIdeal = profile.highEActionIdealMm + (modifier.actionShiftMm || 0) * 0.75;
  const reliefIdeal = profile.reliefIdealMm + (modifier.reliefShiftMm || 0);
  const reliefScore = rangeScore(m.reliefMm, reliefIdeal, profile.reliefMinMm - 0.05, profile.reliefMaxMm + 0.05);
  const lowActionScore = rangeScore(m.lowEActionMm, lowIdeal, profile.lowEActionMinMm - 0.2, profile.lowEActionMaxMm + 0.25);
  const highActionScore = rangeScore(m.highEActionMm, highIdeal, profile.highEActionMinMm - 0.18, profile.highEActionMaxMm + 0.22);
  const nutLowScore = rangeScore(m.nutLowMm, profile.nutLowIdealMm, profile.nutLowMinMm - 0.05, profile.nutLowMaxMm + 0.05);
  const nutHighScore = rangeScore(m.nutHighMm, profile.nutHighIdealMm, profile.nutHighMinMm - 0.04, profile.nutHighMaxMm + 0.04);
  const maxIntonation = Math.max(...m.intonationCents.map(Math.abs));
  const intonationScore = clamp(100 - (maxIntonation / (profile.intonationMaxCents / (modifier.intonationStrictness || 1))) * 40, 0, 100);
  const maxTuning = Math.max(...m.tuningCents.map(Math.abs));
  const tuningScore = clamp(100 - maxTuning * 3 + m.tuningStability * 0.25, 0, 100);
  const pickupScore = profile.pickupBassSideMm
    ? (rangeScore(m.pickupBassMm, profile.pickupBassSideMm, 1.4, 4.0) + rangeScore(m.pickupTrebleMm, profile.pickupTrebleSideMm, 1.2, 3.6)) / 2
    : 85;
  const electronicsScore = profile.pickupBassSideMm ? clamp(100 - m.electronicsNoise * 2, 0, 100) : 90;
  const humidityScore = clamp(100 - Math.max(0, profile.humiditySafeMinPercent - m.humidityPercent, m.humidityPercent - profile.humiditySafeMaxPercent) * 6, 0, 100);
  const buzzScore = clamp(100 - estimateBuzzRisk(calibration) * (1.15 - (modifier.buzzTolerance || 0.7) * 0.25), 0, 100);
  const cleanlinessScore = m.cleanliness;
  const docScore = clamp(calibration.documentationQuality * (modifier.documentationWeight || 0.6), 0, 100);
  const stepScore = scoreRequiredSteps(calibration, service);
  const skillScore = clamp(playerSkill * 0.65 + toolCondition * 0.35, 0, 100);

  let total =
    reliefScore * 0.12 +
    lowActionScore * 0.11 +
    highActionScore * 0.1 +
    nutLowScore * 0.07 +
    nutHighScore * 0.07 +
    intonationScore * 0.13 +
    tuningScore * 0.1 +
    pickupScore * 0.06 +
    electronicsScore * 0.05 +
    humidityScore * 0.04 +
    buzzScore * 0.08 +
    cleanlinessScore * 0.04 +
    docScore * 0.05 +
    stepScore * 0.05 +
    skillScore * 0.03;

  const skippedPenalty = calibration.skippedSteps.length * 7 * (modifier.skippedStepPenalty || 1);
  const dishonestPenalty = calibration.dishonestActions.length * 18;
  const damagePenalty = calibration.damageRisk * 0.32;
  const irreversiblePenalty = calibration.irreversibleChange && modifier.originalityWeight ? 12 * modifier.originalityWeight : 0;
  const overTimePenalty = Math.max(0, calibration.elapsedMinutes - service.timeMinutes * 1.45) * 0.08;
  const tooFastPenalty = calibration.elapsedMinutes < service.timeMinutes * 0.45 ? 8 : 0;
  total -= skippedPenalty + dishonestPenalty + damagePenalty + irreversiblePenalty + overTimePenalty + tooFastPenalty;

  const preferenceMatch = clamp((lowActionScore + highActionScore + buzzScore + intonationScore) / 4, 0, 100);
  const technicalScore = clamp(round(total, 1), 0, 100);
  const customerKnowledge = customer?.knowledge || 45;
  let satisfaction = technicalScore * 0.74 + preferenceMatch * 0.18 + (calibration.explanationQuality + (modifier.explanationBonus || 0)) * 0.45;
  if (customerKnowledge > 75) satisfaction -= (100 - docScore) * 0.08;
  if (customerKnowledge < 30 && calibration.explanationQuality > 6) satisfaction += 5;
  if (m.warnedLimitations && technicalScore < 75) satisfaction += 6;
  if (calibration.dishonestActions.length) satisfaction += customerKnowledge < 35 ? 6 : -16;

  return {
    score: clamp(round(technicalScore, 1), 0, 100),
    satisfaction: clamp(round(satisfaction, 1), 0, 100),
    components: {
      reliefScore: round(reliefScore, 1),
      lowActionScore: round(lowActionScore, 1),
      highActionScore: round(highActionScore, 1),
      nutScore: round((nutLowScore + nutHighScore) / 2, 1),
      intonationScore: round(intonationScore, 1),
      tuningScore: round(tuningScore, 1),
      pickupScore: round(pickupScore, 1),
      electronicsScore: round(electronicsScore, 1),
      humidityScore: round(humidityScore, 1),
      buzzScore: round(buzzScore, 1),
      documentationScore: round(docScore, 1),
      stepScore: round(stepScore, 1),
    },
    risks: {
      skippedPenalty: round(skippedPenalty, 1),
      dishonestPenalty,
      damageRisk: round(calibration.damageRisk, 1),
      discoverySeverity: estimateDiscoverySeverity(calibration, technicalScore),
      buzzRisk: round(estimateBuzzRisk(calibration), 1),
    },
  };
}

function rangeScore(value, ideal, min, max) {
  const span = Math.max(Math.abs(max - ideal), Math.abs(ideal - min), 0.01);
  return clamp(100 - (Math.abs(value - ideal) / span) * 100, 0, 100);
}

export function scoreRequiredSteps(calibration, service) {
  const required = service.requiredSteps || [];
  if (!required.length) return 100;
  const done = required.filter((step) => calibration.steps[step] > 0 || (step === "nut-check" && calibration.steps["nut-check"] > 0)).length;
  return (done / required.length) * 100;
}

export function estimateBuzzRisk(calibration) {
  const profile = calibrationProfiles[calibration.profileId] || calibrationProfiles.ElectricGuitarStandard;
  const m = calibration.measurements;
  let risk = m.buzzRisk;
  if (m.reliefMm < profile.reliefMinMm) risk += (profile.reliefMinMm - m.reliefMm) * 180;
  if (m.lowEActionMm < profile.lowEActionMinMm) risk += (profile.lowEActionMinMm - m.lowEActionMm) * 42;
  if (m.highEActionMm < profile.highEActionMinMm) risk += (profile.highEActionMinMm - m.highEActionMm) * 52;
  if (m.nutLowMm < profile.nutLowMinMm || m.nutHighMm < profile.nutHighMinMm) risk += 24;
  if (m.fretEvenness < 60) risk += (60 - m.fretEvenness) * 0.6;
  return clamp(risk, 0, 100);
}

export function estimateDiscoverySeverity(calibration, technicalScore) {
  let severity = clamp((72 - technicalScore) / 55, 0, 1);
  severity += calibration.skippedSteps.length * 0.08;
  severity += calibration.dishonestActions.length * 0.28;
  severity += calibration.damageRisk / 250;
  return clamp(round(severity, 2), 0, 1);
}


export function getCalibrationReadiness(calibration) {
  const service = setupProcedures.find((item) => item.id === calibration.serviceId) || setupProcedures[1];
  const required = service.requiredSteps || [];
  const missing = required.filter((step) => !(calibration.steps[step] > 0 || (step === "nut-check" && calibration.steps["nut-check"] > 0)));
  const buzzRisk = estimateBuzzRisk(calibration);
  return {
    requiredSteps: required,
    missingSteps: missing,
    buzzRisk,
    ready: missing.length === 0 && buzzRisk <= 55,
  };
}

export function finalizeCalibration(state, customer = null) {
  const calibration = state.activeCalibration;
  if (!calibration || calibration.finalized) return null;
  const setupSkill = state.player.skill.guitarSetup + state.employees.reduce((sum, employee) => sum + (employee.assignment === "setup" ? employee.skills.guitarSetup * 0.18 : 0), 0);
  const result = scoreCalibration(calibration, customer, setupSkill, state.stats.toolCondition);
  calibration.finalized = true;
  calibration.finalScore = result;
  calibration.log.unshift(`Final score ${result.score}/100, customer impact ${result.satisfaction}/100.`);
  return result;
}

export function buildDefectFromCalibration(state, calibration, result, customer, instrument, sale) {
  const severity = result.risks.discoverySeverity;
  if (severity <= 0.12) return null;
  return {
    id: `defect-${calibration.id}`,
    daysOld: 0,
    severity,
    dishonest: calibration.dishonestActions.length > 0,
    customerKnowledge: customer?.knowledge || 35,
    publicUseFactor: customer?.traits?.publicUse || 0.5,
    valueFactor: Math.min(2.2, (instrument?.sellPrice || 300) / 900),
    originalSatisfaction: result.satisfaction,
    customerLabel: customer?.label || "Customer",
    instrumentName: instrument?.name || calibration.instrumentName,
    value: instrument?.sellPrice || sale?.total || 300,
    reviewText: calibration.dishonestActions.length
      ? "A later inspection found dishonest work hidden under a shiny receipt."
      : "The setup seemed fine at first, but a later problem revealed skipped or weak work.",
  };
}

export function summarizeMeasurements(calibration) {
  const m = calibration.measurements;
  const intonationMax = Math.max(...m.intonationCents.map(Math.abs));
  return `relief ${round(m.reliefMm, 2)} mm, action ${round(m.lowEActionMm, 2)}/${round(m.highEActionMm, 2)} mm, nut ${round(m.nutLowMm, 2)}/${round(m.nutHighMm, 2)} mm, intonation max ${round(intonationMax, 1)} cents, buzz risk ${round(estimateBuzzRisk(calibration), 1)}.`;
}
