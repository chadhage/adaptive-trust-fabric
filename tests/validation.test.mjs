import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { researchFixture } from './fixtures/research-fixture.mjs';
import { validateResearchData } from '../tools/validate-research.mjs';
import { validateContentData } from '../tools/validate-content.mjs';
import { validateReferenceMap } from '../tools/validate-local-references.mjs';
import { canonicalBytes, validateManifestEntries } from '../tools/validate-manifest.mjs';
import { validateWorkflowText } from '../tools/validate-workflows.mjs';
import { validatePublicationReceipt } from '../tools/validate-publication.mjs';

test('research validator accepts a complete explicitly unverified evidence fixture', () => {
  assert.deepEqual(validateResearchData(researchFixture()).errors, []);
});

test('a broader bibliography does not falsely imply that every context source is a selected passage', () => {
  const data = researchFixture();
  data.claims[0].sources.push('MS-02');
  assert.deepEqual(validateResearchData(data).errors, []);
});

for (const [name, mutate, expected] of [
  ['missing control acceptance criteria', data => { delete data.normativeControls[0].verification.fail; }, /verification.fail/],
  ['duplicate control IDs', data => { data.normativeControls[1].id = 'N-01'; }, /duplicate id N-01/],
  ['unsupported normative level', data => { data.normativeControls[0].level = 'REQUIRED'; }, /unsupported level/],
  ['dangling source reference', data => { data.claims[0].sources = ['MS-99']; }, /unknown source MS-99/],
  ['locator outside the record bibliography', data => { data.claims[0].evidence.source_refs[0].source_id = 'MS-02'; }, /outside the record bibliography/],
  ['absent selected support', data => { data.claims[0].evidence.source_refs = []; }, /source_refs must be nonempty/],
  ['invalid selected support URL', data => { data.claims[0].evidence.source_refs[0].url = 'not-a-url'; }, /must be an absolute HTTPS URL/],
  ['known URL assigned to the wrong catalog ID', data => {
    data.sources[1].url = 'https://example.org/a-different-source';
    data.sources[1].evidence.source_refs[0].url = data.sources[1].url;
    data.claims[0].evidence.source_refs[0].url = data.sources[1].url;
  }, /url belongs to a different catalog source/],
  ['malformed documentary evidence', data => { data.claims[0].evidence.source_refs[0].verification = 'HTTP-200'; }, /verification is unsupported/],
  ['unjustified live assurance', data => { data.normativeControls[0].evidence.operational_validation = 'passed'; }, /must not imply operational validation/],
  ['missing evidence review date', data => { data.claims[0].evidence.status = 'source-verified'; }, /requires a review date/],
  ['invalid calendar date', data => { data.sources[0].accessed = '2026-02-31'; }, /accessed must be an ISO date/],
]) {
  test(`research validator rejects ${name}`, () => {
    const data = researchFixture();
    mutate(data);
    assert.match(validateResearchData(data).errors.join('\n'), expected);
  });
}

function escaped(value) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function contentFixture(data = researchFixture()) {
  const microsite = `<script id="research-data" type="application/json">${JSON.stringify(data)}</script>`;
  const paper = `<table>${data.normativeControls.map(control =>
    `<tr id="control-${control.id}" data-control-id="${control.id}">` +
    ['level', 'domain', 'text', 'provenance'].map(field => `<td data-field="${field}">${escaped(control[field])}</td>`).join('') +
    `<td>${control.sources.map(source => `[${source}]`).join(' ')}</td></tr>`).join('')}</table>`;
  return { data, microsite, paper };
}

test('semantic synchronization accepts escaped text but catches a one-control meaning change', () => {
  const { data, microsite, paper } = contentFixture();
  assert.deepEqual(validateContentData(data, microsite, paper).errors, []);
  const changed = paper.replace('Document identity &amp; recovery dependencies for control 15.',
    'Assume identity and recovery are independent.');
  assert.match(validateContentData(data, microsite, changed).errors.join('\n'), /N-15.text/);
});

test('synchronization catches changed source attribution despite matching control count', () => {
  const { data, microsite, paper } = contentFixture();
  assert.match(validateContentData(data, microsite, paper.replace('[MS-01]', '[MS-02]')).errors.join('\n'), /N-01 source references/);
  const altered = structuredClone(data);
  altered.normativeControls[0].text = 'Changed embedded recommendation.';
  assert.match(validateContentData(data, `<script type="application/json" id="research-data">${JSON.stringify(altered)}</script>`, paper).errors.join('\n'), /differs semantically/);
});

