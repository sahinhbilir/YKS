'use strict';

// Run the actual inline Firebase module with SDK substitutes and no network access.
// Usage: node --experimental-vm-modules test/firebase-analytics-regression.cjs
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');

const html = readFileSync('index.html', 'utf8');
const source = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
const production = 'https://ykstekrar.com/';
const flush = () => new Promise(resolve => setImmediate(resolve));

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

async function load({ url = production, missingLocation = false, supported = true,
  importError = false, supportError = false, initError = false, importGate, supportGate } = {}) {
  const apps = [], order = [], warnings = [], analyticsApps = [], imports = [], events = [];
  const primaryAuth = { currentUser: null, authStateReady: async () => {} };
  const secondaryAuth = { currentUser: null, authStateReady: async () => {} };
  const db = {};
  let notifications = 0, supportChecks = 0;
  const window = { bulutDegisti() { notifications++; } };
  const context = vm.createContext({
    window, URLSearchParams, setTimeout, clearTimeout,
    console: { warn: (...args) => warnings.push(args) },
    ...(!missingLocation ? { location: new URL(url) } : {})
  });
  const noop = () => {};
  const sdks = {
    'firebase-app.js': {
      initializeApp(config, name = '[DEFAULT]') {
        const app = { config, name };
        apps.push(app); order.push('app'); return app;
      }
    },
    'firebase-app-check.js': {
      initializeAppCheck(app) { assert.equal(app, apps[0]); order.push('app-check'); },
      ReCaptchaEnterpriseProvider: class {}
    },
    'firebase-auth.js': {
      getAuth(app) { order.push('auth'); return app === apps[0] ? primaryAuth : secondaryAuth; },
      signOut: noop, signInAnonymously: noop, signInWithPopup: noop,
      signInWithEmailAndPassword: noop, createUserWithEmailAndPassword: noop,
      GoogleAuthProvider: class {}, onAuthStateChanged: noop
    },
    'firebase-firestore.js': {
      getFirestore(app) { assert.equal(app, apps[0]); order.push('firestore'); return db; },
      doc: noop, getDoc: noop, getDocFromServer: noop, setDoc: noop, updateDoc: noop,
      runTransaction: noop, collection: noop, getDocs: noop, onSnapshot: noop
    },
    'firebase-analytics.js': {
      logEvent(analytics, name, params) { events.push({name, params:JSON.parse(JSON.stringify(params))}); },
      async isSupported() {
        supportChecks++;
        if (supportGate) await supportGate.promise;
        if (supportError) throw Error('support check rejected');
        return supported;
      },
      getAnalytics(app) {
        if (initError) throw Error('initialization rejected');
        analyticsApps.push(app);
      }
    }
  };
  function sdkModule(specifier) {
    assert.match(specifier, /^https:\/\/www\.gstatic\.com\/firebasejs\/12\.18\.0\//);
    const exports = sdks[specifier.split('/').pop()];
    assert.ok(exports, 'Unexpected SDK import: ' + specifier);
    return new vm.SyntheticModule(Object.keys(exports), function () {
      for (const [name, value] of Object.entries(exports)) this.setExport(name, value);
    }, { context });
  }
  const module = new vm.SourceTextModule(source, {
    context, identifier: 'index.html:firebase',
    async importModuleDynamically(specifier) {
      assert.ok(window.bulut?.yapilandirilmis, 'Cloud must be ready before Analytics loads');
      imports.push(specifier);
      if (importGate) await importGate.promise;
      if (importError) throw Error('download blocked');
      const sdk = sdkModule(specifier);
      await sdk.link(() => { throw Error('Unexpected nested SDK import'); });
      await sdk.evaluate();
      return sdk;
    }
  });
  await module.link(sdkModule);
  await module.evaluate();
  await flush();

  function assertCloudReady() {
    assert.equal(apps.length, 2, 'Analytics must reuse the primary Firebase app');
    assert.deepEqual(apps.map(app => app.name), ['[DEFAULT]', 'ogrenci-hesaplari']);
    assert.equal(apps[0].config.measurementId, 'G-NPVTE6VQTZ');
    assert.deepEqual(order, ['app', 'app-check', 'auth', 'firestore', 'app', 'auth']);
    assert.equal(window.bulut.db, db);
    assert.equal(window.bulut.yapilandirilmis, true);
    assert.equal(typeof window.bulut.girisOgretmen, 'function');
    assert.equal(typeof window.bulut.girisOgrenci, 'function');
    assert.equal(notifications, 1);
  }
  assertCloudReady();
  return { apps, imports, analyticsApps, warnings, window, events, assertCloudReady, supportChecks: () => supportChecks };
}

const safeParams = {student_key:'d70ec14d-ab10-43e5-b63f-0dd990c3626b',report_week:'2026-09-21',plan_week:'2026-09-28',action_ts:1790352000000};
test('early events queue once and strip all student identity fields except opaque UUID', async () => {
  const importGate=deferred(), state=await load({importGate});
  state.window.yksAnalitik('student_pdf_requested',{...safeParams,name:'Private Name',email:'private@example.test',school_number:42});
  assert.equal(state.events.length,0); importGate.resolve(); await flush(); await flush();
  assert.deepEqual(state.events,[{name:'student_pdf_requested',params:safeParams}]);
  state.window.yksAnalitik('student_results_opened',safeParams);
  state.window.yksAnalitik('student_results_saved',safeParams);
  assert.equal(state.events.length,3); assert.equal(state.imports.length,1);
});
test('unexpected events and unsafe identifiers never enter Analytics',async()=>{
  const state=await load();
  state.window.yksAnalitik('student_results_opened',{...safeParams,student_key:'Name <email@example.test>'});
  state.window.yksAnalitik('teacher_results_saved',safeParams);
  state.window.yksAnalitik('student_results_saved',{...safeParams,report_week:'Class 11 A'});
  assert.equal(state.events.length,0);
});
test('activity week is separate from the result and plan weeks and stays anonymous',async()=>{
 const state=await load();
 state.window.yksAnalitik('student_pdf_requested',{...safeParams,activity_week:'2026-10-05',name:'Private Name'});
 assert.deepEqual(state.events[0].params,{...safeParams,activity_week:'2026-10-05'});
 state.window.yksAnalitik('student_results_saved',{...safeParams,activity_week:'Private Name'});
 assert.deepEqual(state.events[1].params,safeParams);
});
test('debug flag is explicit; dev and offline clients cannot emit these events',async()=>{
  const normal=await load(), debug=await load({url:production+'?analytics_debug=1'});
  normal.window.yksAnalitik('student_results_opened',safeParams);
  debug.window.yksAnalitik('student_results_opened',safeParams);
  assert.equal(normal.events[0].params.debug_mode,undefined);
  assert.equal(debug.events[0].params.debug_mode,true);
  for(const url of [production+'?dev=1','file:///student.html']){
    const state=await load({url});assert.equal(state.window.yksAnalitik,undefined);assert.equal(state.events.length,0);
  }
});
test('blocked Analytics drops its queue while cloud remains usable',async()=>{
  const importGate=deferred(),state=await load({importGate,importError:true});
  state.window.yksAnalitik('student_results_saved',safeParams);importGate.resolve();await flush();await flush();
  state.window.yksAnalitik('student_results_saved',safeParams);
  assert.equal(state.events.length,0);state.assertCloudReady();
});

for (const [name, url] of [
  ['production root', production],
  ['production www', 'https://www.ykstekrar.com/'],
  ['production with dev disabled', production + '?dev=0']
]) test(name + ' initializes Analytics once on the primary app', async () => {
  const state = await load({ url });
  assert.equal(state.imports.length, 1);
  assert.deepEqual(state.analyticsApps, [state.apps[0]]);
  assert.equal(state.supportChecks(), 1);
  assert.equal(state.warnings.length, 0);
});

for (const [name, options] of [
  ['Node without location', { missingLocation: true }],
  ['localhost', { url: 'http://localhost:3000/' }],
  ['HTTPS localhost', { url: 'https://localhost/' }],
  ['offline student export', { url: 'file:///student.html' }],
  ['HTTP production', { url: 'http://ykstekrar.com/' }],
  ['preview host', { url: 'https://preview.example.test/' }],
  ['similar untrusted host', { url: 'https://ykstekrar.com.example.test/' }],
  ['production dev mode', { url: production + '?other=1&dev=1' }],
  ['www dev mode', { url: 'https://www.ykstekrar.com/?dev=1' }]
]) test(name + ' never imports Analytics', async () => {
  const state = await load(options);
  assert.equal(state.imports.length, 0);
  assert.equal(state.supportChecks(), 0);
  assert.equal(state.analyticsApps.length, 0);
  assert.equal(state.warnings.length, 0);
});

test('unsupported browser leaves cloud ready without initializing Analytics', async () => {
  const state = await load({ supported: false });
  assert.equal(state.supportChecks(), 1);
  assert.equal(state.analyticsApps.length, 0);
  assert.equal(state.warnings.length, 0);
});

for (const failure of ['importError', 'supportError', 'initError']) {
  test(failure + ' is isolated from Auth and Firestore', async () => {
    const state = await load({ [failure]: true });
    assert.equal(state.imports.length, 1);
    assert.equal(state.analyticsApps.length, 0);
    assert.equal(state.warnings.length, 1);
    state.assertCloudReady();
  });
}

for (const pending of ['importGate', 'supportGate']) {
  test(pending + ' does not delay cloud readiness and completes once', async () => {
    const gate = deferred();
    const state = await load({ [pending]: gate });
    assert.equal(state.imports.length, 1);
    assert.equal(state.analyticsApps.length, 0);
    state.assertCloudReady();
    gate.resolve();
    await flush();
    assert.deepEqual(state.analyticsApps, [state.apps[0]]);
    assert.equal(state.warnings.length, 0);
    state.assertCloudReady();
  });
}
