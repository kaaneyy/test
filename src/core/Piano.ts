import { pianoInstallActions, pianoInstallProfiles } from "../data/pianoProcedures.ts";
import { clamp, round } from "./Rng.ts";

export function startPianoInstall(state, job) {
  const profile = pianoInstallProfiles[job.pianoProfileId] || pianoInstallProfiles.uprightStandard;
  const install = {
    id: `piano-${state.day}-${Math.floor(state.rng.next() * 10000)}`,
    jobId: job.id,
    jobTitle: job.title,
    profileId: profile.id,
    elapsedMinutes: 0,
    steps: {},
    shortcuts: [],
    dishonest: false,
    documentation: 10,
    damageRisk: 8,
    measurements: {
      pitchCents: round(state.rng.range(-28, 22), 1),
      unisonSpreadCents: round(state.rng.range(5, 18), 1),
      octaveStretchQuality: round(state.rng.range(28, 58), 1),
      keyLevelVarianceMm: round(state.rng.range(1.0, 2.8), 2),
      regulationVarianceMm: round(state.rng.range(1.1, 3.2), 2),
      pedalNoise: round(state.rng.range(18, 48), 1),
      damperFunction: round(state.rng.range(48, 78), 1),
      voicingBalance: round(state.rng.range(30, 82), 1),
      floorLevelMm: round(state.rng.range(1.5, 6.5), 1),
      humidityPercent: round(state.rng.range(34, 60), 1),
      stabilizationHours: 0,
      routeProtection: 25,
      pianistAccepted: false,
    },
    log: [`Started ${profile.label}.`],
    finalized: false,
  };
  state.activePianoInstall = install;
  return install;
}

export function applyPianoAction(state, actionId) {
  const install = state.activePianoInstall;
  const action = pianoInstallActions.find((item) => item.id === actionId);
  if (!install || !action || install.finalized) return { ok: false, message: "Piano action unavailable." };
  const m = install.measurements;
  install.elapsedMinutes = Math.max(0, install.elapsedMinutes + action.minutes);
  install.steps[action.step] = (install.steps[action.step] || 0) + 1;
  if (action.shortcut) {
    install.shortcuts.push(action.id);
    install.damageRisk = clamp(install.damageRisk + action.severity * 18, 0, 100);
    if (action.dishonest) install.dishonest = true;
  }

  switch (actionId) {
    case "site-inspection":
      install.documentation += 12;
      m.floorLevelMm = round(Math.max(0.4, m.floorLevelMm - 0.8), 1);
      break;
    case "protect-route":
      m.routeProtection = clamp(m.routeProtection + 45, 0, 100);
      install.damageRisk = clamp(install.damageRisk - 6, 0, 100);
      break;
    case "level-placement":
      m.floorLevelMm = round(Math.max(0.1, m.floorLevelMm - 2.1), 1);
      m.pedalNoise = clamp(m.pedalNoise - 5, 0, 100);
      break;
    case "humidity-reading":
      install.documentation += 10;
      break;
    case "acclimate":
      m.stabilizationHours += 12;
      m.pitchCents = round(m.pitchCents * 0.82, 1);
      break;
    case "pitch-raise":
      m.pitchCents = round(m.pitchCents * 0.35, 1);
      m.unisonSpreadCents = round(m.unisonSpreadCents * 1.08, 1);
      break;
    case "fine-tune":
      m.pitchCents = round(m.pitchCents * 0.22, 1);
      m.unisonSpreadCents = round(m.unisonSpreadCents * 0.62, 1);
      break;
    case "unison-cleanup":
      m.unisonSpreadCents = round(m.unisonSpreadCents * 0.45, 1);
      break;
    case "octave-stretch":
      m.octaveStretchQuality = clamp(m.octaveStretchQuality + 24, 0, 100);
      break;
    case "key-leveling":
      m.keyLevelVarianceMm = round(Math.max(0.2, m.keyLevelVarianceMm - 0.75), 2);
      break;
    case "action-regulation":
      m.regulationVarianceMm = round(Math.max(0.2, m.regulationVarianceMm - 0.95), 2);
      break;
    case "pedal-regulation":
      m.pedalNoise = clamp(m.pedalNoise - 18, 0, 100);
      m.damperFunction = clamp(m.damperFunction + 14, 0, 100);
      break;
    case "voice-hammers":
      m.voicingBalance = round(m.voicingBalance + (62 - m.voicingBalance) * 0.55, 1);
      break;
    case "artist-playtest":
      m.pianistAccepted = scorePianoInstall(state, install).score >= 74;
      install.documentation += 5;
      break;
    case "acceptance-report":
      install.documentation += 26;
      break;
    case "shortcut-skip-acclimation":
      m.stabilizationHours = Math.max(0, m.stabilizationHours - 10);
      m.pitchCents = round(m.pitchCents + state.rng.range(-4, 4), 1);
      break;
    case "shortcut-skip-regulation":
      m.regulationVarianceMm = round(m.regulationVarianceMm + 0.4, 2);
      m.pedalNoise = clamp(m.pedalNoise + 8, 0, 100);
      break;
    case "shortcut-fake-signoff":
      m.pianistAccepted = true;
      break;
    default:
      break;
  }
  const summary = summarizePianoInstall(state, install);
  install.log.unshift(`${action.label}: ${summary}`);
  return { ok: true, message: summary };
}

