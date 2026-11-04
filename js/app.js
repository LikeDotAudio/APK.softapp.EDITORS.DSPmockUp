// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

import { BlockBridge } from './blockBridge.js';
import { DspModel, STAGE_TYPES } from './dspModel.js';
import { renderDspSignalChainSvg } from './dspSvg.js';

let model = new DspModel();

const bridge = new BlockBridge({
  name: 'DSP Mockup Editor',
  type: 'dspmockup',
  defaultBlock: model.toJSON(),
  onBlockLoaded: (block) => {
    if (block) {
      model = new DspModel(block);
      renderAll();
    }
  },
});

function renderPalette() {
  const container = document.getElementById('palette-stages');
  if (!container) return;

  container.innerHTML = Object.entries(STAGE_TYPES).map(([key, def]) => `
    <button class="btn btn-secondary btn-stage-add" data-stage-type="${key}" style="justify-content: flex-start; text-align: left; padding: 7px 10px;">
      <span style="font-size: 15px; margin-right: 6px;">${def.icon}</span>
      <div style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
        <div style="font-weight: 600; font-size: 11px;">${def.label}</div>
        <div style="font-size: 9px; opacity: 0.7; font-family: var(--font-mono);">${def.defaultHours} hrs est.</div>
      </div>
    </button>
  `).join('');

  container.querySelectorAll('.btn-stage-add').forEach((btn) => {
    btn.addEventListener('click', () => {
      const type = btn.getAttribute('data-stage-type');
      const newStage = model.addStage(type);
      model.selectedStageId = newStage.id;
      bridge.notifyChanged();
      renderAll();
    });
  });
}

function renderInspector() {
  const container = document.getElementById('inspector-content');
  if (!container) return;

  if (model.selectedStageId) {
    const stage = model.stages.find((s) => s.id === model.selectedStageId);
    if (!stage) {
      model.selectedStageId = null;
      renderInspector();
      return;
    }
    const def = STAGE_TYPES[stage.type] || STAGE_TYPES.PEQ;

    container.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; border-bottom: 1px solid var(--osc-border-default); padding-bottom: 8px;">
        <div style="display: flex; align-items: center; gap: 6px;">
          <span style="font-size: 16px;">${def.icon}</span>
          <span style="font-weight: 700; color: var(--osc-text-primary); font-size: 13px;">${stage.label}</span>
        </div>
        <button class="btn btn-secondary btn-sm" id="btn-delete-stage" style="color: var(--osc-status-danger);">🗑️ Delete</button>
      </div>

      <div style="display: flex; flex-direction: column; gap: 10px;">
        <div>
          <label style="display: block; font-size: 10px; color: var(--osc-text-muted); margin-bottom: 3px;">STAGE NAME / LABEL</label>
          <input type="text" class="input" id="inp-label" value="${stage.label}">
        </div>

        <div style="display: flex; gap: 8px; margin-top: 4px;">
          <button class="btn ${stage.bypassed ? 'btn-secondary' : 'btn-primary'} btn-sm" id="btn-toggle-bypass" style="flex: 1;">
            ${stage.bypassed ? 'Activate Stage' : 'Bypass Stage'}
          </button>
        </div>

        ${stage.gain_db !== undefined ? `
          <div>
            <label style="display: block; font-size: 10px; color: var(--osc-text-muted); margin-bottom: 3px;">GAIN TRIM (dB): <span id="val-gain">${stage.gain_db} dB</span></label>
            <input type="range" min="-20" max="60" step="1" value="${stage.gain_db}" id="inp-gain" style="width: 100%;">
          </div>
        ` : ''}

        ${stage.freq_hz !== undefined ? `
          <div>
            <label style="display: block; font-size: 10px; color: var(--osc-text-muted); margin-bottom: 3px;">FREQUENCY (Hz)</label>
            <input type="number" class="input" id="inp-freq" value="${stage.freq_hz}">
          </div>
        ` : ''}

        ${stage.delay_ms !== undefined ? `
          <div>
            <label style="display: block; font-size: 10px; color: var(--osc-text-muted); margin-bottom: 3px;">ALIGNMENT DELAY (ms)</label>
            <input type="number" step="0.1" class="input" id="inp-delay" value="${stage.delay_ms}">
          </div>
        ` : ''}

        ${stage.threshold_db !== undefined ? `
          <div>
            <label style="display: block; font-size: 10px; color: var(--osc-text-muted); margin-bottom: 3px;">LIMITER THRESHOLD (dBFS)</label>
            <input type="number" step="0.5" class="input" id="inp-thresh" value="${stage.threshold_db}">
          </div>
        ` : ''}

        <div style="padding: 10px; background: var(--osc-bg-input); border: 1px solid var(--osc-border-default); border-radius: 4px; margin-top: 8px;">
          <div style="font-size: 10px; color: var(--osc-text-muted); margin-bottom: 4px;">ESTIMATED COMMISSIONING LABOUR</div>
          <div style="display: flex; justify-content: space-between; font-weight: 600;">
            <span>Stage Configuration:</span>
            <span style="color: var(--osc-accent-primary);">${def.defaultHours} Hours</span>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-delete-stage')?.addEventListener('click', () => {
      model.deleteStage(stage.id);
      bridge.notifyChanged();
      renderAll();
    });

    document.getElementById('btn-toggle-bypass')?.addEventListener('click', () => {
      model.toggleBypass(stage.id);
      bridge.notifyChanged();
      renderAll();
    });

    document.getElementById('inp-label')?.addEventListener('input', (e) => {
      stage.label = e.target.value;
      bridge.notifyChanged();
      renderSvg();
    });

    document.getElementById('inp-gain')?.addEventListener('input', (e) => {
      stage.gain_db = parseFloat(e.target.value) || 0;
      document.getElementById('val-gain').textContent = `${stage.gain_db} dB`;
      bridge.notifyChanged();
    });

    document.getElementById('inp-freq')?.addEventListener('input', (e) => {
      stage.freq_hz = parseFloat(e.target.value) || 0;
      bridge.notifyChanged();
    });

    document.getElementById('inp-delay')?.addEventListener('input', (e) => {
      stage.delay_ms = parseFloat(e.target.value) || 0;
      bridge.notifyChanged();
    });

    document.getElementById('inp-thresh')?.addEventListener('input', (e) => {
      stage.threshold_db = parseFloat(e.target.value) || 0;
      bridge.notifyChanged();
    });

  } else {
    container.innerHTML = `
      <div style="padding: 20px 10px; text-align: center; color: var(--osc-text-muted);">
        <div style="font-size: 28px; margin-bottom: 8px; opacity: 0.5;">🎛️</div>
        <div>Select a DSP stage node from the signal pipeline to inspect and tune parameters.</div>
      </div>
    `;
  }
}

