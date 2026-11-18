'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const { assess, inputSchema, contractVersion } = require('../adaptive-trust-fabric-microsite/assets/assessment.js');
const oracles = require('./assessment-oracles.json');
const baseline = oracles.baseline;

for (const oracle of oracles.cases) {
  test(oracle.name, () => {
    assert.ok(oracle.requirement.length > 30, 'oracle records its independent requirement basis');
    const result = assess({ ...baseline, ...oracle.input });
    const expected = oracle.expected;
    assert.equal(result.state, expected.state);
    if ('topology' in expected) assert.equal(result.dimensions.topology.value, expected.topology);
    if ('connectivity' in expected) assert.equal(result.dimensions.connectivity.value, expected.connectivity);
    if ('pattern' in expected) assert.equal(result.dimensions.connectivity.pattern, expected.pattern);
    for (const code of expected.reasonCodes) assert.ok(result.reasons.some(r => r.code === code), `missing explanation: ${code}`);
    for (const id of expected.rejected || []) assert.ok(result.rejectedAlternatives.some(a => a.id === id && a.state === 'excluded'), `missing excluded alternative: ${id}`);
    if (expected.state !== 'candidate') assert.ok(result.unmetPrerequisites.length > 0);
    assert.equal(result.advisoryOnly, true);
    assert.equal(result.evidenceBasis, 'self-reported');
  });
}

test('empty input cannot silently produce the old T1 default', () => {
  const result = assess({});
  assert.equal(result.state, 'insufficient-evidence');
  assert.equal(result.dimensions.topology.value, null);
  assert.equal(result.dimensions.connectivity.value, null);
  assert.ok(result.unmetPrerequisites.some(r => r.fields.includes('boundaryFit')));
});

for (const field of ['boundary', 'sovereignty', 'survivability', 'ot', 'boundaryFit', 'recoveryRequirement', 'recoveryDependency', 'privilegePath', 'staffing', 'monitoring', 'response', 'recoveryTest']) {
  test(`omitting mandatory ${field} requires explicit evidence`, () => {
    const input = { ...baseline };
    delete input[field];
    const result = assess(input);
    assert.equal(result.state, 'insufficient-evidence');
    assert.ok(result.unmetPrerequisites.some(r => r.fields.includes(field)), `missing prerequisite for ${field}`);
    assert.ok(result.nextValidationChecks.some(r => r.fields.includes(field)), `missing follow-up for ${field}`);
  });
}

test('all six declared hard-constraint conflicts are evaluated, not only displayed', () => {
  const conflicts = [
    [{ boundary: 'identity', identityDependency: 'shared' }, 'identity-authority'],
    [{ sovereignty: 'control', sovereigntyEvidence: 'unmet' }, 'sovereignty-authority'],
    [{ survivability: '3', localServices: 'tested', upstreamDependency: 'present' }, 'disconnected-dependencies'],
    [{ ot: 'yes', localAuthority: 'missing', safetyReview: 'reviewed', otFallback: 'tested' }, 'ot-safety'],
    [{ recoveryDependency: 'circular' }, 'recovery-independence'],
    [{ privilegePath: 'unacceptable' }, 'privilege-containment']
  ];
  for (const [input, gate] of conflicts) {
    const result = assess({ ...baseline, ...input });
    assert.equal(result.state, 'excluded', gate);
    assert.equal(result.gates.find(g => g.id === gate).state, 'excluded', gate);
  }
});

test('a known recovery cycle is not hidden by invalid or unknown inputs', () => {
  const result = assess({ ...baseline, recoveryDependency: 'circular', maturity: 'world-class', localServices: null });
  assert.equal(result.state, 'excluded');
  assert.equal(result.readiness.state, 'excluded');
  assert.ok(result.validationErrors.length >= 2);
  assert.ok(result.unmetPrerequisites.some(r => r.code === 'recovery-cycle'));
});

test('unknowns remain separate in independent decision dimensions', () => {
  const result = assess({ ...baseline, recoveryDependency: 'unknown' });
  assert.equal(result.state, 'insufficient-evidence');
  assert.equal(result.dimensions.topology.state, 'candidate');
  assert.equal(result.dimensions.recovery.state, 'insufficient-evidence');
  assert.equal(result.readiness.state, 'insufficient-evidence');
  assert.equal(result.dimensions.connectivity.state, 'candidate');
});

