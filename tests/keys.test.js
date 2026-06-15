// No-framework test for the data-critical marker-key logic.
// Loads the REAL js/ source (config + storage + markers) in a shimmed sandbox
// and asserts the subtle bits: _baseKey identity, edit/move/delete application,
// embed dedup, and buildMarkerFiles stripping.  Run:  node tests/keys.test.js
//
// The app's files are classic scripts that share one global scope, so we
// concatenate them and run once (Node's per-script lexical scope won't share
// const/let across separate runs the way browsers do).

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const store = {};
const localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};

const sandbox = { console, localStorage, document: { querySelector: () => null } };
sandbox.window = sandbox;            // so window.X resolves to a global
vm.createContext(sandbox);

const TEST = `
  let __pass = 0, __fail = 0;
  function eq(name, got, want) {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    console.log((ok ? 'PASS  ' : 'FAIL  ') + name +
      (ok ? '' : '   got ' + JSON.stringify(got) + ' want ' + JSON.stringify(want)));
    ok ? __pass++ : __fail++;
  }

  // getMarkerKey: coordinates, and the _baseKey override that keeps a moved
  // marker's identity stable.
  eq('getMarkerKey from coords', getMarkerKey({category:'shrine', x:10, y:20}), 'shrine:10:20');
  eq('getMarkerKey prefers _baseKey', getMarkerKey({category:'shrine', x:99, y:99, _baseKey:'shrine:1:2'}), 'shrine:1:2');

  // Fake region data
  allMarkerData = { trosky: { region:'trosky', categories:[], markers:[
    { name:'A', category:'shrine', x:10, y:20 },
    { name:'B', category:'grave',  x:30, y:40 },
  ]}};
  discoveredMarkers = {};
  currentRegion = 'trosky';

  // A rename + move stored under the ORIGINAL key
  localStorage.setItem('kcd2_marker_edits', JSON.stringify({ trosky: { 'shrine:10:20': { name:'A2', x:11, y:21 } } }));
  const edited = getEditedMarkers('trosky');
  const a = edited.find(m => m._baseKey === 'shrine:10:20');
  eq('move applies new coords', [a.x, a.y], [11, 21]);
  eq('rename applies', a.name, 'A2');
  eq('identity stable after move', getMarkerKey(a), 'shrine:10:20');

  // Delete removes the marker
  localStorage.setItem('kcd2_marker_deletes', JSON.stringify({ trosky: ['grave:30:40'] }));
  eq('delete removes marker', getEditedMarkers('trosky').some(m => m._baseKey === 'grave:30:40'), false);
  localStorage.setItem('kcd2_marker_deletes', JSON.stringify({}));

  // userMarkerToDbMarker tags provenance
  const extra = userMarkerToDbMarker({ name:'C', category:'nest', x:5, y:6 });
  eq('userMarkerToDbMarker source=manual', extra.source, 'manual');

  // buildMarkerFiles strips the internal _baseKey and appends embedded extras
  const { out } = buildMarkerFiles('trosky', [extra]);
  eq('buildMarkerFiles strips _baseKey', out.markers.every(m => !('_baseKey' in m)), true);
  eq('buildMarkerFiles appends extra', out.markers.some(m => m.name === 'C' && m.category === 'nest'), true);

  // Embed dedup: a custom marker on an existing key is skipped
  const existing = new Set(getEditedMarkers('trosky').map(getMarkerKey));
  eq('dedup detects existing key', existing.has('shrine:10:20'), true);
  eq('dedup misses a fresh key', existing.has('nest:5:6'), false);

  window.__fail = __fail;
  console.log('\\n' + __pass + ' passed, ' + __fail + ' failed');
`;

const src = ["js/config.js", "js/storage.js", "js/markers.js"]
  .map((f) => fs.readFileSync(path.join(root, f), "utf8"))
  .join("\n");

vm.runInContext(src + "\n" + TEST, sandbox, { filename: "keys.test (bundle)" });
process.exit(sandbox.__fail ? 1 : 0);
