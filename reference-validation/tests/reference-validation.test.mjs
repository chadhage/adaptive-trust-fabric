import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  AcquisitionFixture, LocalSiteFixture, SYNTHETIC_KEY,
  runSyntheticChecks, signSyntheticCredential, verifyHashLinkedLog
} from "../scripts/local-models.mjs";
import { readJson, referenceRoot, projectRoot, validateSchema, validateCase, stronglyConnectedCycles, reachable, validateDiagram } from "../scripts/validate.mjs";
import { createReader } from "../scripts/reader.mjs";

const canonical = JSON.parse(fs.readFileSync(path.join(projectRoot, "adaptive-trust-fabric-microsite", "data", "research.json"), "utf8"));
const records = ["e1", "e2", "e3"].map(id => readJson("cases", `${id}.json`));
const schema = readJson("schema", "review-record.schema.json");
const clone = value => structuredClone(value);
const local = options => new LocalSiteFixture({ key: SYNTHETIC_KEY, ...options });

test("A02 accepts distinct declared, exact-local verified, unknown and failed fragments", () => {
  for (const requirement of readJson("schema", "requirement-state-examples.json").requirements) {
    assert.deepEqual(validateSchema(requirement, schema.$defs.requirement, schema), []);
  }
});

test("A02 rejects verified assertions without observed scope/evidence or with unresolved unknowns", () => {
  const original = readJson("schema", "requirement-state-examples.json").requirements.find(item => item.status === "verified");
  for (const mutate of [
    requirement => { delete requirement.verificationScope; },
    requirement => { requirement.evidenceRefs = []; },
    requirement => { requirement.unknowns.push("not actually established"); },
    requirement => { requirement.status = "probably"; }
  ]) {
    const changed = clone(original);
    mutate(changed);
    assert.ok(validateSchema(changed, schema.$defs.requirement, schema).length);
  }
});

for (const record of records) test(`${record.id} consumes final canonical IDs/evidence and exact shared-engine result`, () => {
  assert.deepEqual(validateCase(record, canonical), []);
});

test("authority edges cannot omit credential or effective revocation information", () => {
  const changed = clone(records[0]);
  delete changed.authorityGraph.edges[0].credential;
  delete changed.authorityGraph.edges[1].revocation.actor;
  changed.authorityGraph.edges[2].revocation.mechanism = "";
  const errors = validateCase(changed, canonical);
  assert.ok(errors.some(item => item.includes("credential")));
  assert.ok(errors.some(item => item.includes("actor")));
  assert.ok(errors.some(item => item.includes("mechanism")));
});

test("indirect privilege paths must be continuous and directed", () => {
  const changed = clone(records[1]);
  changed.authorityGraph.indirectPaths[0].edgeIds.reverse();
  assert.ok(validateCase(changed, canonical).some(item => item.includes("continuous directed path")));
  assert.equal(reachable(records[1].authorityGraph, "E2-A-HOME", "E2-A-CEDAR"), false);
  assert.equal(reachable(records[1].authorityGraph, "E2-A-CI", "E2-A-DATA"), true);
});

test("control mapping rejects duplicated applicability and generic repeated rationale", () => {
  const changed = clone(records[0]);
  changed.controlApplicability[1] = clone(changed.controlApplicability[0]);
  const errors = validateCase(changed, canonical);
  assert.ok(errors.some(item => item.includes("duplicate IDs")));
  assert.ok(errors.some(item => item.includes("rationales")));
});

test("rejected bootstrap cycles are real graph cycles, not hidden selected dependencies", () => {
  for (const record of records) {
    const graph = record.recoveryGraph;
    assert.ok(stronglyConnectedCycles(graph.nodes, graph.edges).length > 0);
    assert.deepEqual(stronglyConnectedCycles(graph.nodes, graph.edges.filter(edge => !graph.rejectedEdgeIds.includes(edge.id))), []);
  }
  const changed = clone(records[2]);
  changed.recoveryGraph.rejectedEdgeIds = [];
  assert.ok(validateCase(changed, canonical).some(item => item.includes("selected recovery graph still has cycles")));
});

test("synthetic examples cannot acquire operational proof or observations from a blocked scenario", () => {
  const changed = clone(records[0]);
  changed.validation.overallStatus = "passed-authorized-scope";
  changed.validation.scenarios[0].observed = ["invented successful tenant sign-in"];
  const errors = validateCase(changed, canonical);
  assert.ok(errors.some(item => item.includes("cannot pass authorized operational")));
  assert.ok(errors.some(item => item.includes("observations despite non-execution")));
});

