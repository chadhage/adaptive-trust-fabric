import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { auditSourceMaintenance, sourceMaintenanceExitCode } from './source-maintenance.mjs';

function evidence(id, date = '2026-11-01') {
  return {
    status: 'source-verified',
    verified_on: date,
    source_refs: [{
      source_id: id,
      url: `https://learn.microsoft.com/en-us/example/${id}`,
      section: 'Scoped capability',
      revision: null,
      verified_on: date,
      verification: 'full-page',
      supports: 'A narrow documentary proposition.',
    }],
    applicability: ['A supported test scenario'],
    limitations: ['No operational execution.'],
    confidence_rationale: 'The exact primary passage was inspected.',
    operational_validation: 'not-performed',
  };
}

function fixture() {
  return {
    meta: { generated: '2026-12-02' },
    sources: ['MS-01', 'MS-02'].map(id => ({ id, evidence: evidence(id) })),
    claims: [{ id: 'C-01', sources: ['MS-01'], evidence: evidence('MS-01') }],
    normativeControls: [],
    capabilityMatrix: [],
    sourceMaintenance: {
      accountable_role: 'Technical reference maintenance lead',
      review_policy: {
        default_interval_days: 90,
        overrides: [{ source_ids: ['MS-01'], interval_days: 30, reason: 'Rapidly changing capability.' }],
      },
    },
  };
}

test('cadence uses actual passage review, not regeneration or an HTTP access event', () => {
  const data = fixture();
  data.sourceMaintenance.verification_ledger = {
    access_events: [{ url: data.sources[0].evidence.source_refs[0].url, http_status: 200, outcome: 'http-only', observed_on: '2026-12-02' }],
  };
  const report = auditSourceMaintenance(data, { asOf: '2026-12-02' });
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.due_sources, [{ id: 'MS-01', last_reviewed_on: '2026-11-01', interval_days: 30, due_on: '2026-12-01' }]);
  assert.equal(report.network_checks_performed, false);
  assert.equal(sourceMaintenanceExitCode(report), 2);
  assert.equal(data.sources[0].evidence.verified_on, '2026-11-01');
});

test('unverified passages remain actionable without inventing a verification date', () => {
  const data = fixture();
  const pending = data.sources[0].evidence;
  pending.status = 'unverified';
  pending.verified_on = null;
  pending.source_refs[0].verified_on = null;
  pending.source_refs[0].verification = 'not-rechecked';
  data.claims = [];
  const report = auditSourceMaintenance(data, { asOf: '2026-11-18' });
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.unverified_sources, [{ id: 'MS-01', last_reviewed_on: null }]);
  assert.equal(sourceMaintenanceExitCode(report), 2);
});

test('fabricated freshness, unknown references and invalid dates are structural errors', () => {
  const data = fixture();
  const ref = data.claims[0].evidence.source_refs[0];
  ref.source_id = 'MISSING';
  ref.verification = 'not-rechecked';
  data.sources[0].evidence.verified_on = '2026-11-19';
  data.sources[1].evidence.verified_on = '2026-02-31';
  const report = auditSourceMaintenance(data, { asOf: '2026-11-18' });
  assert.ok(report.errors.some(error => error.includes('unknown source reference')));
  assert.ok(report.errors.some(error => error.includes('not-rechecked')));
  assert.ok(report.errors.some(error => error.includes('future verified_on')));
  assert.ok(report.errors.some(error => error.includes('invalid verified_on')));
  assert.equal(sourceMaintenanceExitCode(report), 1);
});

test('non-HTTPS references, duplicate cadence and invented operational assurance are rejected', () => {
  const data = fixture();
  data.sources[0].evidence.source_refs[0].url = 'file:///C:/private/evidence';
  data.sources[0].evidence.operational_validation = 'passed';
  data.sourceMaintenance.review_policy.overrides.push({ source_ids: ['MS-01'], interval_days: 5, reason: 'Duplicate.' });
  const report = auditSourceMaintenance(data, { asOf: '2026-11-18' });
  assert.ok(report.errors.some(error => error.includes('HTTPS')));
  assert.ok(report.errors.some(error => error.includes('duplicate review override')));
  assert.ok(report.errors.some(error => error.includes('operational validation')));
});

test('invalid as-of and malformed CLI options fail without any source maintenance writes', () => {
  assert.equal(sourceMaintenanceExitCode(auditSourceMaintenance(fixture(), { asOf: '2026-02-31' })), 1);
  const command = fileURLToPath(new URL('./source-maintenance.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [command, '--fetch-live'], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Usage:/);
});
