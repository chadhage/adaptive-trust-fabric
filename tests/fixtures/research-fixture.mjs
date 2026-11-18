export function researchFixture() {
  const sourceIds = [
    ...Array.from({ length: 26 }, (_, i) => `MS-${String(i + 1).padStart(2, '0')}`),
    ...Array.from({ length: 6 }, (_, i) => `STD-${String(i + 1).padStart(2, '0')}`), 'RES-01',
  ];
  const evidence = id => ({
    status: 'unverified', verified_on: null,
    source_refs: [{
      source_id: id, url: 'https://example.org/document', section: 'Scope',
      revision: null, verified_on: null, verification: 'not-rechecked',
      supports: 'Illustrative documentary support, not an executed test.',
    }],
    applicability: ['Synthetic fixture'], limitations: ['Not operational evidence'],
    confidence_rationale: 'A deliberately synthetic validation fixture.',
    operational_validation: 'not-performed',
  });
  return {
    meta: {
      title: 'Synthetic research fixture', subtitle: 'Validator tests only', version: 'test',
      disclaimer: 'Not implementation guidance', research_cutoff: '2026-11-17', generated: '2026-11-18',
    },
    thesis: 'Do not infer operational assurance from documentary validation.',
    provenanceLegend: [
      'Microsoft Explicit', 'External Standard', 'Research Supported',
      'Derived Architectural Position', 'Open/Contested',
    ].map(value => ({ class: value, meaning: 'Fixture provenance definition.' })),
    sources: sourceIds.map(id => ({
      id, title: 'Illustrative source', url: 'https://example.org/document',
      provenance: 'External Standard', retrieval_status: 'Not rechecked', accessed: '2026-11-17',
      evidence_use: 'Fixture evidence shape', evidence: evidence(id),
    })),
    claims: Array.from({ length: 18 }, (_, i) => ({
      id: `C-${String(i + 1).padStart(2, '0')}`, claim: 'Illustrative claim',
      provenance: 'Derived Architectural Position', sources: ['MS-01'],
      confidence: 'Low', evidence: evidence('MS-01'),
    })),
    normativeControls: Array.from({ length: 26 }, (_, i) => ({
      id: `N-${String(i + 1).padStart(2, '0')}`, level: 'MUST', domain: 'Boundaries',
      text: `Document identity & recovery dependencies for control ${i + 1}.`,
      provenance: 'Derived Architectural Position', sources: ['MS-01'], evidence: evidence('MS-01'),
      requirement_origin: 'framework', accountable_role: 'Architecture owner',
      exclusions: ['Document approved exclusions'], dependencies: ['An accountable owner'],
      failure_behavior: 'Reject unverified independence.',
      verification: {
        status: 'not-performed', method: 'Review a scoped dependency register.',
        evidence: ['Dependency register'], pass: ['All required dependencies are recorded'],
        fail: ['An authority dependency is unknown'],
      },
      exception: {
        approval_role: 'Risk owner', conditions: ['A scoped, expiring exception'],
        review_interval_days: 90, review_triggers: ['Identity dependency change'],
      },
    })),
    survivabilityTiers: Array.from({ length: 5 }, (_, i) => ({
      id: `S${i}`, name: 'Illustrative tier', mission: 'Scoped mission', identity: 'Scoped identity',
      policy: 'Scoped policy', secops: 'Scoped monitoring', recovery: 'Scoped recovery',
    })),
    topologies: Array.from({ length: 5 }, (_, i) => ({
      id: `T${i + 1}`, name: 'Illustrative topology', use_when: 'Requirements are satisfied',
      reject_when: 'A mandatory requirement fails', sources: ['MS-01'],
    })),
    hardConstraints: ['Identity authority must be established.'],
    decisionHierarchy: ['Mandatory requirements'], decisionDimensions: ['Identity'],
    adversarialFindings: Array.from({ length: 10 }, () => ({
      position: 'A proposed assumption', test: 'Review the dependency', result: 'Unverified', sources: ['MS-01'],
    })),
    roadmap: [{ phase: 'Prerequisites', outcome: 'Known authority', actions: ['Review the register'] }],
    researchMethod: {
      standard: 'Synthetic fixture only', mandatoryPractices: ['Qualify claims'],
      limitations: ['No live validation'],
    },
    evidenceContract: { scope: 'Synthetic fixture evidence' },
    sourceMaintenance: { owner: 'Research maintainer' },
    capabilityMatrix: Array.from({ length: 10 }, (_, i) => ({
      id: `K${String(i + 1).padStart(2, '0')}`, name: 'Illustrative capability',
      status: 'Unverified', scope: {
        identities: ['Scoped identities'], clouds: 'Verify cloud support',
        licensing: 'Verify licensing', availability: 'Verify current availability',
      },
      supported: ['Illustrative behavior'], not_supported: ['No operational assurance'],
      dependencies: ['An identity provider'], failure_behavior: 'Do not assume independence',
      implementation_checks: ['Verify authority'], sources: ['MS-01'], evidence: evidence('MS-01'),
    })),
  };
}
