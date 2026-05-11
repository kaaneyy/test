import { pianoInstallActions, pianoInstallProfiles } from "../data/pianoProcedures.ts";
import { scorePianoInstall, summarizePianoInstall } from "../core/Piano.ts";

export function renderPianoInstallPanel(state) {
  const install = state.activePianoInstall;
  if (!install) return "";
  const profile = pianoInstallProfiles[install.profileId];
  const score = scorePianoInstall(state, install);
  const m = install.measurements;
  return `
    <div class="piano-panel">
      <h3>Piano Installation Minigame</h3>
      <p class="muted">${profile.label}. Payment depends on installation, tuning, regulation, voicing, documentation, and acceptance.</p>
      <div class="score-strip">
        <span>Install score <strong>${score.score}</strong></span>
        <span>Acceptance <strong>${score.accepted ? "likely" : "not yet"}</strong></span>
        <span>Damage risk <strong>${score.risks.damageRisk}</strong></span>
      </div>
      <div class="measurement-grid">
        ${metric("Pitch", `${m.pitchCents} cents`, `target ${profile.targetPitchCents}`)}
        ${metric("Unison spread", `${m.unisonSpreadCents} cents`, `max ${profile.maxUnisonSpreadCents}`)}
        ${metric("Key level variance", `${m.keyLevelVarianceMm} mm`, `max ${profile.keyLevelMaxMm}`)}
        ${metric("Regulation variance", `${m.regulationVarianceMm} mm`, `max ${profile.regulationMaxMm}`)}
        ${metric("Pedal noise", `${m.pedalNoise}`, `max ${profile.pedalNoiseMax}`)}
        ${metric("Damper function", `${m.damperFunction}/100`)}
        ${metric("Voicing balance", `${m.voicingBalance}`, `ideal ${profile.voicingIdeal}`)}
        ${metric("Humidity", `${m.humidityPercent}%`, `${profile.humidityMin}-${profile.humidityMax}%`)}
        ${metric("Floor level", `${m.floorLevelMm} mm`)}
        ${metric("Acclimation", `${m.stabilizationHours} h`)}
      </div>
      <p class="quote">${summarizePianoInstall(state, install)}</p>
      <div class="action-grid">
        ${pianoInstallActions.map((action) => `
          <button data-action="piano-action" data-id="${action.id}" class="${action.shortcut ? "danger-button" : ""}" title="${action.help}">
            ${action.label}
          </button>
        `).join("")}
      </div>
    </div>
  `;
}

function metric(label, value, hint = "") {
  return `
    <div class="metric">
      <span>${label}</span>
      <strong>${value}</strong>
      ${hint ? `<small>${hint}</small>` : ""}
    </div>
  `;
}