test("local credential enforces signature, issuer, audience, bounded time and revocation", () => {
  const site = local();
  const credential = site.issueCredential("operator-local");
  const payload = JSON.parse(Buffer.from(credential.split(".")[0], "base64url").toString("utf8"));
  assert.equal(site.perform(credential, "telemetry.read").allowed, true);
  assert.equal(site.verifyCredential(signSyntheticCredential({ ...payload, issuer: "central" })).reason, "wrong-issuer");
  assert.equal(site.verifyCredential(signSyntheticCredential({ ...payload, audience: "other" })).reason, "wrong-audience");
  assert.equal(site.verifyCredential(signSyntheticCredential({ ...payload, subject: "central-admin" })).reason, "unknown-local-subject");
  assert.equal(site.verifyCredential(signSyntheticCredential({ ...payload, issuedAt: 1 })).valid, false);
  assert.equal(site.verifyCredential(signSyntheticCredential({ ...payload, expiresAt: 901 })).valid, false);
  assert.equal(site.verifyCredential(`${credential}x`).valid, false);
  site.nowSeconds = 900;
  assert.equal(site.verifyCredential(credential).valid, false);
  site.nowSeconds = 0;
  site.revoke("operator-local");
  assert.equal(site.perform(credential, "alarm.ack").reason, "locally-revoked");
});

test("local action policy denies unknown/physical actions and non-operator roles", () => {
  const site = local();
  assert.equal(site.perform(site.issueCredential("operator-local"), "plc.write").allowed, false);
  assert.equal(site.perform(site.issueCredential("safety-local"), "alarm.ack").allowed, false);
  assert.equal(site.issueCredential("central-admin"), null);
});

test("local evidence limit refuses new state changes without discarding history", () => {
  const site = local({ capacity: 1 });
  const credential = site.issueCredential("operator-local");
  assert.equal(site.perform(credential, "alarm.ack").recorded, true);
  const retained = clone(site.log);
  assert.equal(site.perform(credential, "alarm.ack").reason, "evidence-capacity-read-only");
  assert.deepEqual(site.log, retained);
  assert.equal(site.perform(credential, "telemetry.read").reason, "read-only-existing-telemetry");
  assert.deepEqual(site.log, retained);
});

test("hash linkage catches changed records, removed middle records and reordered history", () => {
  const site = local();
  for (let index = 0; index < 3; index++) site.appendEvent({ type: `synthetic-${index}` });
  assert.equal(verifyHashLinkedLog(site.log), true);
  const modified = clone(site.log);
  modified[0].event.type = "tampered";
  assert.equal(verifyHashLinkedLog(modified), false);
  assert.equal(verifyHashLinkedLog([site.log[0], site.log[2]]), false);
  assert.equal(verifyHashLinkedLog([...site.log].reverse()), false);
});

test("one local prerequisite failure at a time prevents work; missing infrastructure cannot fail open", () => {
  for (const [field, value] of [
    ["keyAvailable", false], ["keyExpiresAt", 0], ["clockDriftSeconds", -61],
    ["dnsAvailable", false], ["pkiAvailable", false], ["pkiExpiresAt", 0],
    ["communicationsAvailable", false], ["revocationValidUntil", 0]
  ]) {
    const site = local();
    const token = site.issueCredential("operator-local");
    site[field] = value;
    assert.equal(site.perform(token, "alarm.ack").allowed, false, field);
    assert.equal(site.mode, "safe-stopped", field);
    assert.equal(site.issueCredential("operator-local"), null, field);
  }
});

test("local communications requires the intended local recipient and stays bounded", () => {
  const site = local();
  const message = site.sendMessage("operator-local", "safety-local", "synthetic");
  assert.equal(site.acknowledgeMessage(message, "central-admin"), false);
  assert.equal(site.acknowledgeMessage(message, "safety-local"), true);
  for (let index = 0; index < 7; index++) site.sendMessage("operator-local", "safety-local", "bounded");
  assert.equal(site.sendMessage("operator-local", "safety-local", "over limit"), null);
});

test("local safety veto needs two local roles and healthy dependencies before modeled restart", () => {
  const site = local();
  assert.equal(site.safetyStop("central-admin"), false);
  assert.equal(site.safetyStop("safety-local"), true);
  assert.equal(site.restart(["central-admin", "recovery-local"]), false);
  assert.equal(site.restart(["safety-local"]), false);
  site.dnsAvailable = false;
  assert.equal(site.restart(["safety-local", "recovery-local"]), false);
  site.dnsAvailable = true;
  assert.equal(site.restart(["safety-local", "recovery-local"]), true);
  site.nowSeconds = 86400;
  assert.equal(site.refreshMode(), "safe-stopped");
  assert.equal(site.restart(["safety-local", "recovery-local"]), false);
});

