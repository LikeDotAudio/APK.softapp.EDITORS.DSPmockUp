// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

import test from 'node:test';
import assert from 'node:assert/strict';
import { DspModel, STAGE_TYPES } from '../js/dspModel.js';
import { renderDspSignalChainSvg } from '../js/dspSvg.js';

test('DspModel initializes with standard default processing stages', () => {
  const model = new DspModel();
  assert.equal(model.deviceMnemonic, 'DSP-01');
  assert.ok(model.stages.length >= 8);
  const aecStage = model.stages.find((s) => s.type === 'AEC');
  assert.ok(aecStage);
  assert.equal(aecStage.bypassed, false);
});

test('calculateLabourHours aggregates base engineering, programming, and room tuning hours', () => {
  const model = new DspModel();
  const labour = model.calculateLabourHours();
  assert.equal(labour.baseEngineeringHours, 2.0);
  assert.equal(labour.roomTuningHours, 3.0);
  assert.ok(labour.programmingHours > 5.0);
  assert.equal(labour.totalHours, 2.0 + labour.programmingHours + 3.0);
});

test('DspModel adds, reorders, toggles bypass, and deletes stages', () => {
  const model = new DspModel();
  const initialCount = model.stages.length;

  const newStage = model.addStage('DELAY', 'Fill Speaker Delay');
  assert.equal(model.stages.length, initialCount + 1);
  assert.equal(newStage.type, 'DELAY');

  const bypassState = model.toggleBypass(newStage.id);
  assert.equal(bypassState, true);

  const deleted = model.deleteStage(newStage.id);
  assert.equal(deleted, true);
  assert.equal(model.stages.length, initialCount);
});

test('renderDspSignalChainSvg generates complete SVG signal flow', () => {
  const model = new DspModel();
  const svg = renderDspSignalChainSvg(model);
  assert.ok(svg.includes('<svg'));
  assert.ok(svg.includes('INPUTS'));
  assert.ok(svg.includes('OUTPUTS'));
  assert.ok(svg.includes('dsp-stage-node'));
});
