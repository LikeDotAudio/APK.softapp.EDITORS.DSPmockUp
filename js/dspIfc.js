// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
/* dspIfc.js — THE DSP MOCK-UP'S .IFC TWIN (ROAD-3583). Save Model writes the native block (DspModel.toJSON)
   AND this IFC4X3_ADD2 file through APKSoftapp.saveModel; Open Model reads it back to the same block.
   Written with the contracts STEP codec (vendor/apk-contracts/apk-ifc.js, scripts/vendor-ifc.mjs), no
   IfcOpenShell in the page. Byte-deterministic: the same mock-up writes the same file.

     IfcProject ─ IfcSite ─ IfcBuilding ─ IfcBuildingStorey 'DSP'          units: mm, s, Hz
     the DSP frame  IfcAudioVisualAppliance USERDEFINED, ObjectType 'DSP' (IFC has no DSP word: the BIM
                    library's DSP/Mixer class rule, IFC-CORE-DELTAS-DETAIL), Name = the mock-up's name,
                    Tag = the device mnemonic; typed by an IfcAudioVisualApplianceType USERDEFINED,
                    ElementType 'DSP'; contained in the storey
     an input       IfcDistributionPort CABLE AUDIOVISUAL, FlowDirection SINK, Name = the input's name;
                    Pset_DistributionPortCommon.PortNumber n; APK_Terminal {TerminalId I<n>, Side input}
     an output      the same, FlowDirection SOURCE, TerminalId O<n>, Side output
     the blocks     APK_DspChain on the frame: the processing stages in signal order, StageIds / StageTypes /
                    StageLabels / StageBypassed / StageMuted one per stage, each stage's parameters a table
                    keyed by its id (only what a stage states is written: an HPF has no gain), the delay in
                    seconds and the frequency in Hz (the project's units); the labour roll-up
                    (DspModel.calculateLabourHours) as ProgrammingLabour / TotalLabour, seconds.
   A DSP stage is software inside the frame, not an element in the building: IFC has no word for it, so the
   chain is an APK_ set (declared in DATABASE.server.BIM SRC/tools/ifc/apk_psets_editors.py), never an
   element of its own and never an IfcRelConnectsPorts (nothing physical joins two stages). */

import { entitiesByType, enumv, getPsets, ifcGuid, parseStep, ports, real, ref, typed, writeStep } from '../vendor/apk-contracts/apk-ifc.js';
import { DspModel } from './dspModel.js';

export const DSP_IFC_SCHEMA = 'IFC4X3_ADD2';
const STAMP = '1970-01-01T00:00:00';   // fixed: the file is a function of the mock-up, never of the clock
const HOUR = 3600;

const str = (v) => (v == null ? '' : String(v));
const label = (s) => typed('IFCLABEL', String(s));
const ident = (s) => typed('IFCIDENTIFIER', String(s));
const int = (n) => typed('IFCINTEGER', Math.trunc(n));
const bool = (b) => typed('IFCBOOLEAN', enumv(b ? 'T' : 'F'));
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
const tidy = (x) => Number(x.toFixed(9));   // ms ↔ s, h ↔ s without float dust (14.5 ms stays 14.5)

/* The stage parameters and their tables: [stage key, table name, measure, to file, from file]. A key the
   editor adds that is not here stays in the native .json only. */
const PARAMS = [
  ['gain_db', 'StageGain', 'IFCREAL', (v) => v, (v) => v],
  ['freq_hz', 'StageFrequency', 'IFCFREQUENCYMEASURE', (v) => v, (v) => v],
  ['delay_ms', 'StageDelay', 'IFCTIMEMEASURE', (v) => tidy(v / 1000), (v) => tidy(v * 1000)],
  ['threshold_db', 'StageThreshold', 'IFCREAL', (v) => v, (v) => v],
  ['erl_db', 'StageEchoReturnLoss', 'IFCREAL', (v) => v, (v) => v],
  ['bands', 'StageBands', 'IFCINTEGER', (v) => Math.trunc(v), (v) => v],
  ['routesCount', 'StageRoutes', 'IFCINTEGER', (v) => Math.trunc(v), (v) => v],
  ['priority', 'StagePriority', 'IFCLABEL', (v) => v, (v) => v],
];

