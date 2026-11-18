function readerRuntime() {
  const data = JSON.parse(document.getElementById("reference-data").textContent);
  const node = (tag, text, className) => {
    const result = document.createElement(tag);
    if (text !== undefined) result.textContent = text;
    if (className) result.className = className;
    return result;
  };
  const list = values => {
    const result = node("ul");
    for (const value of values ?? []) result.append(node("li", typeof value === "string" ? value : JSON.stringify(value)));
    return result;
  };
  const pre = value => node("pre", typeof value === "string" ? value : JSON.stringify(value, null, 2));
  const paragraph = (label, text) => {
    const result = node("p");
    result.append(node("strong", `${label}: `), document.createTextNode(text ?? "Not observed"));
    return result;
  };
  const details = (title, ...children) => {
    const result = node("details");
    result.append(node("summary", title), ...children);
    return result;
  };
  const link = (text, href) => {
    const result = node("a", text);
    result.href = href;
    return result;
  };
  const table = (headers, rows) => {
    const wrapper = node("div", undefined, "table-wrap");
    const result = node("table");
    const head = node("thead");
    const headingRow = node("tr");
    for (const label of headers) {
      const cell = node("th", label);
      cell.scope = "col";
      headingRow.append(cell);
    }
    head.append(headingRow);
    const body = node("tbody");
    for (const row of rows) {
      const tr = node("tr");
      for (const value of row) {
        const td = node("td");
        td.append(value instanceof Node ? value : document.createTextNode(String(value ?? "—")));
        tr.append(td);
      }
      body.append(tr);
    }
    result.append(head, body);
    wrapper.append(result);
    return wrapper;
  };
  const badge = text => node("span", text, "badge");
  function renderCase(record) {
    const target = document.getElementById(`case-${record.id}-body`);
    const state = node("p");
    state.append(badge("SYNTHETIC DESIGN"), badge(record.scope.survivabilityTier), badge(record.validation.overallStatus), badge(`Assessment: ${record.decision.assessmentOutput.state}`));
    target.append(state, node("p", record.scope.description), paragraph("Assumptions, not observed facts", record.scope.assumptions.join(" ")));
    target.append(details("Scope and named accountable roles", pre(record.owners), paragraph("Out of scope", record.scope.outOfScope.join(" "))));
    target.append(details("Requirements — declared, verified, unknown and failed are distinct",
      table(["Requirement / accountable role", "Status", "Acceptance and unknowns"], record.requirements.map(item => [
        `${item.id} — ${item.text}\nOwner: ${item.owner}`,
        item.status,
        (() => { const cell = node("div"); cell.append(node("strong", "Acceptance"), list(item.acceptance), node("strong", "Unknown / untested"), list(item.unknowns)); return cell; })()
      ]))
    ));
    target.append(details("Eight-type boundary register", table(["Boundary", "Contains / owner", "Crossing rule"], record.boundaries.map(item => [
      `${item.id} — ${item.type}`, `${item.contains.join("; ")}\nOwner: ${item.owner}`, item.crossingRule
    ]))));
    const graphLinks = node("p", undefined, "downloads");
    for (const kind of ["authority", "recovery"]) {
      graphLinks.append(link(`${kind} SVG`, `diagrams/${record.id.toLowerCase()}-${kind}.svg`), " · ",
        link(`${kind} editable Excalidraw`, `diagrams/${record.id.toLowerCase()}-${kind}.excalidraw`), "  ");
    }
    target.append(graphLinks);
    const authorityLabels = new Map(record.authorityGraph.nodes.map(item => [item.id, item.label]));
    target.append(details("Authority: from exercises permission over to — credentials, delegation and revocation",
      table(["Directed authority edge", "Permission / credential", "Delegation / revocation"], record.authorityGraph.edges.map(edge => [
        `${edge.id}\n${authorityLabels.get(edge.from)} → ${authorityLabels.get(edge.to)}\n${edge.status}`,
        `${edge.permission}\nCredential: ${edge.credential}`,
        `${edge.delegation}\nRevoke by ${edge.revocation.actor}: ${edge.revocation.mechanism}\nLimit: ${edge.revocation.latencyLimit}\nResidual: ${edge.revocation.residualAccess}`
      ])),
      node("h4", "Indirect authority paths"), list(record.authorityGraph.indirectPaths.map(item => `${item.nodeIds.join(" → ")}: ${item.meaning}`)),
      node("h4", "Forbidden paths"), list(record.authorityGraph.forbiddenPaths)
    ));
    const recoveryLabels = new Map(record.recoveryGraph.nodes.map(item => [item.id, item.label]));
    target.append(details("Recovery: from depends on to — independent anchors and explicit rejected cycles",
      paragraph("Direction", "Arrows point from the component being recovered to its dependency, not from an administrator to a target."),
      paragraph("Rejected edge IDs", record.recoveryGraph.rejectedEdgeIds.join(", ")),
      table(["Directed recovery dependency", "Dependency / failure", "Alternative"], record.recoveryGraph.edges.map(edge => [
        `${edge.id}${record.recoveryGraph.rejectedEdgeIds.includes(edge.id) ? " — REJECTED DESIGN" : ""}\n${recoveryLabels.get(edge.from)} → ${recoveryLabels.get(edge.to)}`,
        `${edge.dependency}\nFailure: ${edge.failureEffect}`, edge.alternative
      ])),
      node("h4", "Independent anchors and remaining dependencies"), pre(record.recoveryGraph.independentAnchors),
      node("h4", "Cycles — design mitigation is not tested removal"), pre(record.recoveryGraph.cycles),
      node("h4", "Restoration order"), list(record.recoveryGraph.restorationOrder)
    ));
    target.append(details("All 26 controls — applicability is not compliance",
      table(["Control / applicability", "Specific rationale", "Owner / required evidence"], record.controlApplicability.map(item => [
        `${item.controlId}\n${item.applicability}\n${item.implementationStatus}`, item.rationale,
        `${item.owner}\n${item.requirementRefs.join(", ")}\n${item.requiredEvidence.join("; ")}`
      ]))
    ));
    target.append(details("Selected / rejected alternatives and final shared-engine assessment",
      paragraph("Decision", `${record.decision.status}; ${record.decision.selectedAlternativeId}`), pre(record.decision.dimensions),
      table(["Alternative", "Disposition / reason", "Tradeoffs"], record.decision.alternatives.map(item => [
        `${item.id} — ${item.name}`, `${item.disposition}: ${item.reason}`, list(item.tradeoffs)
      ])),
      node("h4", "Unmet prerequisites"), list(record.decision.unmetPrerequisites),
      node("h4", "Shared-engine input — self-reported, unknown facts retained"), pre(record.decision.assessmentInput),
      node("h4", "Exact shared-engine output — not deployment approval"), pre(record.decision.assessmentOutput),
      node("h4", "Reconsider when"), list(record.decision.reconsiderWhen)
    ));
    target.append(details("Expected versus observed validation — scope is part of every result",
      table(["Scenario / scope", "Expected", "Observed / status"], record.validation.scenarios.map(item => [
        `${item.id} — ${item.runbookRef}\n${item.scope}`, list(item.expected),
        `${item.status}\n${item.observed.length ? item.observed.join("; ") : "NOT EXECUTED — no observations"}\n${item.evidenceRefs.join(", ")}`
      ])), node("h4", "Limitations"), list(record.validation.limitations)
    ));
    const facts = details("Documentary source facts — not operational evidence");
    for (const fact of record.sourceFacts) {
      const refs = node("ul");
      for (const ref of fact.evidence.source_refs) {
        const li = node("li");
        li.append(link(`${ref.source_id}: ${ref.section} (${ref.verification}, ${ref.verified_on ?? "date unknown"})`, ref.url), document.createTextNode(` — ${ref.supports}`));
        refs.append(li);
      }
      facts.append(details(`${fact.id} — ${fact.fact}`, paragraph("Scope limit", fact.scopeLimit), paragraph("Evidence state", `${fact.evidence.status}; operational_validation=${fact.evidence.operational_validation}`), refs));
    }
    target.append(facts, link("Open machine-readable case JSON", `cases/${record.id.toLowerCase()}.json`));
  }
  function renderRunbook(record) {
    const target = document.getElementById(`runbook-${record.id}-body`);
    target.append(node("p", record.purpose), paragraph("Delivery status", record.implementationStatus),
      paragraph("Operational validation", record.validation.status), paragraph("Critical limitation", record.scope.notAClaim),
      paragraph("Permitted target", record.scope.permittedTarget),
      details("Excluded operations and accountable roles", list(record.scope.excluded), pre(record.owners)),
      details("Prerequisites — approval and operational evidence are not assumed",
        table(["Prerequisite", "Current state", "Required evidence"], record.prerequisites.map(item => [item.requirement, item.status, item.evidence]))),
      details("Dependencies and failure behavior", table(["Dependency", "Required behavior"], record.dependencyLimits.map(item => [item.dependency, item.failureBehavior])))
    );
    if (record.coverageMatrix) target.append(details("Object, retention and relationship recovery gaps",
      table(["Object / relationship", "Planned method", "Gap / validation"], record.coverageMatrix.map(item => [item.objectOrRelation, item.plannedMethod, `${item.gap}\n${item.validationStatus}`]))));
    const steps = node("ol", undefined, "steps");
    for (const step of record.steps) {
      const item = node("li");
      item.append(node("h4", `${step.id} — ${step.actorRole}`), node("p", step.action),
        paragraph("Expected", step.expected), paragraph("On failure", step.onFailure), paragraph("Retain", step.evidence.join("; ")));
      steps.append(item);
    }
    target.append(details("Execution steps — do not execute live operations without new explicit approval", steps),
      details("Rollback and safe end state", paragraph("Triggers", record.rollback.trigger.join("; ")), list(record.rollback.steps), node("h4", "Rollback acceptance"), list(record.rollback.acceptance)),
      details("Pass, fail and evidence acceptance", node("h4", "Pass"), list(record.passCriteria), node("h4", "Fail"), list(record.failCriteria), node("h4", "Evidence requirements"), list(record.evidenceRequirements)),
      details("Observed evidence and remaining blockers", pre(record.validation)),
      details("Source/control/capability scope and review triggers", pre(record.sourceReferences), paragraph("Controls", record.relatedControls.join(", ")), pre(record.review)),
      link("Open machine-readable runbook JSON", data.runbookPaths[record.id])
    );
  }
  for (const record of data.cases) renderCase(record);
  for (const record of data.runbooks) renderRunbook(record);
  const authorization = document.getElementById("authorization-body");
  authorization.append(paragraph("Status", data.authorization.status),
    paragraph("Recorded scope", data.authorization.localSyntheticPermission.basis),
    node("h3", "Allowed locally"), list(data.authorization.localSyntheticPermission.allowed),
    node("h3", "Not authorized"), list(data.authorization.localSyntheticPermission.prohibited),
    table(["Exercise", "Status", "Required approvals / target scope"], data.authorization.requestedExercises.map(item => [
      `${item.id} — ${item.purpose}`, item.status, `${item.requiredApprovalRoles.join(", ")}\nNo authorized live targets.`
    ])),
    details("Machine-readable request and approval-response template — empty targets grant no permission", pre(data.authorization)),
    link("Authorization request JSON", "evidence/authorization-request.json"), " · ",
    link("Unexecuted evidence template", "evidence/execution-template.json")
  );
  const evidence = document.getElementById("evidence-body");
  evidence.append(paragraph("Evidence boundary", "Passing local checks establish only the functions they execute. A04 and all operational Entra/AD/PHS/OT acceptance remain blocked; a negative fixture is not a real outage."),
    paragraph("Generated record time", data.executions.generatedAt ?? "Not yet executed"));
  for (const record of data.executions.records) {
    const content = details(`${record.id} — ${record.status}`);
    content.append(paragraph("Scope", record.scope ?? record.scopeKind), paragraph("Expected", record.expected?.join?.("; ") ?? record.expected));
    if (record.checks) content.append(table(["Check / exact scope", "Expected", "Observed / status"], record.checks.map(item => [item.id + " — " + item.scope, JSON.stringify(item.expected), `${JSON.stringify(item.observed)}\n${item.status}`])));
    else if (record.observed?.length) content.append(pre(record.observed));
    else content.append(node("p", "NOT EXECUTED — no observed live evidence.", "notice"));
    if (record.limitations) content.append(node("h4", "Limitations"), list(record.limitations));
    content.append(details("Complete machine record", pre(record)));
    evidence.append(content);
  }
  evidence.append(link("Execution ledger JSON", "evidence/executions.json"), " · ",
    link("Offline reader and SVG browser observations", "evidence/browser-checks.json"), " · ",
    link("Reusable review schema", "schema/review-record.schema.json"), " · ",
    link("Four requirement-state examples", "schema/requirement-state-examples.json"), " · ",
    link("Stable record API", "contract.json"));
  document.getElementById("theme-toggle").addEventListener("click", () => {
    document.documentElement.dataset.theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  });
  document.getElementById("expand-all").addEventListener("click", () => document.querySelectorAll("details").forEach(item => { item.open = true; }));
  document.getElementById("collapse-all").addEventListener("click", () => document.querySelectorAll("details").forEach(item => { item.open = false; }));
  document.getElementById("print").addEventListener("click", () => window.print());
  const focusHash = () => {
    const target = document.getElementById(window.location.hash.slice(1));
    if (target?.tagName === "SECTION") target.focus({ preventScroll: true });
  };
  window.addEventListener("hashchange", focusHash);
  focusHash();
  document.documentElement.dataset.readerReady = "true";
}

