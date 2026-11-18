'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { test } = require('node:test');
const oracles = require('./assessment-oracles.json');

const configured = process.env.ATF_BROWSER && process.env.ATF_BROWSER_TEST_PROFILE_ROOT;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

test('offline rendered assessment, evidence navigation and keyboard regressions', {
  skip: configured ? false : 'Set ATF_BROWSER and ATF_BROWSER_TEST_PROFILE_ROOT to use an installed browser and a new session-only profile; nothing is downloaded.',
  timeout: 90000
}, async t => {
  const { withLocalBrowser } = await import('../tools/validate-browser-runtime.mjs');
  const profile = path.join(path.resolve(process.env.ATF_BROWSER_TEST_PROFILE_ROOT), `assessment-${process.pid}-${randomUUID()}`);
  const html = path.join(__dirname, '..', 'adaptive-trust-fabric-microsite', 'index.html');
  const fileUrl = pathToFileURL(html).href;
  await withLocalBrowser({ browser: process.env.ATF_BROWSER, profile }, async ({ send, evaluate, events }) => {
    async function load(url) {
      await send('Page.navigate', { url });
      for (let attempt = 0; attempt < 60; attempt++) {
        try {
          if (await evaluate(`document.readyState === 'complete' && location.href === ${JSON.stringify(url)} && !!window.ATFAssessment && !!document.querySelector('.control-item')`)) {
            await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
            return;
          }
        } catch (error) {
          if (!/context|navigat/i.test(error.message)) throw error;
        }
        await pause(100);
      }
      assert.fail('The offline page did not finish loading its local engine and records.');
    }
    async function key(name, number) {
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key: name, code: name, windowsVirtualKeyCode: number, ...(name === 'Enter' ? { text: '\r', unmodifiedText: '\r' } : {}) });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: name, code: name, windowsVirtualKeyCode: number });
    }

    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await load(`${fileUrl}?clawpilotTheme=light`);

    await t.test('unknown defaults produce insufficient evidence and focus an accessible result heading', async () => {
      const actual = await evaluate(`(() => {
        const form = document.getElementById('assessment-form');
        const unknownDefaults = [...form.querySelectorAll('select')].every(select => select.value === 'unknown');
        form.requestSubmit();
        const result = document.getElementById('assessment-result');
        return { unknownDefaults, state: result.dataset.state, topology: result.dataset.topology,
          focused: document.activeElement.id, liveStatus: document.getElementById('assessment-status').textContent,
          regionLabel: result.getAttribute('aria-labelledby'), hasBoundaryCheck: !!result.querySelector('[data-reason-code="boundary-fit-unknown"]') };
      })()`);
      assert.equal(actual.unknownDefaults, true);
      assert.equal(actual.state, 'insufficient-evidence');
      assert.equal(actual.topology, '');
      assert.equal(actual.focused, 'assessment-result-title');
      assert.equal(actual.regionLabel, actual.focused);
      assert.equal(actual.hasBoundaryCheck, true);
      assert.match(actual.liveStatus, /not deployment approval/);
    });

    await t.test('every independent decision oracle is reflected in the submitted form and rendered reasons', async () => {
      const results = await evaluate(`(() => {
        const corpus = ${JSON.stringify(oracles)};
        const form = document.getElementById('assessment-form');
        return corpus.cases.map(oracle => {
          form.reset();
          for (const [field, value] of Object.entries({ ...corpus.baseline, ...oracle.input })) form.elements.namedItem(field).value = value;
          form.dispatchEvent(new Event('change', { bubbles: true }));
          form.requestSubmit();
          const result = document.getElementById('assessment-result');
          const rejected = [...result.querySelectorAll('details')].find(details => details.querySelector('summary').textContent.startsWith('Rejected configurations'));
          return { name: oracle.name, state: result.dataset.state, topology: result.dataset.topology,
            missingReasons: oracle.expected.reasonCodes.filter(code => !result.querySelector('[data-reason-code="' + code + '"]')),
            missingRejections: (oracle.expected.rejected || []).filter(id => ![...rejected.querySelectorAll('li')].some(item => item.textContent.startsWith(id + ' ·'))),
            connectivityText: result.querySelector('[data-dimension="connectivity"] dd').textContent,
            undefinedRendered: result.textContent.includes('undefined'),
            dimensions: result.querySelectorAll('[data-dimension]').length };
        });
      })()`);
      assert.equal(results.length, oracles.cases.length);
      for (const [index, actual] of results.entries()) {
        const expected = oracles.cases[index].expected;
        assert.equal(actual.state, expected.state, actual.name);
        if ('topology' in expected) assert.equal(actual.topology, expected.topology, actual.name);
        if ('connectivity' in expected) assert.ok(actual.connectivityText.includes(expected.connectivity), actual.name);
        if ('pattern' in expected) assert.equal(actual.connectivityText.includes('T4 operating overlay'), expected.pattern === 'T4', actual.name);
        assert.deepEqual(actual.missingReasons, [], actual.name);
        assert.deepEqual(actual.missingRejections, [], actual.name);
        assert.equal(actual.undefinedRendered, false, actual.name);
        assert.equal(actual.dimensions, 5, actual.name);
      }
    });

    await t.test('editing declarations explicitly marks the previous result stale', async () => {
      const actual = await evaluate(`(() => {
        const form = document.getElementById('assessment-form');
        form.elements.namedItem('maturity').value = 'managed';
        form.dispatchEvent(new Event('change', { bubbles: true }));
        return { staleVisible: !document.getElementById('assessment-stale').hidden,
          status: document.getElementById('assessment-status').textContent };
      })()`);
      assert.equal(actual.staleVisible, true);
      assert.match(actual.status, /previous; evaluate again/);
    });

    await t.test('all controls and sources retain readable guidance, including legacy evidence qualifications', async () => {
      const actual = await evaluate(`(() => {
        const data = JSON.parse(document.getElementById('research-data').textContent);
        const missing = [];
        for (const control of data.normativeControls) {
          const node = document.getElementById('control-' + control.id);
          if (!node?.querySelector('.control-guidance > summary')) { missing.push(control.id + ': guidance'); continue; }
          for (const text of [control.accountable_role, control.failure_behavior, control.verification?.method, ...(control.verification?.pass || []), ...(control.verification?.fail || [])].filter(Boolean)) {
            if (!node.textContent.includes(text)) missing.push(control.id + ': omitted verification or ownership');
          }
          if (!control.evidence && !node.textContent.includes('No operational validation is established')) missing.push(control.id + ': missing legacy qualification');
        }
        for (const source of data.sources) {
          const node = document.getElementById('source-' + source.id);
          if (!node?.querySelector('.source-review > summary')) { missing.push(source.id + ': review'); continue; }
          for (const text of [source.provenance, source.evidence?.status, ...(source.evidence?.limitations || [])].filter(Boolean)) {
            if (!node.textContent.includes(text)) missing.push(source.id + ': omitted review qualification');
          }
        }
        return { controls: document.querySelectorAll('.control-item').length, sources: document.querySelectorAll('#source-list .source').length, missing };
      })()`);
      assert.equal(actual.controls, 26);
      assert.equal(actual.sources, 33);
      assert.deepEqual(actual.missing, []);
      await evaluate(`document.querySelector('#control-N-26 .control-guidance > summary').focus()`);
      await key('Enter', 13);
      assert.equal(await evaluate(`document.querySelector('#control-N-26 .control-guidance').open`), true);
    });

    await t.test('deep links recover filtered records, focus destinations and open claim context', async () => {
      const actual = await evaluate(`(() => {
        const search = document.getElementById('source-search');
        search.value = 'no-such-source-for-offline-regression';
        search.dispatchEvent(new Event('input', { bubbles: true }));
        const emptySources = document.querySelectorAll('#source-list .source').length;
        document.querySelector('#topology-grid [data-record-id="source-MS-02"]').click();
        const source = { emptySources, count: document.querySelectorAll('#source-list .source').length, search: search.value, focused: document.activeElement.id };
        const domain = document.getElementById('control-domain');
        const level = document.getElementById('control-level');
        domain.value = 'Topology'; level.value = 'MAY';
        domain.dispatchEvent(new Event('change', { bubbles: true }));
        const emptyControls = document.querySelectorAll('.control-item').length;
        document.querySelector('#assessment-result [data-record-id="control-N-26"]').click();
        const control = { emptyControls, count: document.querySelectorAll('.control-item').length, focused: document.activeElement.id, domain: domain.value, level: level.value };
        document.querySelector('#assessment-result [data-record-id="claim-C-07"]').click();
        const claim = { focused: document.activeElement.id, open: document.querySelector('.claim-context').open };
        return { source, control, claim };
      })()`);
      assert.deepEqual(actual.source, { emptySources: 0, count: 33, search: '', focused: 'source-MS-02' });
      assert.deepEqual(actual.control, { emptyControls: 0, count: 26, focused: 'control-N-26', domain: 'all', level: 'all' });
      assert.deepEqual(actual.claim, { focused: 'claim-C-07', open: true });
    });

    await t.test('survivability tabs support wrap, Home and End with exactly one tab stop', async () => {
      await evaluate(`document.getElementById('tier-tab-S0').focus()`);
      for (const [name, number, expected] of [['ArrowLeft', 37, 'S4'], ['Home', 36, 'S0'], ['End', 35, 'S4'], ['ArrowRight', 39, 'S0']]) {
        await key(name, number);
        const actual = await evaluate(`(() => ({ active: document.activeElement.id,
          selected: [...document.querySelectorAll('[role="tab"][aria-selected="true"]')].map(tab => tab.id),
          tabStops: [...document.querySelectorAll('[role="tab"]')].filter(tab => tab.tabIndex === 0).length,
          panel: document.getElementById('tier-panel').getAttribute('aria-labelledby') }))()`);
        assert.equal(actual.active, `tier-tab-${expected}`);
        assert.deepEqual(actual.selected, [actual.active]);
        assert.equal(actual.tabStops, 1);
        assert.equal(actual.panel, actual.active);
      }
    });

    await t.test('light and dark small viewports remain offline, legible and without horizontal overflow', async () => {
      for (const [theme, width] of [['light', 390], ['dark', 320]]) {
        await send('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: false });
        await load(`${fileUrl}?clawpilotTheme=${theme}#control-N-03`);
        const actual = await evaluate(`(() => {
          const directLinkFocus = document.activeElement.id;
          const form = document.getElementById('assessment-form');
          form.reset();
          form.dispatchEvent(new Event('change', { bubbles: true }));
          form.requestSubmit();
          return { theme: document.documentElement.dataset.theme, width: innerWidth,
            overflow: document.documentElement.scrollWidth > innerWidth, directLinkFocus,
            result: document.getElementById('assessment-result').dataset.state,
            hiddenFieldsDisabled: [...document.querySelectorAll('[data-condition][hidden] select')].every(select => select.disabled),
            secondary: getComputedStyle(document.querySelector('.form-note')).color,
            overflowNodes: [...document.querySelectorAll('main, main *')].filter(node => node.getBoundingClientRect().right > innerWidth + 1).slice(0, 10).map(node => ({ tag: node.tagName, id: node.id, class: node.className, right: node.getBoundingClientRect().right, width: node.getBoundingClientRect().width })) };
        })()`);
        assert.equal(actual.theme, theme);
        assert.equal(actual.width, width);
        assert.equal(actual.overflow, false, JSON.stringify(actual));
        assert.equal(actual.directLinkFocus, 'control-N-03');
        assert.equal(actual.result, 'insufficient-evidence');
        assert.equal(actual.hiddenFieldsDisabled, true);
        if (theme === 'dark') assert.equal(actual.secondary, 'rgb(176, 176, 176)');
      }
    });

    assert.deepEqual(events.filter(event => event.method === 'Runtime.exceptionThrown').map(event => event.params.exceptionDetails.text), [], 'No uncaught application exception');
    assert.deepEqual(events.filter(event => event.method === 'Network.requestWillBeSent' && /^https?:/i.test(event.params.request.url)).map(event => event.params.request.url), [], 'The reference must not request an external dependency');
  });
  assert.equal(fs.existsSync(profile), false, 'The owned browser profile must be removed after validation.');
});