test("reconnection requires reconciliation and preserves revocations/evidence across export receipts", () => {
  const site = local();
  const token = site.issueCredential("operator-local");
  site.perform(token, "alarm.ack");
  site.revoke("operator-local");
  const exportBefore = site.prepareExport();
  site.reconnect();
  assert.equal(site.mode, "safe-stopped");
  assert.equal(site.reconcile({ policyVersion: "stale-policy" }), false);
  assert.equal(site.reconcile({ policyVersion: site.policyVersion }), true);
  assert.equal(site.perform(token, "alarm.ack").reason, "locally-revoked");
  assert.equal(site.acknowledgeExport("wrong-receipt"), false);
  assert.equal(site.acknowledgeExport(exportBefore.digest), true);
  assert.deepEqual(site.prepareExport(), exportBefore);
});

test("acquisition separation distinguishes new issuer access from existing resource sessions", () => {
  const fixture = new AcquisitionFixture();
  const subject = "orbit-synthetic-1";
  const request = { subject };
  const session = fixture.signIn(request);
  assert.equal(fixture.useSession(session), true);
  fixture.disableHome(subject);
  assert.equal(fixture.signIn(request), null);
  assert.equal(fixture.useSession(session), true);
  fixture.denyAtResource(subject);
  assert.equal(fixture.useSession(session), false);
});

test("restricted acquisition model denies wrong scope and removes human/session/workload access at exit", () => {
  const fixture = new AcquisitionFixture();
  const request = { subject: "orbit-synthetic-2" };
  const session = fixture.signIn(request);
  assert.equal(fixture.signIn({ ...request, issuer: "https://wrong.example.invalid" }), null);
  assert.equal(fixture.signIn({ ...request, application: "production-admin" }), null);
  assert.equal(fixture.signIn({ subject: "unlisted" }), null);
  assert.equal(fixture.useSession(session, "tenant.admin"), false);
  assert.equal(fixture.canDeploy("transition-deploy-binding"), true);
  fixture.separate();
  assert.equal(fixture.useSession(session), false);
  assert.equal(fixture.signIn(request), null);
  assert.equal(fixture.canDeploy("transition-deploy-binding"), false);
});

test("expired sponsorship prevents new acquisition-model access at its exact boundary", () => {
  const fixture = new AcquisitionFixture();
  fixture.nowSeconds = fixture.sponsorExpiresAt - 1;
  assert.ok(fixture.signIn({ subject: "orbit-synthetic-3" }));
  fixture.nowSeconds += 1;
  assert.equal(fixture.signIn({ subject: "orbit-synthetic-3" }), null);
});

test("the bounded local execution emits observed, scope-limited passing results", () => {
  const result = runSyntheticChecks();
  assert.deepEqual(result.checks.filter(item => item.status === "failed"), []);
  assert.equal(result.failed, 0);
  assert.ok(result.checks.some(item => item.id.startsWith("S3-")));
  assert.ok(result.checks.some(item => item.id.startsWith("E2-")));
  assert.equal(result.countsAsLiveValidation, false);
});

test("editable diagrams preserve directed edges and reject invisible text geometry", () => {
  for (const record of records) for (const kind of ["authority", "recovery"]) {
    const diagram = readJson("diagrams", `${record.id.toLowerCase()}-${kind}.excalidraw`);
    assert.deepEqual(validateDiagram(diagram, record, kind), []);
    const changed = clone(diagram);
    changed.elements.find(item => item.type === "text").height = 0;
    assert.ok(validateDiagram(changed, record, kind).some(item => item.includes("text height")));
  }
});

test("offline reader embeds hostile text as data rather than executable markup", () => {
  const cases = clone(records);
  cases[0].title = '</script><img src="https://invalid.example.invalid/leak">';
  const html = createReader({ cases, runbooks: [], executions: { records: [] }, authorization: {}, runbookPaths: {} });
  assert.ok(!html.includes(cases[0].title));
  assert.ok(html.includes("\\u003c/script>"));
  assert.ok(html.includes("&lt;/script>"));
  assert.ok(!/\bfetch\s*\(/.test(html));
});

test("local models have no network, process, filesystem or credential-store import", () => {
  const source = fs.readFileSync(path.join(referenceRoot, "scripts", "local-models.mjs"), "utf8");
  const imports = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map(match => match[1]);
  assert.deepEqual(imports.filter(specifier => specifier !== "node:crypto"), []);
  assert.ok(!/\b(?:fetch|XMLHttpRequest|exec|spawn|eval)\s*\(/.test(source));
});
