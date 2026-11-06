// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
// ROAD-3583: the DSP mock-up's .ifc twin (js/dspIfc.js) — written byte-deterministically, read back to the same
// block, saved beside the .json by the vendored APKSoftapp.saveModel. IFC_OUT=<dir> npm test also writes the
// file there, for IfcOpenShell validate + the BIM oracle (DATABASE.server.BIM editors_census.py).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { join } from 'node:path';
import { DspModel } from '../js/dspModel.js';
import { dspToIfc, dspFromIfc } from '../js/dspIfc.js';
import { getPsets, ifcGuid, parseStep, ports, schemaOf } from '../vendor/apk-contracts/apk-ifc.js';
import { buildBundle, BUNDLE } from '../scripts/vendor-ifc.mjs';

function out(name, text) {
  if (!process.env.IFC_OUT) return;
  fs.mkdirSync(process.env.IFC_OUT, { recursive: true });
  fs.writeFileSync(join(process.env.IFC_OUT, name), text);
}

const fixture = () => {
  const m = new DspModel({ id: 'dsp_fixture' });
  m.addStage('DELAY', 'Fill Speaker Delay');
  m.updateStage('stg_10', { delay_ms: 7.25 });
  m.toggleBypass('stg_3');
  return m;
};
const of = (f, type) => f.entities.filter((e) => e.type === type);
const plain = (x) => JSON.parse(JSON.stringify(x));

test('the vendored STEP codec is what contracts/src/ifc builds to today', async () => {
  const now = await buildBundle();
  if (now == null) return;
  assert.equal(fs.readFileSync(BUNDLE, 'utf8'), now, 'run node scripts/vendor-ifc.mjs');
});

test('the frame: an IfcAudioVisualAppliance DSP, inputs SINK, outputs SOURCE, the chain in APK_DspChain', () => {
  const text = dspToIfc(fixture(), { name: 'dsp-01' });
  out('dsp-mockup.ifc', text);
  const f = parseStep(text);
  assert.equal(schemaOf(f), 'IFC4X3_ADD2');
  const [frame] = of(f, 'IFCAUDIOVISUALAPPLIANCE');
  assert.equal(frame.args[8].value, 'USERDEFINED');
  assert.equal(frame.args[4], 'DSP');
  assert.equal(frame.args[7], 'DSP-01');
  assert.equal(frame.args[0], ifcGuid('dsp', 'dsp_fixture', 'frame'));
  const [type] = of(f, 'IFCAUDIOVISUALAPPLIANCETYPE');
  assert.deepEqual([type.args[8], type.args[9].value], ['DSP', 'USERDEFINED']);
  const ps = ports(f, frame);
  assert.equal(ps.filter((p) => p.args[7].value === 'SINK').length, 6);
  assert.equal(ps.filter((p) => p.args[7].value === 'SOURCE').length, 5);
  assert.deepEqual(getPsets(f, ps[0]).APK_Terminal, { TerminalId: 'I1', Side: 'input' });
  const chain = getPsets(f, frame).APK_DspChain;
  assert.equal(chain.StageIds.length, 10);
  assert.equal(chain.StageTypes[9], 'DELAY');
  assert.equal(chain.StageBypassed[2], true);
  const l = fixture().calculateLabourHours();
  assert.equal(chain.TotalLabour, l.totalHours * 3600, 'labour in seconds, the project time unit');
  assert.match(text, /'StageDelay',\$,\(IFCIDENTIFIER\('stg_7'\),IFCIDENTIFIER\('stg_10'\)\),\(IFCTIMEMEASURE\(0\.0145\),IFCTIMEMEASURE\(0\.00725\)\)/);
  assert.equal(of(f, 'IFCRELCONNECTSPORTS').length, 0, 'nothing physical joins two stages');
});

test('read back: the same block; written again: the same bytes', () => {
  const m = fixture();
  const text = dspToIfc(m, { name: 'dsp-01' });
  assert.equal(text, dspToIfc(plain(m.toJSON()), { name: 'dsp-01' }));
  const back = dspFromIfc(text);
  assert.deepEqual(back, plain(m.toJSON()));
  assert.equal(dspToIfc(back, { name: 'dsp-01' }), text);
});

test('not a DSP: a sentence, never a half-read block', () => {
  const text = dspToIfc(fixture()).replace(/,'DSP',#/, ",'MIXER',#");
  assert.throws(() => dspFromIfc(text), /no DSP mock-up in this IFC/);
});

test('Save Model writes <mnemonic>.ifc then <mnemonic>.json through the vendored apk-softapp', async () => {
  const downloads = [];
  let blob = null;
  const doc = {
    title: 'DSP', body: { appendChild(n) { return n; } }, documentElement: { style: { setProperty() {} } },
    getElementById: () => null,
    createElement: () => ({ style: {}, setAttribute() {}, click() { downloads.push({ name: this.download, text: blob.text }); }, remove() {} }),
  };
  const win = {
    location: { origin: 'http://bench:8080' }, document: doc, addEventListener() {}, removeEventListener() {},
    Blob: class { constructor(parts, o) { this.text = parts.join(''); this.type = o.type; } },
    URL: { createObjectURL: (b) => { blob = b; return 'blob:1'; }, revokeObjectURL() {} },
    setTimeout: (fn) => { fn(); return 1; }, setInterval: () => 1, clearInterval() {},
    JSON, Date, Math, Promise, Object, Array, String, Number, isFinite, parseInt, RegExp,
  };
  win.window = win; win.globalThis = win; win.parent = win;
  vm.runInNewContext(fs.readFileSync(new URL('../vendor/apk-softapp/apk-softapp.js', import.meta.url), 'utf8'), win);
  const m = fixture();
  const r = await win.APKSoftapp.saveModel(m, { name: 'dsp-01', toJson: (x) => x.toJSON(), toIfc: (x) => dspToIfc(x, { name: 'dsp-01' }) });
  assert.equal(r.ok, true);
  assert.deepEqual(downloads.map((d) => d.name), ['dsp-01.ifc', 'dsp-01.json']);
  assert.equal(downloads[0].text, dspToIfc(m, { name: 'dsp-01' }));
  assert.deepEqual(JSON.parse(downloads[1].text), plain(m.toJSON()));
});
