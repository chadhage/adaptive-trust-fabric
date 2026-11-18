import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const collections = ['sources', 'claims', 'normativeControls', 'capabilityMatrix'];
const statuses = new Set(['source-verified', 'derived', 'unverified']);
const methods = new Set(['full-page', 'search-excerpt', 'not-rechecked']);
const day = 86_400_000;

function calendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : null;
}

function text(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function auditSourceMaintenance(data, { asOf = new Date().toISOString().slice(0, 10) } = {}) {
  const report = {
    scope: 'offline-record-audit',
    as_of: asOf,
    network_checks_performed: false,
    sources_total: 0,
    evidence_records_checked: 0,
    recorded_passage_reviews: 0,
    due_sources: [],
    unverified_sources: [],
    warnings: [],
    errors: [],
  };
  const asOfTime = calendarDate(asOf);
  if (asOfTime === null) {
    report.errors.push('asOf must be a real ISO calendar date (YYYY-MM-DD).');
    return report;
  }
  if (!data || !Array.isArray(data.sources) || data.sources.length === 0) {
    report.errors.push('sources must be a nonempty array.');
    return report;
  }
  report.sources_total = data.sources.length;
  const known = new Set(data.sources.map(source => source?.id));
  if (known.has(undefined) || known.size !== data.sources.length) report.errors.push('Source IDs must be present and unique.');
  const maintenance = data.sourceMaintenance;
  const policy = maintenance?.review_policy;
  if (!text(maintenance?.accountable_role)) report.errors.push('sourceMaintenance.accountable_role is required.');
  if (!Number.isInteger(policy?.default_interval_days) || policy.default_interval_days <= 0) {
    report.errors.push('A positive default review interval is required.');
  }
  const intervals = new Map();
  for (const override of policy?.overrides ?? []) {
    if (!Array.isArray(override.source_ids) || !Number.isInteger(override.interval_days) || override.interval_days <= 0 || !text(override.reason)) {
      report.errors.push('Each review override requires source_ids, a positive interval_days and reason.');
      continue;
    }
    for (const id of override.source_ids) {
      if (!known.has(id) || intervals.has(id)) report.errors.push(`Unknown or duplicate review override: ${id}`);
      intervals.set(id, override.interval_days);
    }
  }
  for (const collection of collections) {
    if (!Array.isArray(data[collection])) {
      report.errors.push(`${collection} must be an array.`);
      continue;
    }
    for (const record of data[collection]) {
      const label = `${collection}/${record?.id ?? '(missing ID)'}`;
      const evidence = record?.evidence;
      report.evidence_records_checked += 1;
      if (!evidence || !statuses.has(evidence.status)) {
        report.errors.push(`${label}: valid evidence.status is required.`);
        continue;
      }
      const reviewed = evidence.verified_on === null ? null : calendarDate(evidence.verified_on);
      if (evidence.verified_on !== null && reviewed === null) report.errors.push(`${label}: invalid verified_on.`);
      if (reviewed !== null && reviewed > asOfTime) report.errors.push(`${label}: future verified_on.`);
      if (evidence.operational_validation !== 'not-performed') report.errors.push(`${label}: operational validation must remain not-performed.`);
      for (const key of ['applicability', 'limitations']) {
        if (!Array.isArray(evidence[key]) || evidence[key].length === 0 || evidence[key].some(value => !text(value))) {
          report.errors.push(`${label}: nonempty evidence.${key} is required.`);
        }
      }
      if (!text(evidence.confidence_rationale)) report.errors.push(`${label}: confidence_rationale is required.`);
      const refs = evidence.source_refs;
      if (!Array.isArray(refs) || (evidence.status !== 'unverified' && refs.length === 0)) {
        report.errors.push(`${label}: source_refs are required for supported/derived records.`);
        continue;
      }
      const dates = [];
      for (const ref of refs) {
        if (!known.has(ref.source_id)) report.errors.push(`${label}: unknown source reference ${ref.source_id}.`);
        if (Array.isArray(record.sources) && !record.sources.includes(ref.source_id)) report.errors.push(`${label}: reference not in record.sources: ${ref.source_id}.`);
        try {
          if (new URL(ref.url).protocol !== 'https:') throw new Error('protocol');
        } catch {
          report.errors.push(`${label}: source URL must be an absolute HTTPS URL.`);
        }
        if (!text(ref.section) || !text(ref.supports) || !(ref.revision === null || text(ref.revision))) {
          report.errors.push(`${label}: source section, supports and revision (or null) are required.`);
        }
        if (!methods.has(ref.verification)) report.errors.push(`${label}: invalid source verification method.`);
        const checked = ref.verified_on === null ? null : calendarDate(ref.verified_on);
        if (ref.verification === 'not-rechecked') {
          if (ref.verified_on !== null) report.errors.push(`${label}: not-rechecked cannot carry a new verification date.`);
        } else if (checked === null) {
          report.errors.push(`${label}: a checked passage requires a valid date.`);
        } else {
          dates.push(checked);
          if (checked > asOfTime) report.errors.push(`${label}: future source verification date.`);
        }
      }
      if (evidence.status !== 'unverified' && (reviewed === null || dates.length === 0)) {
        report.errors.push(`${label}: supported/derived evidence needs an actual dated passage review.`);
      }
      if (reviewed !== null && dates.length > 0 && reviewed > Math.max(...dates)) {
        report.errors.push(`${label}: verified_on cannot be newer than every checked passage.`);
      }
      if (collection !== 'sources') continue;
      if (evidence.status === 'unverified' || reviewed === null || dates.length === 0) {
        report.unverified_sources.push({ id: record.id, last_reviewed_on: evidence.verified_on });
        continue;
      }
      report.recorded_passage_reviews += 1;
      const interval = intervals.get(record.id) ?? policy?.default_interval_days;
      if (!Number.isInteger(interval) || interval <= 0) continue;
      const dueTime = reviewed + interval * day;
      if (dueTime <= asOfTime) report.due_sources.push({
        id: record.id,
        last_reviewed_on: evidence.verified_on,
        interval_days: interval,
        due_on: new Date(dueTime).toISOString().slice(0, 10),
      });
    }
  }
  for (const event of maintenance?.verification_ledger?.access_events ?? []) {
    report.warnings.push(`Recorded ${event.outcome} (${event.http_status}) at ${event.url}; not a new network check or proof the claim is false.`);
  }
  for (const issue of maintenance?.outstanding_issues ?? []) {
    report.warnings.push(`${issue.id}: ${issue.status}; ${issue.issue}`);
  }
  return report;
}

export function sourceMaintenanceExitCode(report) {
  return report.errors.length ? 1 : report.due_sources.length || report.unverified_sources.length ? 2 : 0;
}

async function main(args) {
  let asOf;
  let json = false;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--json') json = true;
    else if (args[index] === '--as-of' && args[index + 1] && !args[index + 1].startsWith('--')) asOf = args[++index];
    else throw new Error('Usage: node tools\\source-maintenance.mjs [--as-of YYYY-MM-DD] [--json]');
  }
  const path = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'adaptive-trust-fabric-microsite', 'data', 'research.json');
  const data = JSON.parse(await readFile(path, 'utf8'));
  const report = auditSourceMaintenance(data, { asOf });
  if (json) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`Offline source-record audit: ${report.sources_total} sources; ${report.evidence_records_checked} evidence records; no network checks.`);
    console.log(`Due: ${report.due_sources.length}; unverified: ${report.unverified_sources.length}; errors: ${report.errors.length}; warnings: ${report.warnings.length}.`);
    for (const error of report.errors) console.error(error);
    for (const source of report.due_sources) console.log(`${source.id}: review due ${source.due_on}`);
  }
  process.exitCode = sourceMaintenanceExitCode(report);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