test('unknown optional context does not invent a mandatory prerequisite', () => {
  const result = assess({ ...baseline, ma: 'unknown', maturity: 'unknown', autonomy: 'unknown' });
  assert.equal(result.state, 'candidate');
  assert.equal(result.unmetPrerequisites.length, 0);
});

test('shared recovery is allowed only when the requirement permits it', () => {
  const result = assess({ ...baseline, recoveryDependency: 'shared' });
  assert.equal(result.state, 'candidate');
  assert.equal(result.dimensions.recovery.value, 'shared-acceptable');
  assert.ok(result.nextValidationChecks.some(c => c.code === 'exercise-independent-recovery'));
});

test('a currently independent T3 pattern does not prescribe another tenant', () => {
  const result = assess({ ...baseline, boundary: 'identity', boundaryFit: 'met', identityDependency: 'independent' });
  assert.equal(result.state, 'candidate');
  assert.equal(result.dimensions.topology.value, 'T3');
  assert.match(result.dimensions.topology.summary, /expansion is not established/);
});

test('known safety conflicts do not rewrite the independent tenant dimension', () => {
  const result = assess({ ...baseline, ot: 'yes', localAuthority: 'missing', safetyReview: 'reviewed', otFallback: 'tested' });
  assert.equal(result.state, 'excluded');
  assert.equal(result.dimensions.topology.value, 'T1');
  assert.equal(result.dimensions.connectivity.state, 'excluded');
  assert.ok(result.rejectedAlternatives.some(r => r.dimension === 'connectivity'));
});

test('every missing operating prerequisite defeats an automated maturity label', () => {
  for (const field of ['staffing', 'monitoring', 'response', 'recoveryTest']) {
    const result = assess({ ...baseline, maturity: 'adaptive', [field]: 'missing' });
    assert.equal(result.state, 'excluded', field);
    assert.equal(result.readiness.state, 'excluded', field);
    assert.ok(result.unmetPrerequisites.some(r => r.fields.includes(field)));
  }
});

test('invalid enum, null, object, whitespace and boolean values do not become known facts', () => {
  for (const value of ['T1', null, {}, [], true, ' met ', NaN, Infinity]) {
    const result = assess({ ...baseline, boundaryFit: value });
    assert.equal(result.state, 'insufficient-evidence', String(value));
    assert.equal(result.inputs.boundaryFit, 'unknown');
    assert.ok(result.validationErrors.some(e => e.field === 'boundaryFit' && e.code === 'invalid-value'));
  }
});

test('integer survivability values are accepted without accepting invalid numeric tiers', () => {
  assert.equal(assess({ ...baseline, survivability: 0 }).state, 'candidate');
  for (const value of [-1, 5, 1.5, Infinity]) assert.equal(assess({ ...baseline, survivability: value }).state, 'insufficient-evidence');
});

test('unknown extra fields and misspelled evidence fields are explicit input errors', () => {
  const result = assess({ ...baseline, recoveryTset: 'evidenced' });
  assert.equal(result.state, 'insufficient-evidence');
  assert.ok(result.validationErrors.some(e => e.field === 'recoveryTset' && e.code === 'unknown-field'));
});

test('a verification label cannot promote a self-reported fact to inspected evidence', () => {
  const result = assess({ ...baseline, staffing: 'verified' });
  assert.equal(result.state, 'insufficient-evidence');
  assert.equal(result.evidenceBasis, 'self-reported');
  assert.ok(result.validationErrors.some(error => error.field === 'staffing'));
});

test('malformed records and unreadable accessors fail safely', () => {
  for (const input of [undefined, null, 'candidate', [], 42, true, new Date(), Object.create(baseline)]) {
    const result = assess(input);
    assert.equal(result.state, 'insufficient-evidence');
    assert.ok(result.validationErrors.length > 0);
    assert.equal(result.dimensions.topology.value, null);
  }
  const getter = { ...baseline };
  Object.defineProperty(getter, 'boundary', { get() { throw new Error('unreadable'); } });
  assert.equal(assess(getter).state, 'insufficient-evidence');
  assert.ok(assess(getter).validationErrors.some(e => e.code === 'unreadable-input'));
  const proxy = new Proxy({}, { ownKeys() { throw new Error('unreadable keys'); } });
  assert.equal(assess(proxy).state, 'insufficient-evidence');
});

