import { readJson, runCli } from './validate-common.mjs';

const provenance = new Set([
  'Microsoft Explicit', 'External Standard', 'Research Supported',
  'Derived Architectural Position', 'Open/Contested',
]);
const evidenceStates = new Set(['source-verified', 'derived', 'unverified']);
const verificationKinds = new Set(['full-page', 'search-excerpt', 'not-rechecked']);
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const strings = value => Array.isArray(value) && value.length > 0 && value.every(nonempty);
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const nullableDate = value => value === null || date(value);
const https = value => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch { return false; }
};
const pageUrl = value => {
  try {
    const url = new URL(value);
    url.hash = '';
    return url.href.replace(/\/$/, '');
  } catch { return null; }
};

export function validateResearchData(data) {
  const errors = [];
  const require = (condition, label) => { if (!condition) errors.push(label); };
  if (!object(data)) return { check: 'research', errors: ['Research root must be an object'], stats: {} };
  require(object(data.meta), 'meta must be an object');
  for (const field of ['title', 'subtitle', 'version', 'disclaimer']) {
    require(nonempty(data.meta?.[field]), `meta.${field} must be a nonempty string`);
  }
  for (const field of ['research_cutoff', 'generated']) require(date(data.meta?.[field]), `meta.${field} must be an ISO date`);
  require(nonempty(data.thesis), 'thesis must be a nonempty string');
  const collections = {
    sources: ['id', 'title', 'url', 'provenance', 'retrieval_status', 'accessed', 'evidence_use'],
    claims: ['id', 'claim', 'provenance', 'confidence'],
    normativeControls: ['id', 'level', 'domain', 'text', 'provenance'],
    survivabilityTiers: ['id', 'name', 'mission', 'identity', 'policy', 'secops', 'recovery'],
    topologies: ['id', 'name', 'use_when', 'reject_when'],
    adversarialFindings: ['position', 'test', 'result'],
    roadmap: ['phase', 'outcome'],
    capabilityMatrix: ['id', 'name', 'status', 'failure_behavior'],
  };
  for (const [name, fields] of Object.entries(collections)) {
    require(Array.isArray(data[name]) && data[name].length > 0, `${name} must be a nonempty array`);
    const ids = new Set();
    for (const [index, record] of (Array.isArray(data[name]) ? data[name] : []).entries()) {
      const label = `${name}[${index}]`;
      require(object(record), `${label} must be an object`);
      for (const field of fields) require(nonempty(record?.[field]), `${label}.${field} must be a nonempty string`);
      if (fields.includes('id')) {
        require(!ids.has(record?.id), `${label}: duplicate id ${record?.id}`);
        ids.add(record?.id);
      }
    }
  }
  const inventory = {
    sources: [...Array.from({ length: 26 }, (_, i) => `MS-${String(i + 1).padStart(2, '0')}`),
      ...Array.from({ length: 6 }, (_, i) => `STD-${String(i + 1).padStart(2, '0')}`), 'RES-01'],
    claims: Array.from({ length: 18 }, (_, i) => `C-${String(i + 1).padStart(2, '0')}`),
    normativeControls: Array.from({ length: 26 }, (_, i) => `N-${String(i + 1).padStart(2, '0')}`),
    survivabilityTiers: ['S0', 'S1', 'S2', 'S3', 'S4'],
    topologies: ['T1', 'T2', 'T3', 'T4', 'T5'],
    capabilityMatrix: Array.from({ length: 10 }, (_, i) => `K${String(i + 1).padStart(2, '0')}`),
  };
  for (const [name, expected] of Object.entries(inventory)) {
    const actual = (Array.isArray(data[name]) ? data[name] : []).map(record => record?.id);
    require(actual.length === expected.length && expected.every(id => actual.includes(id)),
      `${name}: expected stable ID inventory ${expected.join(', ')}`);
  }
  require(data.adversarialFindings?.length === 10, 'Expected 10 assumption reviews');
  for (const name of ['hardConstraints', 'decisionHierarchy', 'decisionDimensions']) require(strings(data[name]), `${name} must be a nonempty string array`);
  require(object(data.researchMethod), 'researchMethod must be an object');
  require(nonempty(data.researchMethod?.standard), 'researchMethod.standard is required');
  for (const field of ['mandatoryPractices', 'limitations']) require(strings(data.researchMethod?.[field]), `researchMethod.${field} must be a nonempty string array`);
  require(Array.isArray(data.provenanceLegend) && data.provenanceLegend.length === provenance.size &&
    [...provenance].every(value => data.provenanceLegend.some(item => item?.class === value && nonempty(item.meaning))),
  'provenanceLegend must define all five provenance classes');
  require(object(data.evidenceContract), 'evidenceContract must be an object');
  require(object(data.sourceMaintenance), 'sourceMaintenance must be an object');
  const sources = new Set((Array.isArray(data.sources) ? data.sources : []).map(source => source?.id));
  const primaryUrlOwners = new Map();
  for (const source of Array.isArray(data.sources) ? data.sources : []) {
    const url = pageUrl(source?.url);
    if (!url) continue;
    if (!primaryUrlOwners.has(url)) primaryUrlOwners.set(url, new Set());
    primaryUrlOwners.get(url).add(source.id);
  }

  function sourceRefs(record, label) {
    require(strings(record.sources), `${label}.sources must be a nonempty source-ID array`);
    for (const id of Array.isArray(record.sources) ? record.sources : []) require(sources.has(id), `${label}: unknown source ${id}`);
    require(!Array.isArray(record.sources) || new Set(record.sources).size === record.sources.length, `${label}: duplicate source reference`);
  }
  function evidence(record, label) {
    const item = record.evidence;
    require(object(item), `${label}.evidence must be an object`);
    if (!object(item)) return;
    require(evidenceStates.has(item.status), `${label}.evidence.status is unsupported`);
    require(nullableDate(item.verified_on), `${label}.evidence.verified_on must be an ISO date or null`);
    if (item.status === 'source-verified' || item.status === 'derived') {
      require(date(item.verified_on), `${label}: verified or derived evidence requires a review date`);
    }
    for (const field of ['applicability', 'limitations']) require(strings(item[field]), `${label}.evidence.${field} must be a nonempty string array`);
    require(nonempty(item.confidence_rationale), `${label}.evidence.confidence_rationale is required`);
    require(item.operational_validation === 'not-performed', `${label}: documentary support must not imply operational validation`);
    require(Array.isArray(item.source_refs) && item.source_refs.length > 0, `${label}.evidence.source_refs must be nonempty`);
    // A contextual bibliography may be broader than the selected exact passages.
    const bibliography = new Set(Array.isArray(record.sources) ? record.sources : [record.id]);
    for (const [index, ref] of (Array.isArray(item.source_refs) ? item.source_refs : []).entries()) {
      const where = `${label}.evidence.source_refs[${index}]`;
      require(object(ref), `${where} must be an object`);
      if (!object(ref)) continue;
      require(sources.has(ref.source_id), `${where}: unknown source ${ref.source_id}`);
      require(bibliography.has(ref.source_id), `${where}: locator source is outside the record bibliography`);
      require(https(ref.url), `${where}.url must be an absolute HTTPS URL`);
      const owners = primaryUrlOwners.get(pageUrl(ref.url));
      require(!owners || owners.has(ref.source_id), `${where}.url belongs to a different catalog source`);
      require(nonempty(ref.section) && nonempty(ref.supports), `${where}: section and supports are required`);
      require(ref.revision === null || nonempty(ref.revision), `${where}.revision must be a string or null`);
      require(nullableDate(ref.verified_on), `${where}.verified_on must be an ISO date or null`);
      require(verificationKinds.has(ref.verification), `${where}.verification is unsupported`);
      if (ref.verification === 'not-rechecked') {
        require(ref.verified_on === null, `${where}: a passage not rechecked must not gain a fresh review date`);
      } else if (verificationKinds.has(ref.verification)) {
        require(date(ref.verified_on), `${where}: inspected passage requires a review date`);
      }
    }
  }

  for (const name of ['sources', 'claims', 'normativeControls']) {
    for (const record of Array.isArray(data[name]) ? data[name] : []) {
      if (!object(record)) continue;
      const label = `${name}.${record.id}`;
      require(provenance.has(record.provenance), `${label}: unsupported provenance`);
      if (name === 'sources') {
        require(https(record.url), `${label}.url must be an absolute HTTPS URL`);
        require(date(record.accessed), `${label}.accessed must be an ISO date`);
      } else sourceRefs(record, label);
      if (name === 'claims') require(['High', 'Moderate', 'Low'].includes(record.confidence), `${label}: unsupported confidence`);
      evidence(record, label);
    }
  }
  for (const record of Array.isArray(data.normativeControls) ? data.normativeControls : []) {
    if (!object(record)) continue;
    const label = `normativeControls.${record.id}`;
    require(['MUST', 'SHOULD', 'MAY'].includes(record.level), `${label}: unsupported level`);
    require(record.requirement_origin === 'framework', `${label}.requirement_origin must distinguish framework requirements`);
    for (const field of ['accountable_role', 'failure_behavior']) require(nonempty(record[field]), `${label}.${field} is required`);
    for (const field of ['exclusions', 'dependencies']) require(strings(record[field]), `${label}.${field} must be a nonempty string array`);
    require(object(record.verification), `${label}.verification is required`);
    require(record.verification?.status === 'not-performed', `${label}.verification.status must not claim unexecuted tests`);
    require(nonempty(record.verification?.method), `${label}.verification.method is required`);
    for (const field of ['evidence', 'pass', 'fail']) require(strings(record.verification?.[field]), `${label}.verification.${field} must be a nonempty string array`);
    require(object(record.exception), `${label}.exception is required`);
    require(nonempty(record.exception?.approval_role), `${label}.exception.approval_role is required`);
    for (const field of ['conditions', 'review_triggers']) require(strings(record.exception?.[field]), `${label}.exception.${field} must be a nonempty string array`);
    require(Number.isInteger(record.exception?.review_interval_days) && record.exception.review_interval_days > 0,
      `${label}.exception.review_interval_days must be a positive integer`);
  }
  for (const name of ['topologies', 'adversarialFindings']) {
    for (const [index, record] of (Array.isArray(data[name]) ? data[name] : []).entries()) {
      if (object(record)) sourceRefs(record, `${name}[${index}]`);
    }
  }
  for (const [index, record] of (Array.isArray(data.roadmap) ? data.roadmap : []).entries()) {
    require(strings(record?.actions), `roadmap[${index}].actions must be a nonempty string array`);
  }
  for (const record of Array.isArray(data.capabilityMatrix) ? data.capabilityMatrix : []) {
    if (!object(record)) continue;
    const label = `capabilityMatrix.${record.id}`;
    require(object(record.scope), `${label}.scope is required`);
    require(strings(record.scope?.identities), `${label}.scope.identities must be a nonempty string array`);
    for (const field of ['clouds', 'licensing', 'availability']) require(nonempty(record.scope?.[field]), `${label}.scope.${field} is required`);
    for (const field of ['supported', 'not_supported', 'dependencies', 'implementation_checks']) require(strings(record[field]), `${label}.${field} must be a nonempty string array`);
    sourceRefs(record, label);
    evidence(record, label);
  }
  return { check: 'research', errors, stats: Object.fromEntries(Object.keys(collections).map(name => [name, Array.isArray(data[name]) ? data[name].length : 0])) };
}

export function validateResearch(root) {
  return validateResearchData(readJson(root, 'adaptive-trust-fabric-microsite/data/research.json'));
}

runCli(import.meta, validateResearch);