class Writer {
  constructor() { this.entities = []; }
  add(type, ...args) {
    const id = this.entities.length + 1;
    this.entities.push({ id, type, args });
    return ref(id);
  }
}

const valueOf = (measure, v) => (measure === 'IFCINTEGER' ? int(v) : measure === 'IFCLABEL' ? label(v) : typed(measure, real(v)));

/** The mock-up (a DspModel or its toJSON block) as IFC4X3_ADD2 STEP text. Every GlobalId is uuid5 of
    dsp/<id>/..., so the same mock-up saved again keeps every GlobalId. */
export function dspToIfc(input, { name } = {}) {
  const model = input instanceof DspModel ? input : new DspModel(input || {});
  const b = model.toJSON();
  const stem = String(name || str(b.deviceMnemonic).toLowerCase() || 'dsp').replace(/\.(ifc|json)$/i, '');
  const key = str(b.id) || stem;
  const W = new Writer();
  const P = ifcGuid('dsp', key);
  const g = (...roles) => ifcGuid('dsp', key, ...roles);

  // ---- owner, units (mm, s, Hz), context, the spine
  const person = W.add('IFCPERSON', null, 'APK.audio', null, null, null, null, null, null);
  const org = W.add('IFCORGANIZATION', null, 'APK.audio', 'DSP mock-up editor', null, null);
  const po = W.add('IFCPERSONANDORGANIZATION', person, org, null);
  const app = W.add('IFCAPPLICATION', org, '1', 'APK.audio DSP mock-up editor', 'EDITORS.DSPmockUp');
  const oh = W.add('IFCOWNERHISTORY', po, app, null, null, null, null, null, 0);
  const units = W.add('IFCUNITASSIGNMENT', [
    W.add('IFCSIUNIT', { kind: 'derived' }, enumv('LENGTHUNIT'), enumv('MILLI'), enumv('METRE')),
    W.add('IFCSIUNIT', { kind: 'derived' }, enumv('TIMEUNIT'), null, enumv('SECOND')),
    W.add('IFCSIUNIT', { kind: 'derived' }, enumv('FREQUENCYUNIT'), null, enumv('HERTZ')),
  ]);
  const origin = W.add('IFCAXIS2PLACEMENT3D', W.add('IFCCARTESIANPOINT', [real(0), real(0), real(0)]), null, null);
  const ctx = W.add('IFCGEOMETRICREPRESENTATIONCONTEXT', null, 'Model', 3, real(1e-5), origin, null);
  const project = W.add('IFCPROJECT', P, oh, str(b.name) || stem, 'DSP mock-up editor: one DSP frame and its signal chain', null, null, null, [ctx], units);
  const sitePl = W.add('IFCLOCALPLACEMENT', null, origin);
  const buildingPl = W.add('IFCLOCALPLACEMENT', sitePl, origin);
  const storeyPl = W.add('IFCLOCALPLACEMENT', buildingPl, origin);
  const site = W.add('IFCSITE', g('site'), oh, 'Site', null, null, sitePl, null, null, enumv('ELEMENT'), null, null, null, null, null);
  const building = W.add('IFCBUILDING', g('building'), oh, 'Building', null, null, buildingPl, null, null, enumv('ELEMENT'), null, null, null);
  const storey = W.add('IFCBUILDINGSTOREY', g('storey'), oh, 'DSP', null, null, storeyPl, null, null, enumv('ELEMENT'), real(0));
  W.add('IFCRELAGGREGATES', g('aggregates', 'project'), oh, null, null, project, [site]);
  W.add('IFCRELAGGREGATES', g('aggregates', 'site'), oh, null, null, site, [building]);
  W.add('IFCRELAGGREGATES', g('aggregates', 'building'), oh, null, null, building, [storey]);

  const rels = [];
  const prop = (n, v) => (v == null || v === '' ? null : W.add('IFCPROPERTYSINGLEVALUE', n, null, v, null));
  const listProp = (n, vs) => (vs.length ? W.add('IFCPROPERTYLISTVALUE', n, null, vs, null) : null);
  const tableProp = (n, rows) => (rows.length ? W.add('IFCPROPERTYTABLEVALUE', n, null, rows.map((r) => r[0]), rows.map((r) => r[1]), null, null, null, null) : null);
  const pset = (setName, ownerGid, props, owner) => {
    const list = props.filter(Boolean);
    if (!list.length) return;
    const ps = W.add('IFCPROPERTYSET', g('pset', ownerGid, setName), oh, setName, null, list);
    rels.push({ ps, owner, gid: g('props', ownerGid, setName) });
  };

  // ---- the frame and its type
  const type = W.add('IFCAUDIOVISUALAPPLIANCETYPE', ifcGuid('dsp-type', 'DSP'), oh, 'DSP frame', null, null, null, null, null, 'DSP', enumv('USERDEFINED'));
  W.add('IFCRELDECLARES', g('declares'), oh, null, null, project, [type]);
  const frameGid = g('frame');
  const frame = W.add('IFCAUDIOVISUALAPPLIANCE', frameGid, oh, str(b.name) || stem,
    'DSP mock-up: the signal chain is a sketch (APK_DspChain), it programs no real DSP', 'DSP',
    W.add('IFCLOCALPLACEMENT', storeyPl, origin), null, str(b.deviceMnemonic) || null, enumv('USERDEFINED'));
  W.add('IFCRELDEFINESBYTYPE', g('typed'), oh, null, null, [frame], type);

  // ---- the chain
  const stages = Array.isArray(b.stages) ? b.stages : [];
  const ids = stages.map((s, i) => str(s.id) || `stg_${i + 1}`);
  const labour = model.calculateLabourHours();
  pset('APK_DspChain', frameGid, [
    prop('ModelId', b.id ? ident(b.id) : null),
    listProp('StageIds', ids.map(ident)),
    listProp('StageTypes', stages.map((s) => label(str(s.type) || 'PEQ'))),
    listProp('StageLabels', stages.map((s) => label(str(s.label)))),
    listProp('StageBypassed', stages.map((s) => bool(!!s.bypassed))),
    listProp('StageMuted', stages.map((s) => bool(!!s.mute))),
    ...PARAMS.map(([k, table, measure, out]) => tableProp(table, stages.flatMap((s, i) => {
      const v = measure === 'IFCLABEL' ? (s[k] == null || s[k] === '' ? null : str(s[k])) : num(s[k]);
      return v == null ? [] : [[ident(ids[i]), valueOf(measure, out(v))]];
    }))),
    prop('ProgrammingLabour', typed('IFCTIMEMEASURE', real(tidy(labour.programmingHours * HOUR)))),
    prop('TotalLabour', typed('IFCTIMEMEASURE', real(tidy(labour.totalHours * HOUR)))),
  ], frame);

  // ---- its ports: the inputs in, the outputs out
  const nested = [];
  const port = (kind, i, nameText) => {
    const input = kind === 'I';
    const gid = g('port', `${kind}${i + 1}`);
    const p = W.add('IFCDISTRIBUTIONPORT', gid, oh, nameText || `${input ? 'IN' : 'OUT'} ${i + 1}`, null, null, null, null,
      enumv(input ? 'SINK' : 'SOURCE'), enumv('CABLE'), enumv('AUDIOVISUAL'));
    nested.push(p);
    pset('Pset_DistributionPortCommon', gid, [prop('PortNumber', int(i + 1))], p);
    pset('APK_Terminal', gid, [prop('TerminalId', ident(`${kind}${i + 1}`)), prop('Side', label(input ? 'input' : 'output'))], p);
  };
  (Array.isArray(b.inputs) ? b.inputs : []).forEach((n, i) => port('I', i, str(n)));
  (Array.isArray(b.outputs) ? b.outputs : []).forEach((n, i) => port('O', i, str(n)));
  if (nested.length) W.add('IFCRELNESTS', g('nests'), oh, null, null, frame, nested);
  W.add('IFCRELCONTAINEDINSPATIALSTRUCTURE', g('contains'), oh, null, null, [frame], storey);
  for (const { ps, owner, gid } of rels) W.add('IFCRELDEFINESBYPROPERTIES', gid, oh, null, null, [owner], ps);

  return writeStep({
    header: [
      { type: 'FILE_DESCRIPTION', args: [['ViewDefinition [ReferenceView]'], '2;1'] },
      { type: 'FILE_NAME', args: [`${stem}.ifc`, STAMP, ['APK.audio'], ['APK.audio'], 'APK.audio DSP mock-up editor', 'EDITORS.DSPmockUp', ''] },
      { type: 'FILE_SCHEMA', args: [[DSP_IFC_SCHEMA]] },
    ],
    entities: W.entities,
  });
}