test('synchronization rejects omitted controls and malformed embedded JSON', () => {
  const { data, paper } = contentFixture();
  assert.match(validateContentData(data, '<script id="research-data" type="application/json">{</script>', paper).errors.join('\n'), /cannot be parsed/);
  assert.match(validateContentData(data, contentFixture().microsite, paper.replace(/<tr[^>]*>[\s\S]*?<\/tr>/, '')).errors.join('\n'), /missing canonical control N-01/);
});

test('local references respect project subpaths, queries, percent encoding and cross-document fragments', () => {
  const files = new Map([
    ['index.html', '<a href="docs/paper.html?view=print#control-N-01">Read</a><a href="https://example.org/#remote">Online</a><img src="assets/a%20b.svg">'],
    ['docs/paper.html', '<h1 id="control-N-01">Control</h1><a href="../index.html">Home</a>'],
    ['assets/a b.svg', '<svg/>'],
  ]);
  assert.deepEqual(validateReferenceMap(files).errors, []);
});

test('local reference checks detect broken files, anchors, duplicate IDs and root-relative Pages errors', () => {
  const files = new Map([
    ['index.html', '<p id="a">One</p><p id="a">Two</p><a href="#missing">Jump</a><script src="missing.js"></script><a href="/docs/a.html">Wrong project path</a>'],
  ]);
  const errors = validateReferenceMap(files).errors.join('\n');
  for (const expected of [/duplicate.*"a"/, /missing fragment/, /missing local target/, /nonportable/]) assert.match(errors, expected);
});

test('HTML comments, script text and external data URLs do not become false local references', () => {
  const files = new Map([
    ['index.html', '<!-- <a href="absent.html">ignored</a> --><script>const text = \'<a id="ghost" href="absent.html">\';</script><img src="data:image/png;base64,AA==">'],
  ]);
  assert.deepEqual(validateReferenceMap(files).errors, []);
});

