import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { isMain, projectRoot } from './validate-common.mjs';
import { withLocalBrowser } from './validate-browser-runtime.mjs';
import { validateLocalReferences } from './validate-local-references.mjs';

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
export { withLocalBrowser };

export async function runBrowserQA(config) {
  const { root = projectRoot, output, surfaces = ['root', 'slides', 'infographic', 'paper', 'microsite', 'examples'] } = config;
  if (!output) throw new Error('An explicit --output evidence directory is required.');
  if (!surfaces.length || surfaces.some(surface => !['root', 'slides', 'infographic', 'paper', 'microsite', 'examples'].includes(surface))) {
    throw new Error('Select at least one supported surface; unknown surfaces are not silently skipped.');
  }
  mkdirSync(output, { recursive: true });
  const report = {
    timestamp: new Date().toISOString(), scope: 'Local-only synthetic file:// browser QA; no live service validation',
    network: 'CDP offline emulation enabled; HTTP(S) subrequests blocked; navigator.onLine recorded separately', results: [], screenshots: [], errors: [],
  };
  try {
    await withLocalBrowser(config, async ({ send, evaluate, events, version }) => {
    report.browser = version;
    const renderedDocuments = new Map();
    const record = (id, passed, detail) => report.results.push({ id, passed: Boolean(passed), detail });
    const viewport = async (width, height = 1000) => {
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
      await evaluate(`new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
    };
    const goto = async relative => {
      const url = pathToFileURL(path.join(root, ...relative.split('/'))).href;
      const navigation = await send('Page.navigate', { url });
      if (navigation.errorText) throw new Error(`${relative}: ${navigation.errorText}`);
      for (let i = 0; i < 50; i++) {
        if (await evaluate(`location.href.startsWith(${JSON.stringify(url)}) && document.readyState === 'complete'`)) {
          await pause(150);
          return;
        }
        await pause(100);
      }
      throw new Error(`Local navigation did not finish: ${relative}`);
    };
    const key = async (name, modifiers = 0) => {
      const codes = { Tab: 9, Enter: 13, Escape: 27, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, Home: 36, End: 35, ' ': 32 };
      const params = { key: name, code: name === ' ' ? 'Space' : name, windowsVirtualKeyCode: codes[name], nativeVirtualKeyCode: codes[name], modifiers };
      const text = name === 'Enter' ? '\r' : name === ' ' ? ' ' : '';
      await send('Input.dispatchKeyEvent', { type: 'keyDown', ...params, ...(text ? { text, unmodifiedText: text } : {}) });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', ...params });
      await pause(100);
    };
    const screenshot = async name => {
      await evaluate(`new Promise(resolve => {
        let last = scrollY, stable = 0, frames = 0;
        const tick = () => {
          stable = Math.abs(scrollY - last) < 0.1 ? stable + 1 : 0;
          last = scrollY;
          if (stable >= 8 || ++frames >= 180) resolve();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      })`);
      const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      const file = path.join(output, `${name}.png`);
      writeFileSync(file, Buffer.from(result.data, 'base64'));
      report.screenshots.push(file);
    };
    const audit = async name => {
      const details = await evaluate(`(() => {
        const visible = el => !el.closest('[hidden]') && getComputedStyle(el).display !== 'none' && el.getClientRects().length;
        const controls = [...document.querySelectorAll('button,input,select,textarea')].filter(visible);
        const missingNames = controls.filter(el => !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby') &&
          ![...(el.labels || [])].some(label => label.textContent.trim()) && !el.textContent.trim() && !el.title).map(el => el.id || el.outerHTML.slice(0,120));
        const overflow = [...document.querySelectorAll('main,section,article,nav,table,pre,button,input,select,details')].filter(visible)
          .map(el => ({ tag: el.tagName, id: el.id, left: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right }))
          .filter(box => box.left < -2 || box.right > innerWidth + 2).slice(0,15);
        const ids = [...document.querySelectorAll('[id]')].map(el => el.id);
        const duplicateIds = [...new Set(ids.filter((id,index) => ids.indexOf(id) !== index))];
        return { width: innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth,
          missingNames, duplicateIds, overflow, online: navigator.onLine, controls: controls.length };
      })()`);
      record(`${name}-no-root-overflow`, details.scrollWidth <= details.clientWidth + 2, details);
      record(`${name}-control-names`, details.missingNames.length === 0, details.missingNames);
      record(`${name}-unique-rendered-ids`, details.duplicateIds.length === 0, details.duplicateIds);
    };
    const print = async name => {
      await send('Emulation.setEmulatedMedia', { media: 'print' });
      const result = await send('Page.printToPDF', { printBackground: true, preferCSSPageSize: true, displayHeaderFooter: false });
      const file = path.join(output, `${name}.pdf`);
      writeFileSync(file, Buffer.from(result.data, 'base64'));
      await send('Emulation.setEmulatedMedia', { media: 'screen' });
      return file;
    };
    await viewport(1440);
    if (surfaces.includes('root')) {
      await goto('index.html');
      await key('Tab');
      record('root-skip-link-keyboard', await evaluate(`document.activeElement.matches('.skip-link')`));
      await key('Tab');
      const focus = await evaluate(`({ id: document.activeElement.id, visible: document.activeElement.matches(':focus-visible'), outline: getComputedStyle(document.activeElement).outlineStyle })`);
      record('root-menu-keyboard-focus', focus.id === 'menu-toggle' && focus.visible && focus.outline !== 'none', focus);
      await key('Enter');
      const drawer = await evaluate(`({ open:document.querySelector('#site-menu').open, active:document.activeElement.id })`);
      record('root-drawer-enter-focus', drawer.open && drawer.active === 'menu-close', drawer);
      await key('Tab', 8);
      const wrapped = await evaluate(`document.querySelector('#site-menu').contains(document.activeElement)`);
      await key('Tab');
      record('root-drawer-keyboard-modal-loop', wrapped && await evaluate(`document.activeElement.id === 'menu-close'`));
      await key('Escape');
      record('root-drawer-escape-return', await evaluate(`!document.querySelector('#site-menu').open && document.activeElement.id === 'menu-toggle'`));
      const box = await evaluate(`(() => { const r = document.querySelector('#menu-toggle').getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...box, button: 'left', clickCount: 1 });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...box, button: 'left', clickCount: 1 });
      record('root-drawer-real-pointer', await evaluate(`document.querySelector('#site-menu').open`));
      await key('Escape');
      for (const width of [1440, 320]) {
        await viewport(width);
        await audit(`root-${width}`);
        await screenshot(`root-${width}`);
      }
      renderedDocuments.set('index.html', await evaluate('document.documentElement.outerHTML'));
    }
    if (surfaces.includes('slides')) {
      await viewport(1440);
      await goto('adaptive-trust-fabric-microsite/presentation.html');
      await key('ArrowRight');
      record('slides-arrow-focus-announcement', await evaluate(`!document.querySelector('#slide-2').hidden && document.activeElement.id === 'slide-2-title' && /Slide 2 of 12/.test(document.querySelector('#deck-status').textContent)`));
      await key('End');
      record('slides-end-key', await evaluate(`!document.querySelector('#slide-12').hidden`));
      await key('Home');
      record('slides-home-key', await evaluate(`!document.querySelector('#slide-1').hidden`));
      await evaluate(`document.querySelector('#slide-select').focus()`);
      await key('ArrowDown');
      record('slides-native-selector-not-double-advanced', await evaluate(`document.querySelector('#slide-select').value === '1'`));
      for (let slide = 1; slide <= 12; slide++) {
        await evaluate(`location.hash = '#slide-${slide}'`);
        await pause(100);
        await screenshot(`slide-${String(slide).padStart(2, '0')}`);
      }
      await send('Emulation.setEmulatedMedia', { media: 'print' });
      const visible = await evaluate(`[...document.querySelectorAll('.slide')].filter(el => getComputedStyle(el).display !== 'none').length`);
      record('slides-print-all-visible', visible === 12, { visible });
      const outlines = await evaluate(`[...document.querySelectorAll(':focus-visible')].filter(el => el.getClientRects().length && getComputedStyle(el).outlineStyle !== 'none' && parseFloat(getComputedStyle(el).outlineWidth) > 0).map(el => el.id)`);
      record('slides-print-no-focus-decoration', outlines.length === 0, outlines);
      await send('Emulation.setEmulatedMedia', { media: 'screen' });
      report.slidesPrint = await print('slides-print');
      await viewport(320);
      await evaluate(`location.hash = '#slide-8'`);
      await pause(100);
      await audit('slides-320');
      await screenshot('slides-320');
      renderedDocuments.set('adaptive-trust-fabric-microsite/presentation.html', await evaluate('document.documentElement.outerHTML'));
    }
    for (const [name, relative] of [
      ['infographic', 'adaptive-trust-fabric-infographic.html'],
      ['paper', 'position-paper/position-paper.html'],
      ['microsite', 'adaptive-trust-fabric-microsite/index.html'],
      ['examples', 'reference-validation/index.html'],
    ]) {
      if (!surfaces.includes(name)) continue;
      for (const width of [1440, 320]) {
        await viewport(width);
        await goto(relative);
        await audit(`${name}-${width}`);
        await screenshot(`${name}-${width}`);
      }
      if (name === 'infographic') report.infographicPrint = await print('infographic-print');
      if (name === 'microsite') {
        const counts = await evaluate(`({controls:document.querySelectorAll('#control-list .control-item').length,sources:document.querySelectorAll('#source-list .source').length})`);
        record('microsite-canonical-records-rendered', counts.controls === 26 && counts.sources === 33, counts);
        record('microsite-no-approval-defaults', await evaluate(`[...document.querySelectorAll('#assessment-form select')].every(el => el.value === 'unknown')`));
        const submit = async values => {
          if (values) {
            await evaluate(`(() => {
              const form = document.querySelector('#assessment-form');
              for (const select of form.querySelectorAll('select')) select.value = 'unknown';
              for (const [name,value] of Object.entries(${JSON.stringify(values)})) form.elements.namedItem(name).value = value;
              form.dispatchEvent(new Event('change', {bubbles:true}));
            })()`);
          }
          await evaluate(`document.querySelector('#assessment-form button[type="submit"]').focus()`);
          await key('Enter');
          return evaluate(`({state:document.querySelector('#assessment-result').dataset.state, topology:document.querySelector('#assessment-result').dataset.topology,
            active:document.activeElement.id, status:document.querySelector('#assessment-status').textContent,
            live:document.querySelector('#assessment-status').getAttribute('aria-live'),
            dimensions:document.querySelectorAll('#assessment-result [data-dimension]').length})`);
        };
        const unknown = await submit();
        record('microsite-keyboard-submit-unknown-focus-live', unknown.state === 'insufficient-evidence' &&
          unknown.active === 'assessment-result-title' && unknown.live === 'polite' && /Insufficient evidence/.test(unknown.status), unknown);
        const baseline = {
          boundary: 'delegated', sovereignty: 'residency', survivability: '0', ot: 'no', boundaryFit: 'met',
          recoveryRequirement: 'shared-acceptable', recoveryDependency: 'independent', privilegePath: 'contained',
          staffing: 'evidenced', monitoring: 'evidenced', response: 'evidenced', recoveryTest: 'evidenced',
        };
        const candidate = await submit(baseline);
        record('microsite-declared-candidate-not-approval', candidate.state === 'candidate' && candidate.topology === 'T1' &&
          candidate.dimensions === 5 && /not deployment approval/.test(candidate.status), candidate);
        await evaluate(`(() => {
          const select = document.querySelector('#assessment-form [name="recoveryDependency"]');
          select.value = 'circular'; select.dispatchEvent(new Event('change',{bubbles:true}));
        })()`);
        record('microsite-stale-input-announcement', await evaluate(`!document.querySelector('#assessment-stale').hidden && /Inputs changed/.test(document.querySelector('#assessment-status').textContent)`));
        const excluded = await submit({ ...baseline, recoveryDependency: 'circular' });
        record('microsite-known-conflict-excluded', excluded.state === 'excluded' && excluded.dimensions === 5, excluded);
        await audit('microsite-result-320');
        await screenshot('microsite-result-320');

        await evaluate(`document.querySelector('#source-search').focus()`);
        await send('Input.insertText', { text: 'no-source-matches-this-qa-fixture' });
        await pause(100);
        record('microsite-source-empty-live-count', await evaluate(`document.querySelectorAll('#source-list .source').length === 0 &&
          document.querySelector('#source-count').getAttribute('aria-live') === 'polite' && /0 of 33/.test(document.querySelector('#source-count').textContent)`));
        const sourceId = await evaluate(`(() => {
          const link = [...document.querySelectorAll('#assessment-result a[data-record-id^="source-"]')].find(el => el.getClientRects().length);
          if (!link) return null; link.focus(); return link.dataset.recordId;
        })()`);
        await key('Enter');
        const sourceNavigation = await evaluate(`({active:document.activeElement.id,search:document.querySelector('#source-search').value,
          count:document.querySelectorAll('#source-list .source').length})`);
        record('microsite-filtered-source-keyboard-deeplink', sourceId && sourceNavigation.active === sourceId &&
          sourceNavigation.search === '' && sourceNavigation.count === 33, sourceNavigation);
        if (sourceId) {
          await evaluate(`document.querySelector(${JSON.stringify(`#${sourceId} .source-review summary`)}).focus()`);
          await key('Enter');
          record('microsite-source-evidence-native-details', await evaluate(`document.querySelector(${JSON.stringify(`#${sourceId} .source-review`)}).open`));
        }

        const controlId = await evaluate(`(() => {
          const link = [...document.querySelectorAll('#assessment-result a[data-record-id^="control-"]')].find(el => el.getClientRects().length);
          if (!link) return null;
          const data = JSON.parse(document.querySelector('#research-data').textContent);
          const control = data.normativeControls.find(item => 'control-' + item.id === link.dataset.recordId);
          const filter = document.querySelector('#control-domain');
          filter.value = [...filter.options].find(option => option.value !== 'all' && option.value !== control.domain).value;
          filter.dispatchEvent(new Event('change',{bubbles:true}));
          link.focus(); return link.dataset.recordId;
        })()`);
        await key('Enter');
        const controlNavigation = await evaluate(`({active:document.activeElement.id,domain:document.querySelector('#control-domain').value,
          count:document.querySelectorAll('#control-list .control-item').length})`);
        record('microsite-filtered-control-keyboard-deeplink', controlId && controlNavigation.active === controlId &&
          controlNavigation.domain === 'all' && controlNavigation.count === 26, controlNavigation);
        if (controlId) {
          await evaluate(`document.querySelector(${JSON.stringify(`#${controlId} .control-guidance summary`)}).focus()`);
          await key('Enter');
          record('microsite-control-evidence-native-details', await evaluate(`document.querySelector(${JSON.stringify(`#${controlId} .control-guidance`)}).open`));
          await audit('microsite-control-guidance-320');
          await screenshot('microsite-control-guidance-320');
        }
        await evaluate(`document.querySelector('#tier-tab-S0').focus()`);
        await key('End');
        const endTab = await evaluate(`({active:document.activeElement.id,selected:[...document.querySelectorAll('[role="tab"][aria-selected="true"]')].map(el=>el.id),
          stops:document.querySelectorAll('[role="tab"][tabindex="0"]').length,label:document.querySelector('#tier-panel').getAttribute('aria-labelledby')})`);
        await key('ArrowRight');
        const wrappedTab = await evaluate(`document.activeElement.id === 'tier-tab-S0' && document.querySelector('#tier-tab-S0').getAttribute('aria-selected') === 'true'`);
        record('microsite-tier-keyboard-roving-tabs', endTab.active === 'tier-tab-S4' && endTab.selected.length === 1 &&
          endTab.selected[0] === 'tier-tab-S4' && endTab.stops === 1 && endTab.label === 'tier-tab-S4' && wrappedTab, endTab);
        await screenshot('microsite-tiers-320');
        const claimId = await evaluate(`(() => {
          const link = [...document.querySelectorAll('#assessment-result a[data-record-id^="claim-"]')].find(el=>el.getClientRects().length);
          if (!link) return null; link.focus(); return link.dataset.recordId;
        })()`);
        await key('Enter');
        record('microsite-claim-deeplink-focus-disclosure', claimId && await evaluate(`document.activeElement.id === ${JSON.stringify(claimId)} &&
          document.activeElement.closest('details').open`), { claimId });
        await evaluate(`document.querySelectorAll('.control-guidance,.source-review').forEach(el => {el.open=true;})`);
        for (const theme of ['light', 'dark']) {
          await evaluate(`document.documentElement.dataset.theme=${JSON.stringify(theme)}`);
          await audit(`microsite-expanded-320-${theme}`);
        }
      }
      if (name === 'examples') {
        const ids = await evaluate(`['case-E1','case-E2','case-E3','runbook-R1','runbook-R2','runbook-R3','runbook-R4','authorization','evidence'].filter(id => !document.getElementById(id))`);
        record('examples-offline-case-and-runbook-anchors', ids.length === 0, ids);
        for (const id of ['case-E3', 'runbook-R4']) {
          await evaluate(`document.querySelector(${JSON.stringify(`a[href="#${id}"]`)}).focus()`);
          await key('Enter');
          record(`examples-keyboard-${id}`, await evaluate(`location.hash === ${JSON.stringify(`#${id}`)}`));
          await screenshot(`examples-${id}-320`);
        }
        await evaluate(`document.querySelectorAll('details').forEach(el => {el.open=true;})`);
        for (const [width, theme] of [[320, 'light'], [320, 'dark'], [1440, 'light']]) {
          await viewport(width);
          await evaluate(`document.documentElement.dataset.theme=${JSON.stringify(theme)}`);
          await audit(`examples-expanded-${width}-${theme}`);
        }
        await viewport(320);
        await evaluate(`document.querySelector('#case-E3').scrollIntoView({block:'start',behavior:'instant'})`);
        await screenshot('examples-expanded-case-E3-320');
      }
      renderedDocuments.set(relative, await evaluate('document.documentElement.outerHTML'));
    }
    const references = validateLocalReferences(root, renderedDocuments);
    record('rendered-local-references', references.errors.length === 0, references);
    report.runtimeErrors = events.filter(event => event.method === 'Runtime.exceptionThrown').map(event => event.params.exceptionDetails);
    report.httpAttempts = events.filter(event => event.method === 'Network.requestWillBeSent' && /^https?:/.test(event.params.request.url)).map(event => event.params.request.url);
    const requests = new Map(events.filter(event => event.method === 'Network.requestWillBeSent').map(event => [event.params.requestId, event.params.request.url]));
    report.localResourceFailures = events.filter(event => event.method === 'Network.loadingFailed' &&
      !event.params.canceled && /^file:/.test(requests.get(event.params.requestId) ?? '')).map(event => ({
      url: requests.get(event.params.requestId), error: event.params.errorText,
    }));
    record('offline-no-http-subrequests', report.httpAttempts.length === 0, report.httpAttempts);
    record('offline-no-local-resource-failures', report.localResourceFailures.length === 0, report.localResourceFailures);
    record('no-browser-runtime-exceptions', report.runtimeErrors.length === 0, report.runtimeErrors);
    });
  } catch (error) {
    report.executionError = error.stack ?? error.message;
  }
  report.errors = [
    ...report.results.filter(result => !result.passed).map(result => result.id),
    ...(report.executionError ? [report.executionError] : []),
  ];
  report.passed = report.errors.length === 0;
  writeFileSync(path.join(output, 'browser-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

if (isMain(import.meta)) {
  try {
    const config = {};
    for (let i = 2; i < process.argv.length; i++) {
      const arg = process.argv[i];
      if (arg === '--help') {
        console.log('node tools\\validate-browser.mjs --profile <new-isolated-directory> --output <evidence-directory> [--browser <installed-executable>] [--root <project>] [--surfaces root,slides,infographic,paper,microsite,examples]');
        console.log('Uses only an owned headless browser, native CDP and Node built-ins; blocks HTTP(S), saves screenshots/print PDFs/JSON, closes browser and removes its profile.');
        process.exit(0);
      }
      if (!['--profile', '--output', '--browser', '--root', '--surfaces'].includes(arg) || !process.argv[i + 1]) throw new Error(`Unknown or incomplete option: ${arg}`);
      const value = process.argv[++i];
      config[arg.slice(2)] = arg === '--surfaces' ? value.split(',') : path.resolve(value);
    }
    const report = await runBrowserQA(config);
    console.log(`${report.passed ? 'PASS' : 'FAIL'} local browser QA: ${report.results.length} checks, ${report.errors.length} failures; ${path.join(config.output, 'browser-report.json')}`);
    for (const error of report.errors) console.error(error);
    process.exitCode = report.passed ? 0 : 1;
  } catch (error) {
    console.error(error.stack);
    process.exitCode = 1;
  }
}