function renderLabourRollup() {
  const container = document.getElementById('telemetry-metrics');
  if (!container) return;

  const l = model.calculateLabourHours();
  container.innerHTML = `
    <div style="display: flex; align-items: center; gap: 14px; font-size: 10px; color: var(--osc-text-muted);">
      <span>STAGES: <strong style="color: var(--osc-text-primary);">${model.stages.length}</strong></span>
      <span>PROGRAMMING: <strong style="color: var(--osc-accent-secondary);">${l.programmingHours} hrs</strong></span>
      <span>ROOM TUNING: <strong style="color: var(--osc-accent-secondary);">${l.roomTuningHours} hrs</strong></span>
      <span>TOTAL DSP LABOUR: <strong style="color: var(--osc-accent-primary);">${l.totalHours} hrs</strong></span>
    </div>
  `;
}

function renderSvg() {
  const container = document.getElementById('canvas-wrapper');
  if (!container) return;

  container.innerHTML = renderDspSignalChainSvg(model, {
    selectedStageId: model.selectedStageId,
  });

  const svg = container.querySelector('#dsp-canvas-svg');
  if (!svg) return;

  svg.querySelectorAll('.dsp-stage-node').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = el.getAttribute('data-stage-id');
      model.selectedStageId = id;
      renderAll();
    });
  });

  svg.addEventListener('click', () => {
    model.selectedStageId = null;
    renderAll();
  });
}

function renderAll() {
  renderSvg();
  renderPalette();
  renderInspector();
  renderLabourRollup();
}

document.addEventListener('DOMContentLoaded', () => {
  renderAll();

  document.getElementById('btn-open-block')?.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target.result);
          model = new DspModel(parsed);
          bridge.loadBlock(model.toJSON(), { filename: file.name });
          renderAll();
        } catch (err) {
          alert('Failed to parse DSP file: ' + err.message);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  });

  document.getElementById('btn-discovered')?.addEventListener('click', async () => {
    const project = await bridge.fetchDiscoveredProject();
    if (project) {
      alert(`Discovered Project: ${project.project_name || 'DSP Core Systems'}\nStages: ${model.stages.length}`);
    } else {
      alert('Connecting to live discovery bus...');
    }
  });

  document.getElementById('btn-save-block')?.addEventListener('click', () => {
    bridge.saveBlock(model.toJSON(), { filename: model.deviceMnemonic.toLowerCase() });
  });

  document.getElementById('btn-close')?.addEventListener('click', () => {
    bridge.close();
  });
});