test('accessible relationships and CSS resources are checked without network access', () => {
  const files = new Map([
    ['index.html', '<label for="missing">Input</label><button aria-controls="absent">Open</button><link href="assets/site.css" rel="stylesheet">'],
    ['assets/site.css', 'body { background: url("../missing.svg") }'],
  ]);
  const errors = validateReferenceMap(files).errors.join('\n');
  assert.match(errors, /missing accessible relationship target #missing/);
  assert.match(errors, /missing accessible relationship target #absent/);
  assert.match(errors, /missing local target.*missing.svg/);
});

test('repository Markdown directory links do not mask broken browser directory navigation', () => {
  const files = new Map([
    ['README.md', '[Paper sources](./paper/)'],
    ['index.html', '<a href="paper/">Open paper</a>'],
    ['paper/document.html', '<h1>Paper</h1>'],
  ]);
  const errors = validateReferenceMap(files).errors;
  assert.equal(errors.length, 1);
  assert.match(errors[0], /^index.html: missing local target/);
});

test('declared dynamic research anchors resolve only IDs present in the embedded data', () => {
  const files = new Map([
    ['index.html', '<a href="microsite/index.html#source-MS-01">Source</a><a href="microsite/index.html#source-MS-99">Broken</a>'],
    ['microsite/index.html', '<script id="research-data" type="application/json">{"sources":[{"id":"MS-01"}]}</script><script src="assets/app.js"></script>'],
    ['microsite/assets/app.js', ''],
  ]);
  const result = validateReferenceMap(files);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /missing fragment.*source-MS-99/);
});

test('SVG symbol fragment errors are not hidden by existence of the asset file', () => {
  const files = new Map([
    ['index.html', '<svg><use href="icons.svg#valid"></use><use href="icons.svg#absent"></use></svg>'],
    ['icons.svg', '<svg><symbol id="valid"></symbol></svg>'],
  ]);
  const errors = validateReferenceMap(files).errors;
  assert.equal(errors.length, 1);
  assert.match(errors[0], /missing fragment.*icons.svg#absent/);
});

function manifestFixture(relative, bytes) {
  const canonical = canonicalBytes(relative, bytes);
  return {
    package: 'Fixture', version: 'test', research_cutoff: '2026-11-17',
    files: [{ path: relative, bytes: canonical.length, sha256: createHash('sha256').update(canonical).digest('hex') }],
  };
}
test('manifest accepts LF and CRLF text only, and detects real changed content', () => {
  const manifest = manifestFixture('index.html', Buffer.from('<p>Text</p>\n'));
  assert.deepEqual(validateManifestEntries(manifest, () => Buffer.from('<p>Text</p>\r\n')).errors, []);
  assert.match(validateManifestEntries(manifest, () => Buffer.from('<p>Edit</p>\n')).errors.join('\n'), /SHA-256 mismatch/);
  assert.match(validateManifestEntries(manifest, () => Buffer.from('<p>Text</p>')).errors.join('\n'), /SHA-256 mismatch/);
});

test('manifest treats PDFs as exact binary and rejects traversal or duplicate entries', () => {
  const bytes = Buffer.from('%PDF\r\nbinary');
  const manifest = manifestFixture('docs/paper.pdf', bytes);
  assert.match(validateManifestEntries(manifest, () => Buffer.from('%PDF\nbinary')).errors.join('\n'), /SHA-256 mismatch/);
  manifest.files.push({ ...manifest.files[0] }, { ...manifest.files[0], path: '../outside.html' });
  const errors = validateManifestEntries(manifest, () => bytes).errors.join('\n');
  assert.match(errors, /duplicate manifest path/);
  assert.match(errors, /invalid.*manifest path/);
});

test('invalid UTF-8 is rejected instead of replacement-character hash normalization', () => {
  const manifest = manifestFixture('index.html', Buffer.from('Valid UTF-8\n'));
  assert.match(validateManifestEntries(manifest, () => Buffer.from([0xc3, 0x28])).errors.join('\n'), /must be valid UTF-8/);
});

test('PR workflow has no deploy privilege and Pages cannot skip the same validation gate', () => {
  const validation = readFileSync(new URL('../.github/workflows/validate.yml', import.meta.url), 'utf8');
  const pages = readFileSync(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8');
  assert.deepEqual(validateWorkflowText(validation, pages).errors, []);
  assert.match(validateWorkflowText(validation.replace('contents: read', 'contents: write'), pages).errors.join('\n'), /write permission/);
  assert.match(validateWorkflowText(validation, pages.replace('needs: validate', 'needs: unrelated')).errors.join('\n'), /build must depend on validation/);
  assert.match(validateWorkflowText(validation, pages.replace('needs: build', 'needs: unrelated')).errors.join('\n'), /deploy must depend on the validated build/);
});

test('a representative invalid fixture propagates a failing process exit for CI', () => {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import { validateResearchData } from './tools/validate-research.mjs';
    import { printResult } from './tools/validate-common.mjs';
    import { researchFixture } from './tests/fixtures/research-fixture.mjs';
    const data = researchFixture();
    data.normativeControls[0].sources = ['MS-99'];
    printResult(validateResearchData(data));
  `], { cwd: new URL('../', import.meta.url), encoding: 'utf8' });
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /unknown source MS-99/);
});

test('a PDF build receipt detects stale source or binary even when a manifest is refreshed', () => {
  const inputs = [
    'position-paper/position-paper.html', 'position-paper/paper.css',
    'adaptive-trust-fabric-microsite/data/research.json', 'tools/build-paper.mjs',
    'tools/build-paper.py', 'tools/validate-browser-runtime.mjs',
  ];
  const pdf = 'position-paper/Adaptive-Trust-Fabric-Position-Paper.pdf';
  const files = new Map([...inputs.map(file => [file, Buffer.from('Original source\n')]), [pdf, Buffer.from('%PDF\r\noriginal')]]);
  const hash = relative => {
    const bytes = relative === pdf ? files.get(relative) : canonicalBytes(relative, files.get(relative));
    return { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  };
  const receipt = { inputs: Object.fromEntries(inputs.map(file => [file, hash(file)])), output: hash(pdf) };
  assert.deepEqual(validatePublicationReceipt(receipt, relative => files.get(relative)).errors, []);
  files.set('position-paper/paper.css', Buffer.from('Changed print layout\n'));
  assert.match(validatePublicationReceipt(receipt, relative => files.get(relative)).errors.join('\n'), /paper.css: stale PDF build receipt/);
  files.set(pdf, Buffer.from('%PDF\r\ndifferent'));
  assert.match(validatePublicationReceipt(receipt, relative => files.get(relative)).errors.join('\n'), /Position-Paper.pdf: stale PDF build receipt/);
});
