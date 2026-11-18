(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const dataNode = $('#research-data');
  if (!dataNode) return;
  const data = JSON.parse(dataNode.textContent);

  const esc = (value = '') => String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const chips = ids => `<span class="source-chips">${ids.map(id => `<span class="source-chip">${esc(id)}</span>`).join('')}</span>`;

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
    $$('.tier-tab', tierTabs).forEach((b, i) => b.setAttribute('aria-selected', String(i === index)));
    tierPanel.innerHTML = `
      <div><p class="tier-id">${esc(tier.id)}</p><h3>${esc(tier.name)}</h3><p>${esc(tier.mission)}</p></div>
      <div class="tier-grid">
        <div><small>Identity</small><p>${esc(tier.identity)}</p></div>
        <div><small>Policy</small><p>${esc(tier.policy)}</p></div>
        <div><small>Security operations</small><p>${esc(tier.secops)}</p></div>
        <div><small>Recovery</small><p>${esc(tier.recovery)}</p></div>
      </div>`;
  }
  tierTabs.innerHTML = data.survivabilityTiers.map((tier, i) => `<button class="tier-tab" role="tab" aria-selected="${i === 0}" data-tier="${i}">${esc(tier.id)} · ${esc(tier.name)}</button>`).join('');
  tierTabs.addEventListener('click', e => {
    const button = e.target.closest('[data-tier]');
    if (button) renderTier(Number(button.dataset.tier));
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
      <article class="control-item">
        <span class="level ${c.level.toLowerCase()}">${esc(c.level)}</span>
        <span class="control-domain">${esc(c.id)} · ${esc(c.domain)}</span>
        <p class="control-text">${esc(c.text)}</p>
        <div class="control-meta"><span>${esc(c.provenance)}</span>${chips(c.sources)}</div>
      </article>`).join('') : '<p class="no-results">No controls match the selected filters.</p>';
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
  $('#provenance-legend').innerHTML = data.provenanceLegend.map(item => `<button type="button" title="${esc(item.meaning)}" data-class="${esc(item.class)}">${esc(item.class)}</button>`).join('');
  $('#provenance-legend').addEventListener('click', e => {
    const b = e.target.closest('[data-class]');
    if (!b) return;
    sourceClass.value = b.dataset.class;
    renderSources();
  });
  function renderSources() {
    const q = sourceSearch.value.trim().toLowerCase();
    const pclass = sourceClass.value;
    const sources = data.sources.filter(s => (pclass === 'all' || s.provenance === pclass) && (!q || `${s.id} ${s.title} ${s.evidence_use} ${s.provenance}`.toLowerCase().includes(q)));
    $('#source-list').innerHTML = sources.length ? sources.map(s => `
      <article class="source">
        <span class="source-id">${esc(s.id)}</span>
        <span class="provenance">${esc(s.provenance)}</span>
        <div><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a><p>${esc(s.evidence_use)}</p></div>
        <span class="source-date">${s.last_updated ? `Updated ${esc(s.last_updated)}` : ''}</span>
      </article>`).join('') : '<p class="no-results">No guidance matches the selected filters.</p>';
  }
  sourceSearch.addEventListener('input', renderSources);
  sourceClass.addEventListener('change', renderSources);
  renderSources();

  const form = $('#assessment-form');
  const result = $('#assessment-result');
  form.addEventListener('submit', e => {
    e.preventDefault();
    const f = new FormData(form);
    const boundary = f.get('boundary');
    const sovereignty = f.get('sovereignty');
    const survivability = Number(f.get('survivability'));
    const ma = f.get('ma');
    const autonomy = f.get('autonomy');
    const maturity = f.get('maturity');
    const ot = f.get('ot') === 'on';

    let primary = 'T1';
    const reasons = [];
    const disqualifiers = [];
    const companions = [];

    if (survivability >= 4) {
      primary = 'T4';
      reasons.push('S4 requires local identity, policy, security operations and recovery services for disconnected operation.');
      disqualifiers.push('A cloud-dependent control plane does not meet the required disconnected operating duration.');
    } else if (boundary === 'identity' || sovereignty === 'control') {
      primary = 'T3';
      reasons.push('The selected requirement calls for independent identity, recovery or local control-plane administration.');
      disqualifiers.push('Shared corporate identity administration does not satisfy the selected independence requirement.');
    } else if (survivability >= 3) {
      primary = 'T3';
      reasons.push('S3 independent operations require locally authoritative identity, policy, telemetry and recovery.');
    } else if (boundary === 'regulatory' || sovereignty === 'keys' || autonomy === 'high' || ma === 'high') {
      primary = 'T2';
      reasons.push('The selected regulatory, key-management, business-autonomy or acquisition requirements call for separate tenant control planes.');
    } else {
      reasons.push('No selected mandatory constraint requires a separate identity or control-plane authority.');
      reasons.push('Assess delegated administration, landing-zone policies, information protection and scoped operations before adding tenants.');
    }

    if (ma === 'high') companions.push('T5 · Acquisition transition zone');
    if (ot) {
      companions.push('OT environment with local safety procedures');
      reasons.push('Cyber response must be reviewed against physical-process safety and local operating authority.');
      if (survivability < 2) disqualifiers.push('A cloud-only OT response dependency requires a documented local fallback for safety-critical functions.');
    }
    if (survivability >= 2 && primary !== 'T4') companions.push(`S${survivability} local operating services`);

    const topology = data.topologies.find(t => t.id === primary);
    const warning = maturity === 'developing' && ['T2','T3','T4'].includes(primary)
      ? 'Operating-model gap: the developing option does not establish that the identity, policy, monitoring and recovery capabilities required by this pattern are available. Implement and test those capabilities before extending deployment.'
      : 'Implementation review: document administrative authority and dependencies, test failure scenarios and verify recovery procedures before deployment.';

    result.innerHTML = `
      <p class="result-kicker">Topology candidate</p>
      <h3>${esc(topology.name)}</h3>
      <p>${esc(topology.use_when)}</p>
      <div class="result-badges"><span class="result-badge">Primary ${esc(primary)}</span><span class="result-badge">Survivability S${survivability}</span>${companions.map(c => `<span class="result-badge">${esc(c)}</span>`).join('')}</div>
      <h4>Selection rationale</h4>
      <ul class="result-list">${reasons.map(r => `<li>${esc(r)}</li>`).join('')}</ul>
      ${disqualifiers.length ? `<h4>Constraints excluding alternatives</h4><ul class="result-list">${disqualifiers.map(r => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}
      <div class="result-warning"><strong>Maturity check.</strong> ${esc(warning)}</div>
      ${chips(topology.sources)}
    `;
  });

  const reveal = $$('.reveal');
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); }
    }), { threshold: .08 });
    reveal.forEach(el => observer.observe(el));
  } else reveal.forEach(el => el.classList.add('visible'));
})();
