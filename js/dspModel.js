// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

export const STAGE_TYPES = {
  PREAMP: { label: 'Input Preamp / Gain', icon: '🎚️', color: '#4A9EFF', defaultHours: 0.5 },
  HPF: { label: 'High-Pass Filter', icon: '〰️', color: '#38BDF8', defaultHours: 0.25 },
  AEC: { label: 'Acoustic Echo Cancellation', icon: '📡', color: '#F4902C', defaultHours: 2.0 },
  AUTOMIXER: { label: 'Gain-Sharing Automixer', icon: '🎛️', color: '#10B981', defaultHours: 1.5 },
  PEQ: { label: 'Parametric Equalizer (5-Band)', icon: '📊', color: '#A855F7', defaultHours: 0.75 },
  DYNAMICS: { label: 'Compressor / Limiter', icon: '⚡', color: '#F59E0B', defaultHours: 0.5 },
  MATRIX: { label: 'Cross-Point Audio Matrix', icon: '🔀', color: '#EC4899', defaultHours: 2.5 },
  DELAY: { label: 'Alignment Delay', icon: '⏱️', color: '#6366F1', defaultHours: 0.5 },
  OUTPUT_GAIN: { label: 'Output Line Driver', icon: '🔊', color: '#22C55E', defaultHours: 0.25 },
};

export class DspModel {
  constructor(initialData = null) {
    this.id = initialData?.id || `dsp_${Date.now()}`;
    this.name = initialData?.name || 'Main Room DSP Frame Configuration';
    this.deviceMnemonic = initialData?.deviceMnemonic || 'DSP-01';
    this.inputs = initialData?.inputs || ['Mic 1', 'Mic 2', 'Mic 3', 'Mic 4', 'Dante In 1-2', 'Line In'];
    this.outputs = initialData?.outputs || ['Main PA L', 'Main PA R', 'Subwoofer', 'Stream Aux', 'Rec Bus'];

    this.stages = initialData?.stages || [
      { id: 'stg_1', type: 'PREAMP', label: 'Analog Mic Preamps', bypassed: false, gain_db: 42, mute: false },
      { id: 'stg_2', type: 'HPF', label: '80Hz Rumble Cut', bypassed: false, freq_hz: 80, mute: false },
      { id: 'stg_3', type: 'AEC', label: 'Far-End Echo Canceller', bypassed: false, erl_db: 18, mute: false },
      { id: 'stg_4', type: 'AUTOMIXER', label: 'Dugan Automixer Pool', bypassed: false, priority: 'Normal', mute: false },
      { id: 'stg_5', type: 'PEQ', label: 'Vocal Clarity PEQ', bypassed: false, bands: 5, mute: false },
      { id: 'stg_6', type: 'MATRIX', label: '16x16 Room Routing Matrix', bypassed: false, routesCount: 12, mute: false },
      { id: 'stg_7', type: 'DELAY', label: 'PA Time Alignment', bypassed: false, delay_ms: 14.5, mute: false },
      { id: 'stg_8', type: 'DYNAMICS', label: 'Peak Limiter Protection', bypassed: false, threshold_db: -2.0, mute: false },
      { id: 'stg_9', type: 'OUTPUT_GAIN', label: 'Line Output Trims', bypassed: false, gain_db: 0, mute: false },
    ];

    this.selectedStageId = null;
    this._stageCounter = this.stages.length + 1;
  }

  addStage(type, label = null) {
    const stageDef = STAGE_TYPES[type] || STAGE_TYPES.PEQ;
    const id = `stg_${this._stageCounter++}`;
    const newStage = {
      id,
      type,
      label: label || stageDef.label,
      bypassed: false,
      mute: false,
      gain_db: 0,
      freq_hz: 1000,
      delay_ms: 0,
      threshold_db: -6.0,
    };
    this.stages.push(newStage);
    return newStage;
  }

  updateStage(id, updates) {
    const stage = this.stages.find((s) => s.id === id);
    if (!stage) return null;
    Object.assign(stage, updates);
    return stage;
  }

  toggleBypass(id) {
    const stage = this.stages.find((s) => s.id === id);
    if (stage) {
      stage.bypassed = !stage.bypassed;
      return stage.bypassed;
    }
    return false;
  }

  deleteStage(id) {
    const idx = this.stages.findIndex((s) => s.id === id);
    if (idx !== -1) {
      this.stages.splice(idx, 1);
      if (this.selectedStageId === id) this.selectedStageId = null;
      return true;
    }
    return false;
  }

  reorderStage(fromIndex, toIndex) {
    if (fromIndex < 0 || fromIndex >= this.stages.length) return false;
    if (toIndex < 0 || toIndex >= this.stages.length) return false;
    const [moved] = this.stages.splice(fromIndex, 1);
    this.stages.splice(toIndex, 0, moved);
    return true;
  }

  calculateLabourHours() {
    let baseEngineeringHours = 2.0; // Base architecture setup
    let programmingHours = 0;

    for (const stage of this.stages) {
      const def = STAGE_TYPES[stage.type] || { defaultHours: 0.5 };
      programmingHours += def.defaultHours;
    }

    const roomTuningHours = 3.0; // Alignment, Pink noise, RTA measurement
    const totalHours = baseEngineeringHours + programmingHours + roomTuningHours;

    return {
      baseEngineeringHours,
      programmingHours: Math.round(programmingHours * 10) / 10,
      roomTuningHours,
      totalHours: Math.round(totalHours * 10) / 10,
    };
  }

  toJSON() {
    return {
      type: 'dspmockup',
      id: this.id,
      name: this.name,
      deviceMnemonic: this.deviceMnemonic,
      inputs: this.inputs,
      outputs: this.outputs,
      stages: this.stages,
    };
  }
}