export function createReader(data) {
  const safeData = JSON.stringify(data).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
  const escaped = value => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  const caseSections = data.cases.map(record => `<section id="case-${record.id}" tabindex="-1" aria-labelledby="title-${record.id}"><h2 id="title-${record.id}">${record.id} — ${escaped(record.title)}</h2><div id="case-${record.id}-body"></div></section>`).join("\n");
  const runbookSections = data.runbooks.map(record => `<section id="runbook-${record.id}" tabindex="-1" aria-labelledby="title-${record.id}"><h2 id="title-${record.id}">${record.id} — ${escaped(record.title)}</h2><div id="runbook-${record.id}-body"></div></section>`).join("\n");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Reference examples, runbooks and validation evidence — Adaptive Trust Fabric</title>
<script>
  (() => {
    const param = new URLSearchParams(window.location.search).get("clawpilotTheme");
    const theme =
      param || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", theme);
  })();
</script>
<style>
:root {
  color-scheme: light;
  --cp-bg: #f7f4ef;
  --cp-bg-elevated: #fcfbf8;
  --cp-surface: #ffffff;
  --cp-surface-soft: #f5f5f5;
  --cp-border: #dedede;
  --cp-border-strong: #919191;
  --cp-text: #242424;
  --cp-text-muted: #5c5c5c;
  --cp-text-soft: #6f6f6f;
  --cp-accent: #b11f4b;
  --cp-accent-hover: #9a1a41;
  --cp-accent-soft: rgba(177, 31, 75, 0.08);
  --cp-accent-fg: #ffffff;
  --cp-success: #16a34a;
  --cp-danger: #dc2626;
  --cp-warning: #f59e0b;
  --cp-link: #0078d4;
  --cp-shadow: 0 18px 48px rgba(0, 0, 0, 0.12);
  --cp-overlay: rgba(255, 255, 255, 0.8);
  --cp-panel: rgba(255, 255, 255, 0.86);
  --cp-panel-strong: rgba(255, 255, 255, 0.96);
  --cp-sheen: rgba(255, 255, 255, 0.55);
  --cp-highlight: rgba(177, 31, 75, 0.12);
}
html[data-theme="dark"] {
  color-scheme: dark;
  --cp-bg: #3d3b3a;
  --cp-bg-elevated: #343231;
  --cp-surface: #292929;
  --cp-surface-soft: #2e2e2e;
  --cp-border: #474747;
  --cp-border-strong: #5f5f5f;
  --cp-text: #dedede;
  --cp-text-muted: #919191;
  --cp-text-soft: #b0b0b0;
  --cp-accent: #fd8ea1;
  --cp-accent-hover: #fb7b91;
  --cp-accent-soft: rgba(253, 142, 161, 0.14);
  --cp-accent-fg: #1a1a1a;
  --cp-success: #4ade80;
  --cp-danger: #f87171;
  --cp-warning: #fbbf24;
  --cp-link: #4da6ff;
  --cp-shadow: 0 18px 48px rgba(0, 0, 0, 0.32);
  --cp-overlay: rgba(41, 41, 41, 0.88);
  --cp-panel: rgba(41, 41, 41, 0.72);
  --cp-panel-strong: rgba(41, 41, 41, 0.96);
  --cp-sheen: rgba(255, 255, 255, 0.04);
  --cp-highlight: rgba(253, 142, 161, 0.12);
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--cp-bg); color: var(--cp-text); overflow-wrap: anywhere; font: 16px/1.6 "Segoe UI", Aptos, Calibri, -apple-system, BlinkMacSystemFont, sans-serif; }
a { color: var(--cp-link); overflow-wrap: anywhere; }
a:hover { color: var(--cp-accent-hover); }
:focus-visible { outline: 3px solid var(--cp-accent); outline-offset: 3px; }
.skip { position: absolute; top: -100px; left: 16px; padding: 8px; background: var(--cp-surface); }
.skip:focus { top: 8px; }
header, main, footer { max-width: 1280px; margin: auto; padding: 24px; }
header { padding-bottom: 8px; }
h1 { line-height: 1.2; margin-bottom: 16px; font-size: clamp(1.7rem, 3vw, 2.5rem); }
h2 { line-height: 1.3; font-size: 1.5rem; }
h3, h4 { line-height: 1.4; }
.notice { border-left: 4px solid var(--cp-accent); padding: 12px 16px; background: var(--cp-accent-soft); }
.muted { color: var(--cp-text-muted); }
nav, .toolbar { display: flex; flex-wrap: wrap; gap: 8px 16px; margin-block: 16px; }
nav a { font-weight: 600; }
button { font: inherit; color: var(--cp-text); background: var(--cp-surface); border: 1px solid var(--cp-border-strong); border-radius: 0.625rem; padding: 8px 12px; cursor: pointer; }
button:hover { background: var(--cp-highlight); }
section { min-width: 0; border: 1px solid var(--cp-border); background: var(--cp-surface); border-radius: 16px; padding: 24px; margin-bottom: 24px; scroll-margin-top: 16px; box-shadow: 0 1px 2px var(--cp-highlight); }
section:focus { outline: 2px solid var(--cp-accent); outline-offset: 4px; }
.badge { display: inline-block; margin: 0 8px 8px 0; padding: 4px 8px; border: 1px solid var(--cp-border); border-radius: 0.625rem; background: var(--cp-surface-soft); font-size: .85rem; overflow-wrap: anywhere; }
details { border-top: 1px solid var(--cp-border); padding: 12px 0; }
details details { margin-left: 12px; }
summary { cursor: pointer; font-weight: 600; }
summary:hover { color: var(--cp-accent); }
pre { max-width: 100%; max-height: 36rem; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; padding: 16px; border: 1px solid var(--cp-border); border-radius: 0.625rem; background: var(--cp-surface-soft); color: var(--cp-text); font: .85rem/1.6 Consolas, "Courier New", Courier, monospace; }
.table-wrap { max-width: 100%; overflow-x: auto; margin-block: 16px; }
table { width: 100%; border-collapse: collapse; min-width: 720px; text-align: left; }
th, td { vertical-align: top; border: 1px solid var(--cp-border); padding: 12px; white-space: pre-line; overflow-wrap: anywhere; }
th { background: var(--cp-surface-soft); }
td { min-width: 150px; }
td ul { padding-left: 20px; margin: 0; }
li { margin-block: 8px; }
.steps { padding-left: 24px; }
.steps > li { padding-bottom: 12px; }
.downloads { padding: 12px; background: var(--cp-surface-soft); border-radius: 0.625rem; }
footer { color: var(--cp-text-muted); }
@media (max-width: 600px) { header, main, footer { padding: 16px; } section { padding: 16px; } details details { margin-left: 0; } }
@media print { .toolbar, nav, .skip { display: none; } body { background: var(--cp-surface); } section { break-before: page; box-shadow: none; } pre { max-height: none; } }
</style></head>
<body><a class="skip" href="#main">Skip to reference records</a>
<header><p class="muted">Adaptive Trust Fabric · reusable review records · offline reference implementation</p>
<h1>Examples, runbooks and honest validation evidence</h1>
<p class="notice"><strong>LOCAL-ONLY / SYNTHETIC.</strong> No Entra, AD/PHS, Azure Local or OT lab is authorized. No live sign-in, authentication switchover, tenant restore, network interruption or physical safety exercise was performed. Implementation delivery is not operational acceptance.</p>
<nav aria-label="Reference sections"><a href="#case-E1">E1 enterprise</a><a href="#case-E2">E2 acquisition</a><a href="#case-E3">E3 S3 site</a><a href="#runbook-R1">R1 emergency</a><a href="#runbook-R2">R2 PHS</a><a href="#runbook-R3">R3 restore</a><a href="#runbook-R4">R4 S3 loss</a><a href="#authorization">Authorization</a><a href="#evidence">Evidence</a></nav>
<div class="toolbar" aria-label="Reader tools"><button type="button" id="theme-toggle">Toggle light / dark</button><button type="button" id="expand-all">Expand all details</button><button type="button" id="collapse-all">Collapse all details</button><button type="button" id="print">Print current view</button></div>
<p>Open this file directly. All record data and reader code are embedded: no server, package installation, network fetch or external runtime. Diagram sources, SVGs and JSON are neighboring local files.</p></header>
<main id="main" tabindex="-1">${caseSections}\n${runbookSections}
<section id="authorization" tabindex="-1" aria-labelledby="authorization-title"><h2 id="authorization-title">A04 — authorized scope and pending lab request</h2><div id="authorization-body"></div></section>
<section id="evidence" tabindex="-1" aria-labelledby="evidence-title"><h2 id="evidence-title">Executed local evidence versus blocked operational validation</h2><div id="evidence-body"></div></section></main>
<footer><p>Documentary support and architecture examples are not product commitments, legal advice, safety certification or deployment approval. All requirements, targets, timing and organization names are synthetic. Generated from machine-readable records; <a href="contract.json">stable contract</a>. <a href="../adaptive-trust-fabric-microsite/index.html">Return to research microsite</a>.</p></footer>
<script type="application/json" id="reference-data">${safeData}</script>
<script>(${readerRuntime.toString()})();</script>
</body></html>\n`;
}
