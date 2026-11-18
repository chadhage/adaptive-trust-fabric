(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const dataNode = $('#research-data');
  if (!dataNode) return;
  let data;
  try { data = JSON.parse(dataNode.textContent); }
  catch {
    $('#assessment-result').textContent = 'The embedded research could not be read. No assessment is available; restore a valid published copy.';
    return;
  }

  const esc = (value = '') => String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const strings = value => Array.isArray(value) ? value.filter(v => typeof v === 'string') : [];
  const sourceById = new Map(data.sources.map(source => [source.id, source]));
  const safeUrl = value => {
    try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : null; }
    catch { return null; }
  };
  const link = (url, label) => {
    const href = safeUrl(url);
    return href ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(label)}<span class="sr-only"> (opens in a new tab)</span></a>` : `${esc(label)} <span class="evidence-note">(link unavailable)</span>`;
  };
  const recordLink = (id, label = id) => `<a class="source-chip" href="#${esc(id)}" data-record-id="${esc(id)}">${esc(label)}</a>`;
  const chips = ids => `<span class="source-chips">${strings(ids).map(id => {
    const source = sourceById.get(id);
    return source ? `<a class="source-chip" href="#source-${esc(id)}" data-record-id="source-${esc(id)}" title="${esc(`${source.title} · ${source.provenance} · ${source.evidence?.status || source.retrieval_status || 'documentary review not recorded'}`)}"><span class="sr-only">Source </span>${esc(id)}</a>` : `<span class="source-chip">${esc(id)} · source not recorded</span>`;
  }).join('')}</span>`;
  const guidanceList = (label, values, fallback = 'Not documented in this record; obtain scoped evidence before reliance.') => {
    const items = strings(values);
    return `<div class="guidance-group"><h5>${esc(label)}</h5>${items.length ? `<ul>${items.map(item => `<li>${esc(item)}</li>`).join('')}</ul>` : `<p class="evidence-note">${esc(fallback)}</p>`}</div>`;
  };
  function evidenceReview(evidence) {
    if (!evidence || typeof evidence !== 'object') return '<p class="evidence-note">Documentary review qualifications are not recorded in this version. No operational validation is established.</p>';
    const refs = Array.isArray(evidence.source_refs) ? evidence.source_refs.filter(ref => ref && typeof ref === 'object') : [];
    return `<div class="evidence-review">
      <p><strong>Documentary status:</strong> ${esc(evidence.status || 'unverified')} · <strong>Checked:</strong> ${esc(evidence.verified_on || 'not recorded')} · <strong>Operational validation:</strong> ${esc(evidence.operational_validation || 'not performed')}</p>
      <p class="evidence-note">A source check supports a narrow documentary proposition; it does not verify a deployment, license, safety case or sovereign-cloud availability.</p>
      ${guidanceList('Applicability', evidence.applicability)}
      ${guidanceList('Limitations and qualifications', evidence.limitations)}
      <p><strong>Confidence rationale:</strong> ${esc(evidence.confidence_rationale || 'Not documented; no calibrated probability is implied.')}</p>
      <div class="guidance-group"><h5>Reviewed passages and exact references</h5>${refs.length ? `<ul>${refs.map(ref => `<li>${link(ref.url, `${ref.source_id || 'Source'} · ${ref.section || 'section not recorded'}`)}<p>Revision: ${esc(ref.revision || 'not recorded')} · checked ${esc(ref.verified_on || 'not recorded')} · ${esc(ref.verification || 'not rechecked')}</p><p>${esc(ref.supports || 'Supported proposition not recorded.')}</p></li>`).join('')}</ul>` : '<p class="evidence-note">No exact reviewed passage is recorded; do not infer full-page verification.</p>'}</div>
    </div>`;
  }
  function controlGuidance(control) {
    const verification = control.verification || {};
    const exception = control.exception || {};
    return `<details class="control-guidance">
      <summary>Applicability, ownership and verification guidance</summary>
      <div class="guidance-body">
        <p><strong>Requirement origin:</strong> ${esc(control.requirement_origin || 'Framework requirement; not by itself a vendor or legal mandate.')}</p>
        <p><strong>Accountable role:</strong> ${esc(control.accountable_role || 'Not assigned in this record.')}</p>
        ${guidanceList('Exclusions / non-applicability', control.exclusions, 'No exclusion is documented; determine applicability explicitly.')}
        ${guidanceList('Dependencies', control.dependencies)}
        <p><strong>Failure behavior:</strong> ${esc(control.failure_behavior || 'Not documented; define and validate failure behavior before reliance.')}</p>
        <h4>Implementation verification · ${esc(verification.status || 'not performed')}</h4>
        <p>${esc(verification.method || 'No verification method is documented in this version.')}</p>
        ${guidanceList('Evidence to retain', verification.evidence)}
        ${guidanceList('Pass criteria', verification.pass)}
        ${guidanceList('Fail criteria', verification.fail)}
        <h4>Scoped exception and review</h4>
        <p><strong>Approval role:</strong> ${esc(exception.approval_role || 'Not recorded; no exception is granted by this page.')}</p>
        ${guidanceList('Exception conditions', exception.conditions)}
        <p><strong>Review interval:</strong> ${Number.isFinite(exception.review_interval_days) ? `${esc(exception.review_interval_days)} days` : 'Not recorded'}</p>
        ${guidanceList('Earlier review triggers', exception.review_triggers)}
        <h4>Provenance and documentary review</h4>
        ${evidenceReview(control.evidence)}
      </div>
    </details>`;
  }

  $('#thesis').textContent = data.thesis;
  $('#decision-hierarchy').innerHTML = data.decisionHierarchy.map(item => `<li>${esc(item)}</li>`).join('');

  const navToggle = $('.nav-toggle');
  const nav = $('#site-nav');
  navToggle?.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(open));
  });
  $$('a', nav).forEach(a => a.addEventListener('click', () => {
    nav.classList.remove('open');
    navToggle?.setAttribute('aria-expanded', 'false');
  }));

  const tierTabs = $('#tier-tabs');
  const tierPanel = $('#tier-panel');
  function renderTier(index) {
    const tier = data.survivabilityTiers[index];
    if (!tier) return;
    $$('.tier-tab', tierTabs).forEach((button, i) => {
      button.setAttribute('aria-selected', String(i === index));
      button.tabIndex = i === index ? 0 : -1;
    });
    tierPanel.setAttribute('aria-labelledby', `tier-tab-${tier.id}`);
    tierPanel.innerHTML = `
      <div><p class="tier-id">${esc(tier.id)}</p><h3>${esc(tier.name)}</h3><p>${esc(tier.mission)}</p></div>
      <div class="tier-grid">
        <div><small>Identity</small><p>${esc(tier.identity)}</p></div>
        <div><small>Policy</small><p>${esc(tier.policy)}</p></div>
        <div><small>Security operations</small><p>${esc(tier.secops)}</p></div>
        <div><small>Recovery</small><p>${esc(tier.recovery)}</p></div>
      </div>`;
  }
  tierTabs.innerHTML = data.survivabilityTiers.map((tier, i) => `<button type="button" class="tier-tab" id="tier-tab-${esc(tier.id)}" role="tab" aria-controls="tier-panel" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-tier="${i}">${esc(tier.id)} · ${esc(tier.name)}</button>`).join('');
  tierTabs.addEventListener('click', e => {
    const button = e.target.closest('[data-tier]');
    if (button) renderTier(Number(button.dataset.tier));
  });
  tierTabs.addEventListener('keydown', e => {
    const button = e.target.closest('[data-tier]');
    if (!button || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const count = data.survivabilityTiers.length;
    const current = Number(button.dataset.tier);
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? count - 1 : (current + (e.key === 'ArrowRight' ? 1 : -1) + count) % count;
    renderTier(next);
    $(`[data-tier="${next}"]`, tierTabs).focus();
  });
  renderTier(0);

  $('#topology-grid').innerHTML = data.topologies.map(t => `
    <article class="topology-card reveal">
      <span class="card-id">${esc(t.id)}</span>
      <h3>${esc(t.name)}</h3>
      <small>Use when</small><p>${esc(t.use_when)}</p>
      <small>Reject when</small><p>${esc(t.reject_when)}</p>
      ${chips(t.sources)}
    </article>`).join('');

  const controlDomain = $('#control-domain');
  const controlLevel = $('#control-level');
  const domains = [...new Set(data.normativeControls.map(c => c.domain))].sort();
  controlDomain.insertAdjacentHTML('beforeend', domains.map(d => `<option>${esc(d)}</option>`).join(''));
  function renderControls() {
    const domain = controlDomain.value;
    const level = controlLevel.value;
    const items = data.normativeControls.filter(c => (domain === 'all' || c.domain === domain) && (level === 'all' || c.level === level));
    $('#control-list').innerHTML = items.length ? items.map(c => `
      <article class="control-item" id="control-${esc(c.id)}" tabindex="-1" aria-label="${esc(`${c.id} · ${c.domain} control`)}">
        <span class="level ${c.level.toLowerCase()}">${esc(c.level)}</span>
        <span class="control-domain">${esc(c.id)} · ${esc(c.domain)}</span>
        <p class="control-text">${esc(c.text)}</p>
        <div class="control-meta"><span>${esc(c.provenance)}</span>${chips(c.sources)}</div>
        ${controlGuidance(c)}
      </article>`).join('') : '<p class="no-results">No controls match the selected filters.</p>';
    $('#control-count').textContent = `${items.length} of ${data.normativeControls.length} controls shown. Documentary guidance is not an executed verification.`;
  }
  controlDomain.addEventListener('change', renderControls);
  controlLevel.addEventListener('change', renderControls);
  renderControls();

  $('#challenge-list').innerHTML = data.adversarialFindings.map((item, i) => `
    <article class="challenge reveal">
      <p class="hypothesis">REVIEW ${String(i + 1).padStart(2, '0')}</p>
      <h3>${esc(item.position)}</h3>
      <p>${esc(item.test)}</p>
      <p class="verdict"><strong>Assessment:</strong> ${esc(item.result)}</p>
      ${chips(item.sources)}
    </article>`).join('');

  $('#roadmap-list').innerHTML = data.roadmap.map(item => `
    <article class="phase reveal"><div class="phase-card">
      <p class="phase-time">${esc(item.phase)}</p>
      <h3>${esc(item.outcome)}</h3>
      <ul>${item.actions.map(a => `<li>${esc(a)}</li>`).join('')}</ul>
    </div></article>`).join('');

  const sourceSearch = $('#source-search');
  const sourceClass = $('#source-class');
  const classes = [...new Set(data.sources.map(s => s.provenance))];
  sourceClass.insertAdjacentHTML('beforeend', classes.map(c => `<option>${esc(c)}</option>`).join(''));
  $('#provenance-legend').innerHTML = data.provenanceLegend.map(item => `<button type="button" title="${esc(item.meaning)}" aria-pressed="false" data-class="${esc(item.class)}">${esc(item.class)}<span class="sr-only">: ${esc(item.meaning)}</span></button>`).join('');
  $('#provenance-legend').addEventListener('click', e => {
    const b = e.target.closest('[data-class]');
    if (!b) return;
    sourceClass.value = b.dataset.class;
    renderSources();
  });
  function renderSources() {
    const q = sourceSearch.value.trim().toLowerCase();
    const pclass = sourceClass.value;
    const sources = data.sources.filter(s => (pclass === 'all' || s.provenance === pclass) && (!q || `${s.id} ${s.title} ${s.evidence_use} ${s.provenance} ${s.evidence?.status || ''}`.toLowerCase().includes(q)));
    $('#source-list').innerHTML = sources.length ? sources.map(s => `
      <article class="source" id="source-${esc(s.id)}" tabindex="-1" aria-label="${esc(`${s.id} · ${s.title}`)}">
        <span class="source-id">${esc(s.id)}</span>
        <span class="provenance">${esc(s.provenance)}</span>
        <div>${link(s.url, s.title)}<p>${esc(s.evidence_use)}</p>
          <details class="source-review"><summary>Provenance and review qualifications</summary>
            <p><strong>Retrieval:</strong> ${esc(s.retrieval_status || 'not recorded')} · <strong>Accessed:</strong> ${esc(s.accessed || 'not recorded')}</p>
            ${evidenceReview(s.evidence)}
          </details>
        </div>
        <span class="source-date">${s.last_updated ? `Publisher date ${esc(s.last_updated)}` : 'Publisher date not recorded'}</span>
      </article>`).join('') : '<p class="no-results">No guidance matches the selected filters.</p>';
    $('#source-count').textContent = `${sources.length} of ${data.sources.length} sources shown.`;
    $$('[data-class]', $('#provenance-legend')).forEach(button => button.setAttribute('aria-pressed', String(button.dataset.class === pclass)));
  }
  sourceSearch.addEventListener('input', renderSources);
  sourceClass.addEventListener('change', renderSources);
  renderSources();

  $('#claim-list').innerHTML = data.claims.map(claim => `
    <article class="claim-record" id="claim-${esc(claim.id)}" tabindex="-1" aria-label="${esc(`${claim.id} · supporting claim`)}">
      <h4>${esc(claim.id)} · ${esc(claim.provenance)}</h4><p>${esc(claim.claim)}</p>
      <p class="evidence-note">Qualitative confidence: ${esc(claim.confidence || 'not recorded')}; not a calibrated probability or an implementation test.</p>
      ${chips(claim.sources)}
      <details><summary>Claim scope and documentary evidence</summary>${evidenceReview(claim.evidence)}</details>
    </article>`).join('');

  function navigateRecord(id, updateHash = true) {
    if (id.startsWith('source-') && sourceById.has(id.slice(7))) {
      if (sourceSearch.value || sourceClass.value !== 'all') {
        sourceSearch.value = '';
        sourceClass.value = 'all';
        renderSources();
      }
    } else if (id.startsWith('control-') && data.normativeControls.some(control => id === `control-${control.id}`)) {
      if (controlDomain.value !== 'all' || controlLevel.value !== 'all') {
        controlDomain.value = 'all';
        controlLevel.value = 'all';
        renderControls();
      }
    } else if (!data.claims.some(claim => id === `claim-${claim.id}`)) return;
    const target = document.getElementById(id);
    if (!target) return;
    for (let details = target.parentElement?.closest('details'); details; details = details.parentElement?.closest('details')) details.open = true;
    if (updateHash) window.location.hash = id;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'start' });
  }
  document.addEventListener('click', e => {
    const anchor = e.target.closest('[data-record-id]');
    if (!anchor || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    navigateRecord(anchor.dataset.recordId);
  });
  const followHash = () => {
    try { navigateRecord(decodeURIComponent(window.location.hash.slice(1)), false); }
    catch { /* An invalid URL fragment must not stop the offline reference. */ }
  };
  window.addEventListener('hashchange', followHash);
  followHash();

  const form = $('#assessment-form');
  const result = $('#assessment-result');
  const assessmentStatus = $('#assessment-status');
  const stateLabels = { candidate: 'Candidate for design review', 'insufficient-evidence': 'Insufficient evidence', excluded: 'Assessed configuration excluded' };
  const shortState = { candidate: 'Candidate', 'insufficient-evidence': 'Insufficient evidence', excluded: 'Excluded' };
  const dimensionLabels = { topology: 'Tenant / authority pattern', identity: 'Identity and administration', sovereignty: 'Sovereignty controls', connectivity: 'Connectivity and survivability', recovery: 'Recovery independence' };
  const dimensionValues = { delegated: 'Delegated administration', regulatory: 'Regulatory / legal-entity controls', identity: 'Independent identity authority', residency: 'Residency / policy controls', keys: 'Local key / operator controls', control: 'Local control-plane authority', 'shared-acceptable': 'Shared recovery authority acceptable', independent: 'Independent recovery authority required', unknown: 'Unknown' };
  const gateLabels = { 'identity-authority': 'Independent identity authority', 'sovereignty-authority': 'Local operator, processing and key authority', 'disconnected-dependencies': 'Independent / disconnected dependencies', 'ot-safety': 'Local OT safety and response', 'recovery-independence': 'Trusted recovery dependencies', 'privilege-containment': 'Transitive privilege containment', 'operating-evidence': 'Operating prerequisites' };
  const reasonLinks = item => `<div class="reason-links">${chips(item.sourceIds)}<span class="source-chips">${strings(item.controlIds).map(id => recordLink(`control-${id}`, id)).join('')}${strings(item.claimIds).map(id => recordLink(`claim-${id}`, id)).join('')}</span></div>`;
  const reasonList = items => `<ul class="result-list">${items.map(item => `<li data-reason-code="${esc(item.code)}"><p>${esc(item.message)}</p>${reasonLinks(item)}</li>`).join('')}</ul>`;

  function syncConditionalFields() {
    const value = name => form.elements.namedItem(name).value;
    const conditions = {
      identity: value('boundary') === 'identity',
      sovereignty: ['keys', 'control'].includes(value('sovereignty')),
      outage: ['1', '2', '3', '4'].includes(value('survivability')),
      independent: ['3', '4'].includes(value('survivability')),
      ot: value('ot') === 'yes'
    };
    $$('[data-condition]', form).forEach(label => {
      const active = conditions[label.dataset.condition];
      label.hidden = !active;
      $('select', label).disabled = !active;
    });
  }
  syncConditionalFields();
  form.addEventListener('change', () => {
    syncConditionalFields();
    if (result.dataset.evaluated) {
      $('#assessment-stale').hidden = false;
      assessmentStatus.textContent = 'Inputs changed. The displayed assessment is previous; evaluate again.';
    }
  });
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (!window.ATFAssessment) {
      result.textContent = 'The local assessment engine is unavailable. No candidate can be evaluated; restore assets/assessment.js from the published copy.';
      assessmentStatus.textContent = 'Assessment unavailable.';
      return;
    }
    const assessment = window.ATFAssessment.assess(Object.fromEntries(new FormData(form)));
    const selected = data.topologies.find(topology => topology.id === assessment.dimensions.topology.value);
    result.dataset.evaluated = 'true';
    result.dataset.state = assessment.state;
    result.dataset.topology = assessment.dimensions.topology.value || '';
    result.innerHTML = `
      <p class="result-kicker">Advisory · self-reported declarations</p>
      <h3 id="assessment-result-title" tabindex="-1">${esc(stateLabels[assessment.state])}</h3>
      <p class="result-stale" id="assessment-stale" hidden><strong>Previous assessment:</strong> inputs have changed. Evaluate again before relying on these results.</p>
      <p>Configuration and artifacts were not inspected. A candidate is not deployment approval; an excluded state applies to the declared configuration, not every possible implementation of a pattern.</p>
      ${assessment.validationErrors.length ? `<div class="result-warning"><h4>Invalid inputs</h4><ul>${assessment.validationErrors.map(error => `<li>${esc(error.message)}</li>`).join('')}</ul></div>` : ''}
      <p class="result-topology"><strong>${selected ? `${esc(selected.id)} · ${esc(selected.name)}` : 'No tenant pattern selected'}</strong></p>
      <dl class="result-dimensions">${Object.entries(assessment.dimensions).map(([name, dimension]) => `
        <div data-dimension="${esc(name)}" data-state="${esc(dimension.state)}">
          <dt>${esc(dimensionLabels[name])}</dt>
          <dd><strong>${esc(dimensionValues[dimension.value] || dimension.value || 'Unknown')} · ${esc(shortState[dimension.state])}${dimension.pattern ? ` · ${esc(dimension.pattern)} operating overlay` : ''}</strong><p>${esc(dimension.summary)}</p></dd>
        </div>`).join('')}</dl>
      <div class="result-warning"><h4>Operating prerequisites · ${esc(shortState[assessment.readiness.state])}</h4><p>${esc(assessment.readiness.summary)}</p></div>
      <h4>Unmet prerequisites · ${assessment.unmetPrerequisites.length}</h4>
      ${assessment.unmetPrerequisites.length ? reasonList(assessment.unmetPrerequisites) : '<p>No unknown or failed mandatory prerequisite was declared. Human verification is still required.</p>'}
      <details class="result-detail" open><summary>Selection reasons · ${assessment.reasons.length}</summary>${reasonList(assessment.reasons)}</details>
      <details class="result-detail"><summary>Mandatory gate evaluation</summary><ul class="result-list">${assessment.gates.map(gate => `<li data-gate="${esc(gate.id)}"><strong>${esc(gateLabels[gate.id])}:</strong> ${gate.applies === false ? 'Not applicable within the declared scope' : esc(shortState[gate.state])}${gate.applies === null ? ' · applicability unknown' : ''}</li>`).join('')}</ul></details>
      <details class="result-detail"><summary>Assumptions and limits</summary><ul class="result-list">${assessment.assumptions.map(item => `<li>${esc(item)}</li>`).join('')}</ul></details>
      <details class="result-detail"${assessment.rejectedAlternatives.length ? ' open' : ''}><summary>Rejected configurations / alternatives · ${assessment.rejectedAlternatives.length}</summary>${assessment.rejectedAlternatives.length ? `<ul class="result-list">${assessment.rejectedAlternatives.map(alternative => `<li><strong>${esc(alternative.id)} · ${esc(alternative.dimension)} · excluded:</strong> ${esc(alternative.message)}</li>`).join('')}</ul>` : '<p>No alternative is labelled impossible merely because it was not selected. Compare feasible options after validating requirements.</p>'}</details>
      <details class="result-detail"><summary>Next validation checks · ${assessment.nextValidationChecks.length}</summary>${reasonList(assessment.nextValidationChecks)}</details>
    `;
    assessmentStatus.textContent = `${stateLabels[assessment.state]}. ${assessment.unmetPrerequisites.length} unmet prerequisites. Self-reported inputs; not deployment approval.`;
    $('#assessment-result-title').focus({ preventScroll: true });
    result.scrollIntoView({ block: 'start' });
  });

  const reveal = $$('.reveal');
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); }
    }), { threshold: .08 });
    reveal.forEach(el => observer.observe(el));
  } else reveal.forEach(el => el.classList.add('visible'));
})();