/* ───────────────────────── reading it back ───────────────────────── */

const flat = (v) => (v && typeof v === 'object' && 'value' in v ? v.value : v);
const isEnum = (v, word) => !!v && typeof v === 'object' && v.kind === 'enum' && v.value === word;
const plain = (v) => {
  if (v == null) return null;
  if (Array.isArray(v)) return v.map(plain);
  if (typeof v !== 'object') return v;
  if (v.kind === 'typed') return plain(v.value);
  if (v.kind === 'real') return v.value;
  if (v.kind === 'enum') return v.value === 'T' ? true : v.value === 'F' ? false : v.value;
  return v;
};

/** The IfcPropertyTableValue rows of one set on an entity: table name → Map(defining → defined). */
function tablesOf(file, entity, setName) {
  const out = {};
  for (const rel of entitiesByType(file, 'IFCRELDEFINESBYPROPERTIES')) {
    if (!(rel.args[4] || []).some((x) => x && x.id === entity.id)) continue;
    const set = file.byId.get(rel.args[5]?.id);
    if (!set || set.args[2] !== setName) continue;
    for (const r of set.args[4] || []) {
      const p = file.byId.get(r.id);
      if (!p || p.type !== 'IFCPROPERTYTABLEVALUE') continue;
      const keys = plain(p.args[2]) || [];
      const vals = plain(p.args[3]) || [];
      out[p.args[0]] = new Map(keys.map((k, i) => [String(k), vals[i]]));
    }
  }
  return out;
}

