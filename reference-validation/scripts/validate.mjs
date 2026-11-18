import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { sha256 } from "./local-models.mjs";

export const referenceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const projectRoot = path.resolve(referenceRoot, "..");
const require = createRequire(import.meta.url);
export const readJson = (...parts) => JSON.parse(fs.readFileSync(path.join(referenceRoot, ...parts), "utf8"));
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const typeOf = value => value === null ? "null" : Array.isArray(value) ? "array" : typeof value;

export function validateSchema(value, schema, root = schema, location = "$") {
  const errors = [];
  const error = message => errors.push(`${location}: ${message}`);
  if (schema.$ref) {
    if (!schema.$ref.startsWith("#/")) return [`${location}: unsupported non-local schema reference`];
    const target = schema.$ref.slice(2).split("/").reduce((node, key) => node?.[key], root);
    if (!target) return [`${location}: unresolved schema reference ${schema.$ref}`];
    return validateSchema(value, target, root, location);
  }
  if (schema.type) {
    const permitted = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!permitted.includes(typeOf(value)) && !(permitted.includes("integer") && Number.isInteger(value))) {
      return [`${location}: expected ${permitted.join("|")}, got ${typeOf(value)}`];
    }
  }
  if (Object.hasOwn(schema, "const") && !same(value, schema.const)) error(`must equal ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.some(candidate => same(candidate, value))) error(`not in enum: ${JSON.stringify(value)}`);
  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) error("string is too short");
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) error(`does not match ${schema.pattern}`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) error(`requires at least ${schema.minItems} items`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) error(`requires at most ${schema.maxItems} items`);
    if (schema.items) value.forEach((item, index) => errors.push(...validateSchema(item, schema.items, root, `${location}[${index}]`)));
  }
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    if (schema.minProperties !== undefined && Object.keys(value).length < schema.minProperties) error("too few properties");
    for (const required of schema.required ?? []) if (!Object.hasOwn(value, required)) error(`missing ${required}`);
    for (const [key, child] of Object.entries(value)) {
      if (schema.properties?.[key]) errors.push(...validateSchema(child, schema.properties[key], root, `${location}.${key}`));
      else if (schema.additionalProperties === false) error(`unexpected property ${key}`);
      else if (schema.additionalProperties && typeof schema.additionalProperties === "object") errors.push(...validateSchema(child, schema.additionalProperties, root, `${location}.${key}`));
    }
  }
  for (const member of schema.allOf ?? []) errors.push(...validateSchema(value, member, root, location));
  if (schema.if && validateSchema(value, schema.if, root, location).length === 0 && schema.then) errors.push(...validateSchema(value, schema.then, root, location));
  return errors;
}

export function stronglyConnectedCycles(nodes, edges) {
  const adjacency = new Map(nodes.map(node => [node.id, []]));
  for (const edge of edges) adjacency.get(edge.from)?.push(edge.to);
  let serial = 0;
  const indexes = new Map();
  const low = new Map();
  const stack = [];
  const active = new Set();
  const cycles = [];
  function visit(id) {
    indexes.set(id, serial);
    low.set(id, serial++);
    stack.push(id);
    active.add(id);
    for (const next of adjacency.get(id) ?? []) {
      if (!indexes.has(next)) {
        visit(next);
        low.set(id, Math.min(low.get(id), low.get(next)));
      } else if (active.has(next)) low.set(id, Math.min(low.get(id), indexes.get(next)));
    }
    if (low.get(id) === indexes.get(id)) {
      const members = [];
      let member;
      do {
        member = stack.pop();
        active.delete(member);
        members.push(member);
      } while (member !== id);
      if (members.length > 1 || adjacency.get(id)?.includes(id)) cycles.push(members.sort());
    }
  }
  for (const node of nodes) if (!indexes.has(node.id)) visit(node.id);
  return cycles.sort((a, b) => a.join().localeCompare(b.join()));
}

export function reachable(graph, start, target) {
  const seen = new Set();
  const queue = [start];
  while (queue.length) {
    const id = queue.shift();
    if (id === target) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    queue.push(...graph.edges.filter(edge => edge.from === id).map(edge => edge.to));
  }
  return false;
}

export function validateCase(record, canonical, { requireAssessment = true, requireSources = true } = {}) {
  const schema = readJson("schema", "review-record.schema.json");
  const errors = validateSchema(record, schema);
  if (errors.length) return errors;
  const report = message => errors.push(`${record.id}: ${message}`);
  const requirements = new Set(record.requirements.map(item => item.id));
  const boundaries = new Set(record.boundaries.map(item => item.id));
  const facts = new Set(record.sourceFacts.map(item => item.id));
  const controls = new Set(canonical.normativeControls.map(item => item.id));
  const claims = new Set(canonical.claims.map(item => item.id));
  const sources = new Set(canonical.sources.map(item => item.id));
  const references = (values, allowed, label) => {
    for (const value of values) if (!allowed.has(value)) report(`${label} references unknown ${value}`);
  };
  const unique = (values, label) => {
    if (new Set(values).size !== values.length) report(`${label} has duplicate IDs`);
  };
  unique(record.requirements.map(item => item.id), "requirements");
  unique(record.boundaries.map(item => item.id), "boundaries");
  unique(record.sourceFacts.map(item => item.id), "source facts");
  unique(record.controlApplicability.map(item => item.controlId), "control applicability");
  unique(record.controlApplicability.map(item => item.rationale), "control rationales");
  if (record.controlApplicability.some(item => !controls.has(item.controlId)) || record.controlApplicability.length !== controls.size) report("must map every final canonical control exactly once");
  if (new Set(record.boundaries.map(item => item.type)).size !== 8) report("all eight distinct boundary types must be explicit, including exclusions");
  for (const requirement of record.requirements) {
    references(requirement.sourceFactRefs, facts, requirement.id);
    if (record.synthetic && requirement.status === "verified" && requirement.verificationScope?.kind !== "local-synthetic-only") report(`${requirement.id} synthetic design cannot claim operational verification`);
  }
  for (const boundary of record.boundaries) references(boundary.requirementRefs, requirements, boundary.id);
  for (const fact of record.sourceFacts) {
    references(fact.sourceIds, sources, fact.id);
    references(fact.claimIds, claims, fact.id);
    if (requireSources && !fact.evidence.source_refs.length) report(`${fact.id} lacks final canonical documentary source references`);
    if (fact.evidence.operational_validation !== "not-performed") report(`${fact.id} confuses documentary and operational evidence`);
  }
  for (const control of record.controlApplicability) {
    references(control.requirementRefs, requirements, control.controlId);
    if (control.applicability === "not-applicable" && control.implementationStatus !== "not-applicable") report(`${control.controlId} exclusion status mismatch`);
  }
  for (const [name, graph] of [["authority", record.authorityGraph], ["recovery", record.recoveryGraph]]) {
    const nodeIds = new Set(graph.nodes.map(node => node.id));
    const edgeIds = new Set(graph.edges.map(edge => edge.id));
    unique(graph.nodes.map(node => node.id), `${name} nodes`);
    unique(graph.edges.map(edge => edge.id), `${name} edges`);
    for (const node of graph.nodes) references([node.boundary], boundaries, node.id);
    for (const edge of graph.edges) references([edge.from, edge.to], nodeIds, edge.id);
    if (name === "authority") {
      for (const edge of graph.edges) references(edge.boundaryCrossings, boundaries, edge.id);
      for (const item of graph.indirectPaths) {
        references(item.nodeIds, nodeIds, item.id);
        references(item.edgeIds, edgeIds, item.id);
        if (item.nodeIds.length !== item.edgeIds.length + 1) report(`${item.id} path length mismatch`);
        item.edgeIds.forEach((id, index) => {
          const edge = graph.edges.find(candidate => candidate.id === id);
          if (edge && (edge.from !== item.nodeIds[index] || edge.to !== item.nodeIds[index + 1])) report(`${item.id} is not a continuous directed path`);
        });
      }
    } else {
      references(graph.rejectedEdgeIds, edgeIds, "rejected recovery edges");
      for (const anchor of graph.independentAnchors) references([anchor.nodeId], nodeIds, "independent anchor");
      const actualCycles = stronglyConnectedCycles(graph.nodes, graph.edges);
      for (const cycle of actualCycles) if (!graph.cycles.some(item => same([...item.nodeIds].sort(), cycle))) report(`unreported recovery cycle ${cycle.join(" -> ")}`);
      for (const cycle of graph.cycles) {
        references(cycle.nodeIds, nodeIds, cycle.id);
        if (!actualCycles.some(item => same(item, [...cycle.nodeIds].sort()))) report(`${cycle.id} does not describe an actual graph cycle`);
        if (cycle.status === "verified-broken" && record.synthetic) report(`${cycle.id} cannot claim operational cycle removal`);
      }
      const selectedCycles = stronglyConnectedCycles(graph.nodes, graph.edges.filter(edge => !graph.rejectedEdgeIds.includes(edge.id)));
      if (selectedCycles.length) report(`selected recovery graph still has cycles: ${JSON.stringify(selectedCycles)}`);
    }
  }
  if (!record.decision.alternatives.some(item => item.id === record.decision.selectedAlternativeId && item.disposition === "selected-provisionally")) report("selected alternative is not present/provisional");
  for (const scenario of record.validation.scenarios) {
    references(scenario.requirementRefs, requirements, scenario.id);
    if (scenario.status === "not-executed-blocked" && (scenario.observed.length || scenario.evidenceRefs.length)) report(`${scenario.id} has observations despite non-execution`);
    if (scenario.status === "passed-local-synthetic-only" && !scenario.scope.toLowerCase().includes("local")) report(`${scenario.id} fails to scope local evidence`);
  }
  if (record.synthetic && record.validation.overallStatus === "passed-authorized-scope") report("local-only synthetic design cannot pass authorized operational scope");
  if (requireAssessment) {
    try {
      const engine = require(path.join(projectRoot, "adaptive-trust-fabric-microsite", "assets", "assessment.js"));
      const expected = engine.assess(record.decision.assessmentInput);
      if (!same(record.decision.assessmentOutput, expected)) report("assessment output is not the final shared engine's exact result");
      if (expected.validationErrors.length) report(`invalid assessment input: ${JSON.stringify(expected.validationErrors)}`);
      if (expected.state !== "insufficient-evidence") report("unverified reference case must retain an insufficient-evidence assessment");
    } catch (error) {
      report(`shared assessment engine unavailable: ${error.message}`);
    }
  }
  return errors;
}

export function validateDiagram(diagram, record, kind) {
  const errors = [];
  const prefix = `${record.id} ${kind}`;
  if (diagram.type !== "excalidraw" || diagram.version !== 2) errors.push(`${prefix}: invalid editable format`);
  const ids = new Set(diagram.elements.map(item => item.id));
  if (ids.size !== diagram.elements.length) errors.push(`${prefix}: duplicate element IDs`);
  for (const element of diagram.elements) {
    if (!Number.isFinite(element.width) || !Number.isFinite(element.height)) errors.push(`${prefix}: ${element.id} lacks explicit dimensions`);
    if (element.type === "text") {
      if (element.strokeColor !== "#000000") errors.push(`${prefix}: nonblack text ${element.id}`);
      if (element.height < element.fontSize * 2.5 * element.text.split("\n").length) errors.push(`${prefix}: truncated text height ${element.id}`);
      if (element.width < Math.max(...element.text.split("\n").map(line => line.length)) * element.fontSize * 0.6) errors.push(`${prefix}: insufficient text width ${element.id}`);
      if (element.containerId && !ids.has(element.containerId)) errors.push(`${prefix}: invalid text binding`);
    }
    if (element.type === "rectangle" && element.backgroundColor !== "transparent") errors.push(`${prefix}: nontransparent container`);
    for (const binding of [element.startBinding, element.endBinding].filter(Boolean)) if (!ids.has(binding.elementId)) errors.push(`${prefix}: invalid arrow binding`);
  }
  const graph = kind === "authority" ? record.authorityGraph : record.recoveryGraph;
  const actual = diagram.elements.filter(item => item.type === "arrow").map(item => item.customData?.edgeId).sort();
  if (!same(actual, graph.edges.map(item => item.id).sort())) errors.push(`${prefix}: diagram omits or duplicates record edges`);
  return errors;
}

export function validateAll({ requireGenerated = true, requireBrowser = true } = {}) {
  const canonicalText = fs.readFileSync(path.join(projectRoot, "adaptive-trust-fabric-microsite", "data", "research.json"), "utf8");
  const canonical = JSON.parse(canonicalText);
  const errors = [];
  const cases = ["e1", "e2", "e3"].map(id => readJson("cases", `${id}.json`));
  for (const record of cases) {
    errors.push(...validateCase(record, canonical));
    if (requireGenerated) for (const kind of ["authority", "recovery"]) {
      try {
        errors.push(...validateDiagram(readJson("diagrams", `${record.id.toLowerCase()}-${kind}.excalidraw`), record, kind));
        if (!fs.readFileSync(path.join(referenceRoot, "diagrams", `${record.id.toLowerCase()}-${kind}.svg`), "utf8").includes("<svg")) errors.push(`${record.id}: missing SVG ${kind}`);
      } catch (error) {
        errors.push(`${record.id}: generated ${kind} diagram missing or invalid: ${error.message}`);
      }
    }
  }
  const runbookFiles = ["r1-emergency.json", "r2-phs.json", "r3-tenant-restore.json", "r4-s3-outage.json"];
  const runbooks = runbookFiles.map(name => readJson("runbooks", name));
  const capabilityIds = new Set((canonical.capabilityMatrix ?? []).map(item => item.id));
  for (const runbook of runbooks) {
    for (const field of ["prerequisites", "steps", "passCriteria", "failCriteria", "evidenceRequirements"]) if (!runbook[field]?.length) errors.push(`${runbook.id}: empty ${field}`);
    if (!runbook.rollback?.steps?.length || !runbook.rollback?.acceptance?.length) errors.push(`${runbook.id}: rollback incomplete`);
    for (const source of runbook.sourceReferences) {
      for (const id of source.claimIds) if (!canonical.claims.some(item => item.id === id)) errors.push(`${runbook.id}: unknown claim ${id}`);
      for (const id of source.sourceIds) if (!canonical.sources.some(item => item.id === id)) errors.push(`${runbook.id}: unknown source ${id}`);
      for (const id of source.capabilityIds) if (!capabilityIds.has(id)) errors.push(`${runbook.id}: unknown final capability ${id}`);
    }
    for (const id of runbook.relatedControls) if (!canonical.normativeControls.some(item => item.id === id)) errors.push(`${runbook.id}: unknown control ${id}`);
    if (runbook.validation.executed !== false) errors.push(`${runbook.id}: operational execution must remain false under local-only authorization`);
    if (runbook.id !== "R4" && (runbook.validation.observed.length || runbook.validation.status !== "blocked-no-authorized-lab")) errors.push(`${runbook.id}: unapproved live evidence`);
  }
  const authorization = readJson("evidence", "authorization-request.json");
  if (authorization.status !== "local-only-approved-operational-blocked" || authorization.authorizedTargets.length || authorization.approvals.length) errors.push("Authorization must preserve the absence of live scope.");
  if (requireGenerated) {
    try {
      const evidence = readJson("evidence", "executions.json");
      const local = evidence.records.find(item => item.id === "LOCAL-SYNTHETIC-01");
      if (!local?.startedAt || !local?.endedAt || !local?.checks?.length || local.countsAsLiveValidation !== false || local.failed !== 0) errors.push("Executed local synthetic record missing, failed or overstated.");
      const test = evidence.records.find(item => item.id === "LOCAL-NODE-TESTS-01");
      if (!test || test.exitCode !== 0 || !test.observed?.includes("# fail 0")) errors.push("Actual passing Node test record missing.");
      for (const id of ["LIVE-R1", "LIVE-R2", "LIVE-R3", "OPERATIONAL-R4", "LIVE-E1", "LIVE-E2", "OPERATIONAL-E3"]) {
        const blocked = evidence.records.find(item => item.id === id);
        if (blocked?.status !== "blocked-no-authorized-lab" || blocked.startedAt !== null || blocked.observed?.length) errors.push(`${id}: blocked operational evidence is not honest/non-executed`);
      }
      const html = fs.readFileSync(path.join(referenceRoot, "index.html"), "utf8");
      for (const id of ["case-E1", "case-E2", "case-E3", "runbook-R1", "runbook-R2", "runbook-R3", "runbook-R4", "authorization", "evidence"]) if (!html.includes(`id="${id}"`)) errors.push(`Offline reader missing stable anchor ${id}`);
      if (/\bfetch\s*\(|<script[^>]+src\s*=|https?:\/\/[^"'\s]+\.js/i.test(html)) errors.push("Offline reader must not load a network/runtime dependency.");
      const catalog = readJson("catalog.json");
      if (catalog.canonicalData.sha256 !== sha256(canonicalText)) errors.push("Case catalog is stale relative to final canonical research data.");
      const engineText = fs.readFileSync(path.join(projectRoot, "adaptive-trust-fabric-microsite", "assets", "assessment.js"), "utf8");
      if (catalog.assessment.sha256 !== sha256(engineText)) errors.push("Case catalog is stale relative to the final shared engine.");
      if (requireBrowser) {
        const browser = readJson("evidence", "browser-checks.json");
        if (browser.status !== "passed-local-synthetic-only" || browser.failed !== 0 || browser.countsAsLiveValidation !== false) errors.push("Actual passing scope-limited browser/diagram evidence is missing.");
        const expectedFiles = ["index.html", "scripts/check-browser.mjs", "../tools/validate-browser-runtime.mjs"];
        for (const id of ["e1", "e2", "e3"]) for (const kind of ["authority", "recovery"]) {
          expectedFiles.push(`diagrams/${id}-${kind}.svg`);
          for (const suffix of ["native-svg-text-inside-canvas", "native-svg-black-text", "native-svg-all-directed-edges", "native-font-fits-editable-text-bounds"]) {
            if (!browser.results?.some(item => item.id === `${id}-${kind}-${suffix}` && item.passed)) errors.push(`Browser did not demonstrate ${id}-${kind}-${suffix}.`);
          }
        }
        for (const relative of expectedFiles) {
          const current = sha256(fs.readFileSync(path.join(referenceRoot, ...relative.split("/")), "utf8"));
          if (browser.inputHashes?.find(item => item.path === relative)?.value !== current) errors.push(`Browser observation is stale or absent for ${relative}.`);
        }
      }
    } catch (error) {
      errors.push(`Generated evidence/reader missing: ${error.message}`);
    }
  }
  return { scope: "offline structure, source/engine integration, diagram geometry and evidence honesty only", errors, cases: cases.length, controlsPerCase: 26, runbooks: runbooks.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = validateAll();
  console.log(JSON.stringify(result, null, 2));
  if (result.errors.length) process.exitCode = 1;
}
