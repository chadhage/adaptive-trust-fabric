(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ATFAssessment = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  const contractVersion = '1.0';
  const inputSchema = {
    boundary: { label: 'Required isolation', values: ['unknown', 'delegated', 'regulatory', 'identity'], mandatory: true },
    sovereignty: { label: 'Sovereignty requirement', values: ['unknown', 'residency', 'keys', 'control'], mandatory: true },
    survivability: { label: 'Required survivability', values: ['unknown', '0', '1', '2', '3', '4'], mandatory: true },
    ot: { label: 'Safety-critical OT applicability', values: ['unknown', 'no', 'yes'], mandatory: true },
    boundaryFit: { label: 'Whether one tenant can meet the mandatory requirements', values: ['unknown', 'met', 'unmet'], mandatory: true },
    identityDependency: { label: 'Proposed identity and administration authority paths', values: ['unknown', 'independent', 'shared'] },
    sovereigntyEvidence: { label: 'Proposed operator, processing and key controls', values: ['unknown', 'met', 'unmet'] },
    localServices: { label: 'Tests of functions for the required outage duration', values: ['unknown', 'tested', 'missing'] },
    upstreamDependency: { label: 'Upstream dependencies of required independent functions', values: ['unknown', 'removed', 'present'] },
    recoveryRequirement: { label: 'Required recovery authority', values: ['unknown', 'shared-acceptable', 'independent'], mandatory: true },
    recoveryDependency: { label: 'Declared recovery dependencies', values: ['unknown', 'independent', 'shared', 'circular'], mandatory: true },
    privilegePath: { label: 'Transitive privilege containment', values: ['unknown', 'contained', 'unacceptable'], mandatory: true },
    localAuthority: { label: 'Local OT operating authority', values: ['unknown', 'established', 'missing'] },
    safetyReview: { label: 'Safety review of response and failure behavior', values: ['unknown', 'reviewed', 'unsafe'] },
    otFallback: { label: 'Local OT safe-operation or safe-shutdown fallback', values: ['unknown', 'tested', 'absent'] },
    staffing: { label: 'Accountable staffing and skills', values: ['unknown', 'evidenced', 'missing'], mandatory: true },
    monitoring: { label: 'Monitoring capability', values: ['unknown', 'evidenced', 'missing'], mandatory: true },
    response: { label: 'Incident response capability', values: ['unknown', 'evidenced', 'missing'], mandatory: true },
    recoveryTest: { label: 'Recovery exercise evidence', values: ['unknown', 'evidenced', 'missing'], mandatory: true },
    ma: { label: 'Acquisition or divestiture frequency', values: ['unknown', 'low', 'high'] },
    autonomy: { label: 'Business-unit autonomy', values: ['unknown', 'low', 'high'] },
    maturity: { label: 'Self-described operating maturity', values: ['unknown', 'developing', 'managed', 'adaptive'] }
  };
  Object.values(inputSchema).forEach(field => { Object.freeze(field.values); Object.freeze(field); });
  Object.freeze(inputSchema);

  const references = {
    topology: { sourceIds: ['MS-02', 'MS-03', 'STD-03'], claimIds: ['C-01', 'C-02', 'C-03'], controlIds: ['N-26'] },
    identity: { sourceIds: ['MS-02', 'MS-07'], claimIds: ['C-02'], controlIds: ['N-03'] },
    sovereignty: { sourceIds: ['MS-14', 'MS-15', 'MS-11'], claimIds: ['C-11'], controlIds: ['N-26'] },
    connectivity: { sourceIds: ['MS-19', 'MS-20', 'STD-02'], claimIds: ['C-13'], controlIds: ['N-05'] },
    recovery: { sourceIds: ['MS-07', 'MS-08'], claimIds: ['C-07'], controlIds: ['N-26'] },
    safety: { sourceIds: ['MS-18', 'STD-02'], claimIds: ['C-13'], controlIds: ['N-14'] },
    readiness: { sourceIds: ['STD-03', 'STD-05'], claimIds: ['C-16'], controlIds: ['N-26'] }
  };
  const combine = states => states.includes('excluded') ? 'excluded' : states.includes('insufficient-evidence') ? 'insufficient-evidence' : 'candidate';
  const slug = value => value.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`);

  function assess(raw) {
    const inputs = {};
    const validationErrors = [];
    let record = raw;
    try {
      if (!record || typeof record !== 'object' || Array.isArray(record) ||
          ![Object.prototype, null].includes(Object.getPrototypeOf(record))) {
        validationErrors.push({ field: null, code: 'invalid-input', message: 'Assessment input must be a plain record of declared facts.' });
        record = {};
      }
      for (const key of Reflect.ownKeys(record)) {
        if (typeof key !== 'string' || !Object.hasOwn(inputSchema, key)) {
          validationErrors.push({ field: String(key), code: 'unknown-field', message: `Unrecognized assessment field: ${String(key)}.` });
        }
      }
      for (const [key, schema] of Object.entries(inputSchema)) {
        let value = Object.hasOwn(record, key) ? record[key] : 'unknown';
        if (key === 'survivability' && Number.isInteger(value)) value = String(value);
        if (typeof value !== 'string' || !schema.values.includes(value)) {
          validationErrors.push({ field: key, code: 'invalid-value', message: `${schema.label} must use one of the documented values.` });
          value = 'unknown';
        }
        inputs[key] = value;
      }
    } catch {
      validationErrors.push({ field: null, code: 'unreadable-input', message: 'The input record could not be read safely.' });
      for (const key of Object.keys(inputSchema)) inputs[key] = 'unknown';
    }

    const reasons = [];
    const issues = [];
    const nextValidationChecks = [];
    const rejectedAlternatives = [];
    const dimensionStates = { topology: [], identity: [], sovereignty: [], connectivity: [], recovery: [], readiness: [] };
    function reason(code, message, dimension, fields = []) {
      let item = reasons.find(r => r.code === code);
      if (!item) {
        const refs = references[dimension] || references.topology;
        item = { code, message, dimension, fields: [...fields], sourceIds: [...refs.sourceIds], claimIds: [...refs.claimIds], controlIds: [...refs.controlIds] };
        reasons.push(item);
      }
      return item;
    }
    function issue(state, code, message, dimension, fields, affected = [dimension]) {
      const item = reason(code, message, dimension, fields);
      if (!issues.some(i => i.reason.code === code)) issues.push({ state, reason: item });
      affected.forEach(d => dimensionStates[d]?.push(state));
      return item;
    }
    function need(field, dimension, affected = [dimension]) {
      if (inputs[field] === 'unknown') {
        issue('insufficient-evidence', `${slug(field)}-unknown`, `${inputSchema[field].label} is unknown; establish this mandatory fact before relying on the assessed configuration.`, dimension, [field], affected);
      }
    }
    function conflict(code, message, dimension, fields, affected = [dimension]) {
      return issue('excluded', code, message, dimension, fields, affected);
    }
    function check(code, message, dimension, fields = []) {
      const refs = references[dimension] || references.topology;
      nextValidationChecks.push({ code, message, dimension, fields: [...fields], sourceIds: [...refs.sourceIds], claimIds: [...refs.claimIds], controlIds: [...refs.controlIds] });
    }
    function reject(id, dimension, code, message) {
      const existing = rejectedAlternatives.find(a => a.id === id && a.dimension === dimension);
      if (existing) { if (!existing.reasonCodes.includes(code)) existing.reasonCodes.push(code); }
      else rejectedAlternatives.push({ id, dimension, state: 'excluded', reasonCodes: [code], message });
    }

    need('boundary', 'topology', ['topology', 'identity']);
    need('boundaryFit', 'topology');
    need('sovereignty', 'sovereignty', ['sovereignty', 'topology']);
    need('survivability', 'connectivity');
    need('ot', 'safety', ['connectivity']);
    need('recoveryRequirement', 'recovery');
    need('recoveryDependency', 'recovery');
    need('privilegePath', 'identity', ['identity', 'topology']);

    let topology = null;
    if (inputs.boundary === 'identity') {
      topology = 'T3';
      reason('independent-identity-required', 'The declared independent identity requirement calls for the T3 authority pattern; it may already exist and does not by itself prescribe an additional tenant.', 'identity', ['boundary']);
      reject('T1', 'identity', 'independent-identity-required', 'A shared global identity authority cannot satisfy the declared independent identity requirement.');
      need('identityDependency', 'identity', ['identity', 'topology']);
      if (inputs.identityDependency === 'shared') {
        conflict('identity-shared-dependency', 'The proposed independent boundary still depends on shared authentication, federation or administration. A separate tenant label does not remove that authority path.', 'identity', ['identityDependency'], ['identity', 'topology']);
      }
    } else if (inputs.boundary !== 'unknown' && inputs.boundaryFit !== 'unknown') {
      topology = inputs.boundaryFit === 'unmet' ? 'T2' : 'T1';
    }
    if (inputs.boundaryFit === 'unmet') {
      reason('single-tenant-unmet-requirement', 'A declared mandatory requirement cannot be met within one tenant. Review a separate boundary and its actual controls, not just its tenant count.', 'topology', ['boundaryFit']);
      reject('T1', 'topology', 'single-tenant-unmet-requirement', 'The declared mandatory requirement is not satisfied inside one tenant.');
    } else if (inputs.boundaryFit === 'met') {
      reason('single-tenant-fit-declared', 'The declaration says one tenant can meet the mandatory requirements. No additional tenant is justified by acquisition, key, regulatory or autonomy labels alone.', 'topology', ['boundaryFit']);
    }
    if (inputs.ma === 'high') reason('acquisition-context-only', 'Frequent acquisitions suggest a time-bounded T5 transition review, not an automatic additional tenant or permanent topology.', 'topology', ['ma']);
    if (inputs.autonomy === 'high') reason('autonomy-context-only', 'Business autonomy is context; identify the specific unmet authority or isolation requirement before adding tenants.', 'topology', ['autonomy']);
    if (inputs.boundary === 'regulatory') reason('regulatory-label-not-boundary', 'A regulatory or legal-entity label does not establish incompatible tenant requirements. Document the obligation and whether scoped controls satisfy it.', 'topology', ['boundary', 'boundaryFit']);

    const sovereigntyApplies = ['keys', 'control'].includes(inputs.sovereignty);
    if (sovereigntyApplies) {
      need('sovereigntyEvidence', 'sovereignty');
      reason('sovereignty-needs-control-evidence', 'Local key or control-plane authority is a control requirement, not proof that another tenant is required. Check operators, processing, telemetry, keys and recovery in the actual deployment.', 'sovereignty', ['sovereignty', 'sovereigntyEvidence']);
      if (inputs.sovereigntyEvidence === 'unmet') {
        conflict('sovereignty-controls-unmet', 'The proposed operator, processing or key controls do not meet the declared sovereignty requirement; adding a tenant does not itself repair these controls.', 'sovereignty', ['sovereigntyEvidence']);
      }
    }

    const tier = inputs.survivability === 'unknown' ? null : `S${inputs.survivability}`;
    if (tier && tier !== 'S0') {
      need('localServices', 'connectivity');
      if (inputs.localServices === 'missing') conflict('outage-functions-missing', 'Required functions have no successful declared tests for the specified outage duration. A continuity tier is a requirement, not an availability guarantee.', 'connectivity', ['localServices', 'survivability']);
    }
    if (['S3', 'S4'].includes(tier)) {
      need('upstreamDependency', 'connectivity');
      reason('survivability-not-tenant-count', 'Independent or disconnected operation requires local capabilities and removal of relevant upstream dependencies. It does not automatically require another online Entra tenant.', 'connectivity', ['survivability']);
      if (inputs.upstreamDependency === 'present') conflict('upstream-dependency-conflict', 'Required independent functions still depend on upstream cloud, DNS, federation, MFA, network or SOC services. The declared S3/S4 requirement is not met.', 'connectivity', ['upstreamDependency', 'survivability']);
    }

    if (inputs.recoveryDependency === 'circular') {
      conflict('recovery-cycle', 'A declared recovery dependency cycle prevents trusted restoration. The assessed configuration is excluded until an independent recovery route is established and exercised.', 'recovery', ['recoveryDependency']);
    } else if (inputs.recoveryRequirement === 'independent' && inputs.recoveryDependency === 'shared') {
      conflict('recovery-shared-dependency', 'Recovery requires independent authority but the declared restore path relies on shared authority that may be unavailable or compromised.', 'recovery', ['recoveryRequirement', 'recoveryDependency']);
    }
    if (inputs.privilegePath === 'unacceptable') {
      conflict('unacceptable-privilege-path', 'A declared transitive privilege path crosses the required containment boundary. Tenant separation alone does not remove this path.', 'identity', ['privilegePath'], ['identity', 'topology']);
    }

    if (inputs.ot === 'yes') {
      ['localAuthority', 'safetyReview', 'otFallback'].forEach(field => need(field, 'safety', ['connectivity']));
      if (inputs.localAuthority === 'missing') conflict('ot-authority-missing', 'Safety-critical operation has no declared local operating authority. Cloud administration is not a substitute for that authority.', 'safety', ['localAuthority'], ['connectivity']);
      if (inputs.safetyReview === 'unsafe') conflict('ot-response-unsafe', 'The declared response or failure behavior is not safety-acceptable. Automated cyber isolation cannot override the local safety case.', 'safety', ['safetyReview'], ['connectivity']);
      if (inputs.otFallback === 'absent') conflict('ot-fallback-absent', 'Safety-critical functions have no tested local safe-operation or safe-shutdown fallback, including when enterprise services use S0.', 'safety', ['otFallback'], ['connectivity']);
      reason('ot-local-safety-required', 'OT safety is a separate local gate at every S tier; a tenant topology, online SOC or cloud-only response is not a safety case.', 'safety', ['ot']);
    }

    const readinessFields = ['staffing', 'monitoring', 'response', 'recoveryTest'];
    readinessFields.forEach(field => {
      need(field, 'readiness', ['readiness', 'topology']);
      if (inputs[field] === 'missing') conflict(`${slug(field)}-missing`, `${inputSchema[field].label} is declared missing. Establish and exercise this prerequisite before treating the assessed configuration as a candidate.`, 'readiness', [field], ['readiness', 'topology']);
    });
    if (inputs.maturity !== 'unknown') reason('maturity-label-not-evidence', 'A developing, managed or automated maturity label neither establishes nor disproves operating readiness; staffing, monitoring, response and recovery evidence are evaluated separately.', 'readiness', ['maturity']);
    if (validationErrors.length) {
      issue('insufficient-evidence', 'invalid-input', 'One or more assessment inputs are invalid or unrecognized. Correct the listed input errors; no approval-shaped defaults have been substituted.', 'topology', validationErrors.map(e => e.field).filter(Boolean), ['topology']);
    }

    const gateDefinitions = [
      ['identity-authority', inputs.boundary === 'unknown' ? null : inputs.boundary === 'identity', ['boundary', 'identityDependency']],
      ['sovereignty-authority', inputs.sovereignty === 'unknown' ? null : sovereigntyApplies, ['sovereignty', 'sovereigntyEvidence']],
      ['disconnected-dependencies', tier === null ? null : ['S3', 'S4'].includes(tier), ['survivability', 'localServices', 'upstreamDependency']],
      ['ot-safety', inputs.ot === 'unknown' ? null : inputs.ot === 'yes', ['ot', 'localAuthority', 'safetyReview', 'otFallback']],
      ['recovery-independence', true, ['recoveryRequirement', 'recoveryDependency']],
      ['privilege-containment', true, ['privilegePath']],
      ['operating-evidence', true, readinessFields]
    ];
    const gates = gateDefinitions.map(([id, applies, fields]) => {
      const related = applies === false ? [] : issues.filter(i => i.reason.fields.some(f => fields.includes(f)));
      return { id, applies, state: combine([...related.map(i => i.state), ...(applies === null ? ['insufficient-evidence'] : [])]), reasonCodes: related.map(i => i.reason.code) };
    });
    const state = combine(issues.map(i => i.state));
    const dimensions = {
      topology: { state: combine(dimensionStates.topology), value: topology, summary: topology === 'T3' ? 'Independent identity-authority pattern; tenant expansion is not established by this label.' : topology === 'T2' ? 'Separate tenant boundary for a declared requirement that one tenant cannot meet.' : topology === 'T1' ? 'One tenant with scoped controls, subject to all declared mandatory gates.' : 'No tenant pattern can be selected from the available boundary facts.' },
      identity: { state: combine(dimensionStates.identity), value: inputs.boundary, summary: inputs.boundary === 'identity' ? `Independent authentication and administrative authority is required. Proposed authority paths: ${inputs.identityDependency} (self-reported).` : 'Shared authority may be acceptable only within the declared containment requirements.' },
      sovereignty: { state: combine(dimensionStates.sovereignty), value: inputs.sovereignty, summary: 'Evaluate data processing, operators, keys, telemetry and legal scope independently of tenant count.' },
      connectivity: { state: combine(dimensionStates.connectivity), value: tier, pattern: tier === 'S4' ? 'T4' : null, summary: `${tier || 'Unknown tier'} describes required function and duration, not proven uptime or tenant count.${inputs.ot === 'yes' ? ' Local safety authority and fallback remain mandatory.' : ''}` },
      recovery: { state: combine(dimensionStates.recovery), value: inputs.recoveryRequirement, summary: 'Recovery authority and dependency declarations require independent review and a scoped restore exercise; no graph was inspected.' }
    };
    issues.filter(i => i.state === 'excluded').forEach(({ reason: item }) => {
      if (item.dimension === 'recovery' || item.code === 'unacceptable-privilege-path') {
        ['T1', 'T2', 'T3'].forEach(id => reject(id, item.dimension, item.code, item.message));
      } else if (item.dimension === 'connectivity' || item.dimension === 'safety') {
        reject(tier === 'S4' ? 'T4' : tier || 'local-operation', 'connectivity', item.code, item.message);
      } else if (topology) reject(topology, item.dimension, item.code, item.message);
    });
    issues.forEach(({ reason: item }) => check(`validate-${item.code}`, item.message, item.dimension, item.fields));
    check('review-authority-paths', 'Review the boundary register and authentication, administration, federation and transitive privilege paths with accountable owners.', 'identity', ['boundaryFit', 'identityDependency', 'privilegePath']);
    check('review-sovereignty-scope', 'Validate applicable legal obligations, product/cloud availability, processing locations, operator scope and key controls; do not infer sovereign-cloud parity.', 'sovereignty', ['sovereignty', 'sovereigntyEvidence']);
    check('exercise-outage-functions', 'Define the exact required functions and duration, then exercise identity, policy, keys, DNS, communications, telemetry and updates under an authorized upstream-outage scenario.', 'connectivity', ['survivability', 'localServices', 'upstreamDependency']);
    check('exercise-independent-recovery', 'Have owners review recovery dependencies and exercise an authorized restore with known-good identities, keys, configuration, communications and retained evidence.', 'recovery', ['recoveryRequirement', 'recoveryDependency', 'recoveryTest']);
    check('verify-operating-artifacts', 'Inspect staffing assignments, monitoring coverage, response runbooks and dated recovery exercise artifacts. A self-description is not inspected configuration.', 'readiness', readinessFields);
    if (inputs.ot === 'yes') check('validate-local-safety', 'Obtain local operational and safety-owner review of safe-state behavior, response authorization and tested fallback before any live OT action.', 'safety', ['localAuthority', 'safetyReview', 'otFallback']);

    return {
      contractVersion, state, advisoryOnly: true, evidenceBasis: 'self-reported', inputs, dimensions,
      readiness: { state, summary: 'All applicable prerequisites must be satisfied. Declarations are self-reported, not inspected or operationally verified. A candidate is not deployment approval; maturity labels are not readiness evidence.' },
      gates,
      assumptions: [
        'Inputs describe the proposed configuration and are self-reported; no tenant, configuration, authority graph, evidence file or live service has been inspected.',
        'The one-tenant fit declaration concerns actual mandatory requirements, not acquisition frequency, legal labels, key ownership or organizational preference alone.',
        'S0-S4 are continuity requirements; T1-T3 are tenant/authority patterns, T4 is a disconnected operating overlay, and T5 is a time-bounded transition pattern.',
        'No security risk, cost, availability guarantee, legal approval or safety certification is calculated.'
      ],
      reasons, unmetPrerequisites: issues.map(i => i.reason), rejectedAlternatives, nextValidationChecks, validationErrors
    };
  }

  return Object.freeze({ assess, inputSchema, contractVersion });
});
