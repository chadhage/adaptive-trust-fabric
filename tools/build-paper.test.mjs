import assert from 'node:assert/strict';
import test from 'node:test';
import { controlAppendix, replaceEmbedded, replaceGenerated } from './sync-research.mjs';

test('embedded research round-trips hostile HTML and Unicode without changing surrounding markup', () => {
  const data = { text: '</script><img src=x onerror=alert(1)>', separators: '\u2028\u2029', quote: '"&' };
  const before = '<main id="keep">Unchanged</main><script id="research-data" type="application/json">{}</script><footer>Keep</footer>';
  const result = replaceEmbedded(before, data);
  const payload = result.match(/application\/json">([\s\S]*?)<\/script>/)[1];
  assert.deepEqual(JSON.parse(payload), data);
  assert.equal(result.match(/<\/script>/g).length, 1);
  assert.ok(result.startsWith('<main id="keep">Unchanged</main>'));
  assert.ok(result.endsWith('<footer>Keep</footer>'));
  assert.equal(replaceEmbedded(result, data), result);
});

test('embedding refuses missing, duplicated or wrong-type offline blocks', () => {
  const valid = '<script type="application/json" id="research-data">{}</script>';
  assert.throws(() => replaceEmbedded('', {}), /exactly one/);
  assert.throws(() => replaceEmbedded(valid + valid, {}), /exactly one/);
  assert.throws(() => replaceEmbedded(valid.replace('application/json', 'text/javascript'), {}), /exactly one/);
  assert.throws(() => replaceEmbedded(valid.replace('id=', 'data-id='), {}), /exactly one/);
  assert.throws(() => replaceEmbedded(valid.replace('type=', 'data-type='), {}), /exactly one/);
});

test('generated paper replacement is bounded, idempotent and rejects ambiguous markers', () => {
  const before = '<p>Before</p><!-- BEGIN GENERATED:controls -->old<!-- END GENERATED:controls --><p>After</p>';
  const result = replaceGenerated(before, 'controls', '<table>New</table>');
  assert.equal(result, '<p>Before</p><!-- BEGIN GENERATED:controls -->\n<table>New</table>\n<!-- END GENERATED:controls --><p>After</p>');
  assert.equal(replaceGenerated(result, 'controls', '<table>New</table>'), result);
  assert.throws(() => replaceGenerated(before + before, 'controls', ''), /exactly one/);
  assert.throws(() => replaceGenerated('<!-- END GENERATED:controls --><!-- BEGIN GENERATED:controls -->', 'controls', ''), /Reversed/);
});

test('appendix retains complete core fields and exposes verification with safe source links', () => {
  const data = {
    sources: [{ id: 'MS-01', url: 'https://example.test/guidance?x=1&y=2' }],
    normativeControls: [{
      id: 'N-01', level: 'MUST', domain: 'Boundaries & authority',
      text: 'Retain <all> core wording & evidence.',
      provenance: 'Derived Architectural Position',
      requirement_origin: 'Framework requirement, not a product guarantee.',
      accountable_role: 'Control owner', sources: ['MS-01'],
      verification: { method: 'Inspect the register and test a failed dependency.' }
    }]
  };
  const result = controlAppendix(data);
  assert.match(result, /data-control-id="N-01"/);
  assert.match(result, /data-field="text">Retain &lt;all&gt; core wording &amp; evidence\./);
  assert.match(result, /data-field="domain">Boundaries &amp; authority/);
  assert.match(result, /data-field="level">MUST/);
  assert.match(result, /data-field="provenance">Derived Architectural Position/);
  assert.match(result, /Inspect the register and test a failed dependency\./);
  assert.match(result, /index\.html#control-N-01/);
  assert.match(result, /href="https:\/\/example\.test\/guidance\?x=1&amp;y=2"/);
  assert.match(result, /Framework requirement, not a product guarantee\./);
});

test('appendix refuses an incomplete verification record or unresolved provenance source', () => {
  const control = {
    id: 'N-01', level: 'MUST', domain: 'Test', text: 'Keep evidence.',
    sources: ['MS-01'], verification: { method: 'Inspect evidence.' }
  };
  assert.throws(() => controlAppendix({ sources: [], normativeControls: [control] }), /Unknown source/);
  assert.throws(() => controlAppendix({
    sources: [{ id: 'MS-01', url: 'https://example.test/' }],
    normativeControls: [{ ...control, verification: undefined }]
  }), /structured verification/);
});