/** An IFC model → the mock-up block (DspModel.toJSON shape). The frame is the first IfcAudioVisualAppliance
    whose ObjectType is DSP; throws a sentence when the file holds none. */
export function dspFromIfc(text) {
  const file = parseStep(String(text));
  const frames = entitiesByType(file, 'IFCAUDIOVISUALAPPLIANCE').filter((e) => str(e.args[4]).toUpperCase() === 'DSP');
  const frame = frames.find((e) => ports(file, e).length) || frames[0];
  if (!frame) throw new TypeError('no DSP mock-up in this IFC: it has no IfcAudioVisualAppliance with ObjectType DSP');
  const ps = (e) => getPsets(file, e);
  const chain = ps(frame).APK_DspChain || {};
  const tables = tablesOf(file, frame, 'APK_DspChain');
  const list = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]).map(flat);
  const ids = list(chain.StageIds).map(str);
  const types = list(chain.StageTypes).map(str);
  const labels = list(chain.StageLabels).map(str);
  const bypassed = list(chain.StageBypassed);
  const muted = list(chain.StageMuted);
  const stages = ids.map((id, i) => {
    const s = { id, type: types[i] || 'PEQ', label: labels[i] || '', bypassed: bypassed[i] === true };
    for (const [k, table, , , back] of PARAMS) {
      const row = tables[table];
      if (row && row.has(id)) s[k] = back(row.get(id));
    }
    s.mute = muted[i] === true;
    return s;
  });
  const all = ports(file, frame);
  const order = (p) => Number(flat(ps(p).Pset_DistributionPortCommon?.PortNumber)) || 0;
  const byDir = (dir) => all.filter((p) => isEnum(p.args[7], dir)).sort((a, z) => order(a) - order(z)).map((p) => str(p.args[2]));
  return {
    type: 'dspmockup',
    id: str(flat(chain.ModelId)) || str(frame.args[0]),
    name: str(frame.args[2]),
    deviceMnemonic: str(frame.args[7]),
    inputs: byDir('SINK'),
    outputs: byDir('SOURCE'),
    stages,
  };
}
