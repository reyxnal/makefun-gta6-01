// Mission chain, story dialogue flow, progression rewards and saving.
// Steps are data in config.js; this system walks them and reports progress.
import { MISSIONS, SAVE_KEY, distance2D } from './config.js';

export class MissionSystem {
  constructor(callbacks) {
    this.cb = callbacks;
    this.missionIndex = 0;
    this.stepIndex = 0;
    this.active = false;
    this.finishedAll = false;
    this.stepTimer = 0;
    this.gateIndex = 0;
    this.stepStarted = false;
    this.caseHeld = false;
    this.deliaAboard = false;
    this.dialogueOpen = false;
  }

  currentMission() { return MISSIONS[this.missionIndex] || null; }
  currentStep() {
    const m = this.currentMission();
    return m ? m.steps[this.stepIndex] || null : null;
  }

  startChain() {
    this.active = true;
    this.beginMission(this.missionIndex);
  }

  beginMission(index) {
    this.missionIndex = index;
    this.stepIndex = 0;
    this.stepStarted = false;
    const m = this.currentMission();
    if (!m) { this.finishAll(); return; }
    this.cb.onMissionStart(m);
    this.showBriefing(m);
  }

  showBriefing(mission) {
    this.dialogueOpen = true;
    this.cb.showDialogue(mission.briefing, () => { this.dialogueOpen = false; });
  }

  restartCurrentStep() {
    this.stepStarted = false;
    this.gateIndex = 0;
    const step = this.currentStep();
    if (step && step.kind === 'checkpoints') this.cb.onGatesReset(step);
    if (step && step.kind === 'defeat') this.cb.onSpawnEnemies();
  }

  beginStep(step) {
    this.stepStarted = true;
    if (step.kind === 'checkpoints') {
      this.gateIndex = 0;
      this.stepTimer = step.timeLimit;
      this.cb.onGatesReset(step);
    }
    if (step.kind === 'defeat') this.cb.onSpawnEnemies();
    if (step.kind === 'escape' || step.kind === 'finale') this.cb.onSetWanted(step.startWanted || 3);
    this.cb.onStepStart(step, this.stepIndex);
  }

  advanceStep() {
    const mission = this.currentMission();
    this.stepIndex += 1;
    this.stepStarted = false;
    if (this.stepIndex >= mission.steps.length) {
      this.completeMission(mission);
    } else {
      this.cb.onStepStart(this.currentStep(), this.stepIndex);
    }
  }

  completeMission(mission) {
    this.cb.onMissionComplete(mission);
    this.missionIndex += 1;
    if (this.missionIndex >= MISSIONS.length) {
      this.finishAll();
    } else {
      this.beginMission(this.missionIndex);
    }
  }

  finishAll() {
    this.finishedAll = true;
    this.active = false;
    this.cb.onAllMissionsDone();
  }

  update(dt, ctx) {
    if (!this.active || this.dialogueOpen) return;
    const mission = this.currentMission();
    const step = this.currentStep();
    if (!mission || !step) return;
    if (!this.stepStarted) this.beginStep(step);
    const px = ctx.player.x; const pz = ctx.player.z;
    if (step.kind === 'reach') {
      this.cb.setMarker(step.x, step.z, 0xffd23e);
      if (distance2D(px, pz, step.x, step.z) < step.radius) {
        if (step.pickup === 'case') { this.caseHeld = true; this.cb.onCasePickup(); }
        this.advanceStep();
      }
    } else if (step.kind === 'stealCar') {
      this.cb.setMarker(step.x, step.z, 0xffd23e);
      const car = ctx.player.inCar;
      if (car && car.id === step.carId) this.advanceStep();
    } else if (step.kind === 'driveTo') {
      this.cb.setMarker(step.x, step.z, 0xffd23e);
      const okCar = !step.needCar || !!ctx.player.inCar;
      if (okCar && distance2D(px, pz, step.x, step.z) < step.radius) this.advanceStep();
    } else if (step.kind === 'checkpoints') {
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        this.cb.onCheckpointTimeout();
        this.restartCurrentStep();
        return;
      }
      const gate = step.gates[this.gateIndex];
      if (!gate) { this.advanceStep(); return; }
      this.cb.setMarker(gate[0], gate[1], 0xffd23e);
      this.cb.onGateProgress(this.gateIndex, step.gates.length, this.stepTimer);
      if (distance2D(px, pz, gate[0], gate[1]) < step.radius) {
        this.gateIndex += 1;
        this.cb.onGateHit(this.gateIndex, step.gates.length);
        if (this.gateIndex >= step.gates.length) this.advanceStep();
        else this.cb.onActiveGate(this.gateIndex);
      }
    } else if (step.kind === 'defeat') {
      this.cb.setMarker(step.x, step.z, 0xff5b6e);
      if (this.cb.enemiesAlive() === 0) this.advanceStep();
    } else if (step.kind === 'escape') {
      this.cb.setMarker(step.x, step.z, 0x7dffb0);
      const near = distance2D(px, pz, step.x, step.z) < step.radius;
      if (near && this.cb.wantedStars() === 0) this.advanceStep();
    } else if (step.kind === 'finale') {
      this.cb.setMarker(step.x, step.z, 0xffd23e);
      if (distance2D(px, pz, step.x, step.z) < step.radius) this.advanceStep();
    }
  }

  markerPosition() {
    const step = this.currentStep();
    if (!step || !this.active) return null;
    if (step.kind === 'checkpoints') {
      const gate = step.gates[this.gateIndex];
      return gate ? { x: gate[0], z: gate[1] } : null;
    }
    if (step.kind === 'stealCar') return { x: step.x, z: step.z };
    return { x: step.x, z: step.z };
  }
}

export function saveGameState(state) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch (err) { return false; }
}

export function loadGameState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) { return null; }
}

export function hasSaveGame() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch (err) { return false; }
}

export function clearSaveGame() {
  try { localStorage.removeItem(SAVE_KEY); } catch (err) { /* storage unavailable */ }
}