export function scorePianoInstall(state, install = state.activePianoInstall) {
  if (!install) return { score: 0, accepted: false, components: {}, risks: {} };
  const profile = pianoInstallProfiles[install.profileId] || pianoInstallProfiles.uprightStandard;
  const m = install.measurements;
  const pitchScore = clamp(100 - Math.abs(m.pitchCents - profile.targetPitchCents) / profile.maxPitchCents * 45, 0, 100);
  const unisonScore = clamp(100 - m.unisonSpreadCents / profile.maxUnisonSpreadCents * 44, 0, 100);
  const stretchScore = clamp(m.octaveStretchQuality, 0, 100);
  const levelScore = clamp(100 - m.keyLevelVarianceMm / profile.keyLevelMaxMm * 42, 0, 100);
  const regulationScore = clamp(100 - m.regulationVarianceMm / profile.regulationMaxMm * 42, 0, 100);
  const pedalScore = clamp(100 - m.pedalNoise / profile.pedalNoiseMax * 48 + m.damperFunction * 0.12, 0, 100);
  const voicingScore = clamp(100 - Math.abs(m.voicingBalance - profile.voicingIdeal) * 1.8, 0, 100);
  const placementScore = clamp(100 - m.floorLevelMm * 10 + m.routeProtection * 0.1, 0, 100);
  const humidityScore = clamp(100 - Math.max(0, profile.humidityMin - m.humidityPercent, m.humidityPercent - profile.humidityMax) * 8, 0, 100);
  const acclimationScore = clamp(m.stabilizationHours * 8, 0, 100);
  const documentationScore = clamp(install.documentation, 0, 100);
  const requiredSteps = ["site", "move", "placement", "humidity", "acclimation", "tuning", "regulation", "pedals", "voicing", "acceptance", "documentation"];
  const stepScore = requiredSteps.filter((step) => install.steps[step] > 0).length / requiredSteps.length * 100;
  let score =
    pitchScore * 0.13 +
    unisonScore * 0.12 +
    stretchScore * 0.08 +
    levelScore * 0.09 +
    regulationScore * 0.13 +
    pedalScore * 0.1 +
    voicingScore * 0.08 +
    placementScore * 0.08 +
    humidityScore * 0.06 +
    acclimationScore * 0.07 +
    documentationScore * 0.08 +
    stepScore * 0.08;
  score -= install.shortcuts.length * 9;
  score -= install.damageRisk * 0.18;
  if (install.dishonest) score -= 22;
  const finalScore = clamp(round(score, 1), 0, 100);
  return {
    score: finalScore,
    accepted: finalScore >= profile.acceptanceThreshold && (m.pianistAccepted || finalScore >= profile.acceptanceThreshold + 8),
    components: {
      pitchScore: round(pitchScore, 1),
      unisonScore: round(unisonScore, 1),
      stretchScore: round(stretchScore, 1),
      regulationScore: round(regulationScore, 1),
      pedalScore: round(pedalScore, 1),
      voicingScore: round(voicingScore, 1),
      documentationScore: round(documentationScore, 1),
      stepScore: round(stepScore, 1),
    },
    risks: {
      damageRisk: round(install.damageRisk, 1),
      shortcutCount: install.shortcuts.length,
      dishonest: install.dishonest,
    },
  };
}

export function summarizePianoInstall(state, install = state.activePianoInstall) {
  if (!install) return "No piano install active.";
  const m = install.measurements;
  return `pitch ${m.pitchCents} cents, unisons ${m.unisonSpreadCents} cents, keys ${m.keyLevelVarianceMm} mm, regulation ${m.regulationVarianceMm} mm, pedal noise ${m.pedalNoise}, voicing ${m.voicingBalance}, humidity ${m.humidityPercent}%.`;
}

export function finalizePianoInstall(state) {
  const install = state.activePianoInstall;
  if (!install) return null;
  const result = scorePianoInstall(state, install);
  install.finalized = true;
  install.finalScore = result;
  install.log.unshift(`Final piano install score ${result.score}/100.`);
  return result;
}