test('prototype-bearing input names cannot bypass guards', () => {
  const input = JSON.parse(JSON.stringify(baseline).replace(/}$/, ',"__proto__":{"state":"candidate"}}'));
  const result = assess(input);
  assert.equal(result.state, 'insufficient-evidence');
  assert.ok(result.validationErrors.some(e => e.field === '__proto__'));
  assert.equal({}.state, undefined);
  assert.equal(assess(Object.assign(Object.create(null), baseline)).state, 'candidate');
});

test('the plain-data contract is serializable, deterministic and does not mutate input', () => {
  const input = Object.freeze({ ...baseline, ma: 'high' });
  const result = assess(input);
  assert.deepEqual(result, assess(input));
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
  assert.equal(result.contractVersion, contractVersion);
  for (const dimension of ['topology', 'identity', 'sovereignty', 'connectivity', 'recovery']) {
    assert.ok(['candidate', 'insufficient-evidence', 'excluded'].includes(result.dimensions[dimension].state));
  }
  assert.ok(result.assumptions.some(a => /self-reported/.test(a)));
  assert.match(result.readiness.summary, /not inspected/);
  assert.equal(result.rejectedAlternatives.length, 0, 'unselected patterns are not falsely called infeasible');
});

test('all reason, prerequisite and next-check references resolve to existing research records', () => {
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'adaptive-trust-fabric-microsite', 'data', 'research.json'), 'utf8'));
  const ids = { sourceIds: new Set(data.sources.map(s => s.id)), claimIds: new Set(data.claims.map(c => c.id)), controlIds: new Set(data.normativeControls.map(c => c.id)) };
  for (const oracle of oracles.cases) {
    const result = assess({ ...baseline, ...oracle.input });
    for (const item of [...result.reasons, ...result.unmetPrerequisites, ...result.nextValidationChecks]) {
      assert.equal(typeof item.message, 'string');
      assert.ok(Array.isArray(item.fields));
      for (const [field, valid] of Object.entries(ids)) for (const id of item[field]) assert.ok(valid.has(id), `${item.code}: ${id}`);
    }
    for (const rejected of result.rejectedAlternatives) for (const code of rejected.reasonCodes) assert.ok(result.reasons.some(r => r.code === code));
  }
});

test('classic browser script has the same API with no CommonJS, fetch or module loader', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'adaptive-trust-fabric-microsite', 'assets', 'assessment.js'), 'utf8');
  const context = vm.createContext({});
  vm.runInContext(source, context);
  assert.equal(context.ATFAssessment.contractVersion, '1.0');
  const result = vm.runInContext(`ATFAssessment.assess(${JSON.stringify(baseline)})`, context);
  assert.equal(result.state, 'candidate');
  assert.equal(result.dimensions.topology.value, 'T1');
  assert.ok(Object.isFrozen(inputSchema));
});

test('the offline form submits the documented fact names and starts every declaration unknown', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'adaptive-trust-fabric-microsite', 'index.html'), 'utf8');
  const form = html.match(/<form\b[^>]*id="assessment-form"[^>]*>([\s\S]*?)<\/form>/)[1];
  const fields = [...form.matchAll(/<select\b[^>]*name="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)];
  assert.deepEqual(fields.map(field => field[1]).sort(), Object.keys(inputSchema).sort(), 'UI must not silently omit a contract field or submit a misspelled extra field');
  for (const [, name, options] of fields) {
    assert.equal(options.match(/<option\b[^>]*value="([^"]+)"/)[1], 'unknown', `${name} must not start with an approval-shaped known fact`);
  }
  assert.match(form, /Unknown[^<]*|unknown/);
  assert.match(html, /Configuration|configuration/);
  assert.ok(html.indexOf('src="assets/assessment.js"') < html.indexOf('src="assets/app.js"'));
  assert.ok(!/<script[^>]*type="module"/.test(html), 'file:// needs classic scripts');
  assert.match(html.match(/<script>([\s\S]*?)<\/script>/)[1], /clawpilotTheme/);
});
