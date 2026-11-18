import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { runSyntheticChecks, sha256 } from "./local-models.mjs";
import { build } from "./build.mjs";
import { projectRoot, referenceRoot, readJson, validateAll } from "./validate.mjs";

const write = (parts, value) => fs.writeFileSync(path.join(referenceRoot, ...parts), JSON.stringify(value, null, 2) + "\n", "utf8");
build();
const testsStartedAt = new Date();
const testArguments = ["--test", "--test-reporter=tap", path.join("reference-validation", "tests", "reference-validation.test.mjs")];
const tests = spawnSync(process.execPath, testArguments, { cwd: projectRoot, encoding: "utf8", timeout: 60000, windowsHide: true });
const testsEndedAt = new Date();
const startedAt = new Date();
const result = runSyntheticChecks();
const endedAt = new Date();
const exactFiles = [
  ["scripts", "local-models.mjs"], ["scripts", "simulate-s3.mjs"], ["scripts", "validate.mjs"],
  ["scripts", "build.mjs"], ["scripts", "reader.mjs"], ["scripts", "record-local-validation.mjs"],
  ["tests", "reference-validation.test.mjs"], ["schema", "review-record.schema.json"], ["schema", "requirement-state-examples.json"],
  ["contract.json"],
  ["evidence", "authorization-request.json"]
];
const inputHashes = exactFiles.map(parts => ({
  path: parts.join("/"), algorithm: "sha256", normalization: "exact UTF-8 file bytes",
  value: sha256(fs.readFileSync(path.join(referenceRoot, ...parts), "utf8"))
}));
for (const parts of [
  ["adaptive-trust-fabric-microsite", "data", "research.json"],
  ["adaptive-trust-fabric-microsite", "assets", "assessment.js"]
]) inputHashes.push({
  path: `../${parts.join("/")}`, algorithm: "sha256", normalization: "exact UTF-8 file bytes",
  value: sha256(fs.readFileSync(path.join(projectRoot, ...parts), "utf8"))
});
for (const id of ["e1", "e2", "e3"]) {
  const record = readJson("cases", `${id}.json`);
  const projection = {
    requirements: record.requirements, boundaries: record.boundaries, authorityGraph: record.authorityGraph,
    recoveryGraph: record.recoveryGraph, controlApplicability: record.controlApplicability,
    assessmentInput: record.decision.assessmentInput
  };
  inputHashes.push({ path: `cases/${id}.json`, algorithm: "sha256", normalization: "JSON.stringify of the named input projection; excludes generated source/output/validation fields", projectionKeys: Object.keys(projection), value: sha256(projection) });
}
for (const name of ["r1-emergency.json", "r2-phs.json", "r3-tenant-restore.json", "r4-s3-outage.json"]) {
  const record = readJson("runbooks", name);
  const { validation, ...projection } = record;
  inputHashes.push({ path: `runbooks/${name}`, algorithm: "sha256", normalization: "JSON.stringify of the runbook excluding generated validation observations; does not establish that operational steps executed", projectionKeys: Object.keys(projection), value: sha256(projection) });
}
const testOutput = `${tests.stdout ?? ""}${tests.stderr ?? ""}`;
const blocked = [
  ["LIVE-R1", "R1", ["E1", "E2"], "Two real independent emergency sign-ins, permitted action and observed monitoring."],
  ["LIVE-R2", "R2", ["E1"], "Actual PHS activation, fresh positive/negative sign-ins and measured rollback."],
  ["LIVE-R3", "R3", ["E1", "E2"], "Actual trusted scoped object and relationship restoration with acceptance."],
  ["OPERATIONAL-R4", "R4", ["E3"], "Representative actual local services, communications, safe-state/restart and duration exercise."],
  ["LIVE-E1", null, ["E1"], "Regional/key/service fit and real emergency/recovery operating evidence."],
  ["LIVE-E2", null, ["E2"], "Actual restricted trust, lifecycle and effective human/session/workload separation."],
  ["OPERATIONAL-E3", null, ["E3"], "Actual independent local identity/policy/evidence/recovery and local safety acceptance."]
].map(([id, runbookId, caseIds, expected]) => ({
  id, runbookId, caseIds, status: "blocked-no-authorized-lab", scopeKind: "operational-not-authorized",
  scope: "No dedicated Entra/AD/PHS/OT lab, live targets, writes, service interruption or physical operation is authorized.",
  authorizationRef: "AUTH-REQUEST-01", countsAsLiveValidation: false,
  expected: [expected], observed: [], startedAt: null, endedAt: null, executed: false,
  blocker: "Explicit authorization is LOCAL-ONLY synthetic fixtures and browser tests. Original operational acceptance was not weakened or replaced.",
  evidenceRefs: []
}));
const execution = {
  schemaVersion: "1.0.0",
  generatedAt: endedAt.toISOString(),
  authorizationRef: "AUTH-REQUEST-01",
  releaseAcceptance: "blocked-no-authorized-lab",
  records: [
    {
      id: "LOCAL-SYNTHETIC-01", status: result.failed ? "failed" : "passed-local-synthetic-only",
      scopeKind: result.scopeKind, scope: `${result.checks.filter(item => item.id.startsWith("S3-")).length} S3 local state-machine checks and ${result.checks.filter(item => item.id.startsWith("E2-")).length} acquisition lifecycle/separation model checks. No external service or equipment.`,
      countsAsLiveValidation: false, executed: true,
      command: "node reference-validation\\scripts\\simulate-s3.mjs",
      operatorRole: "Automated local synthetic-fixture runner",
      environment: { runtime: process.version, platform: process.platform, architecture: process.arch, networkAccessUsed: false, credentialsRead: false, externalChanges: false },
      expected: ["All emitted bounded local checks match their expected values; every operational claim remains unverified."],
      startedAt: startedAt.toISOString(), endedAt: endedAt.toISOString(), wallDurationMilliseconds: endedAt - startedAt,
      logicalDurationSeconds: 86400,
      inputHashes, passed: result.passed, failed: result.failed, checks: result.checks,
      limitations: result.limitations
    },
    {
      id: "LOCAL-NODE-TESTS-01", status: tests.status === 0 ? "passed-local-synthetic-only" : "failed",
      scopeKind: "offline-code-and-record-tests", scope: "Owned Node tests: schema state distinction, graph/control/source/engine integration, diagram geometry, reader escaping and exact local-model failure cases.",
      countsAsLiveValidation: false, executed: true,
      command: `node --test --test-reporter=tap reference-validation\\tests\\reference-validation.test.mjs`,
      startedAt: testsStartedAt.toISOString(), endedAt: testsEndedAt.toISOString(),
      wallDurationMilliseconds: testsEndedAt - testsStartedAt,
      exitCode: tests.status, signal: tests.signal, error: tests.error?.message ?? null,
      expected: ["Node test process exits zero and reports no failed tests."],
      observed: testOutput,
      summary: Object.fromEntries(["tests", "pass", "fail", "skipped"].map(key => [key, Number(testOutput.match(new RegExp(`# ${key} (\\d+)`))?.[1] ?? -1)])),
      limitations: ["Static/code/model tests are not tenant sign-ins, PHS recovery, configuration restoration or OT/platform safety evidence."]
    },
    ...blocked
  ]
};
write(["evidence", "executions.json"], execution);
for (const id of ["e1", "e2", "e3"]) {
  const record = readJson("cases", `${id}.json`);
  record.validation.executedEvidenceRefs = id === "e1" ? ["LOCAL-NODE-TESTS-01"] : ["LOCAL-NODE-TESTS-01", "LOCAL-SYNTHETIC-01"];
  if (id !== "e1") {
    const scenario = record.validation.scenarios.find(item => item.id === `${id.toUpperCase()}-V01`);
    const prefix = id === "e2" ? "E2-" : "S3-";
    const checks = result.checks.filter(item => item.id.startsWith(prefix));
    scenario.status = checks.every(item => item.status === "passed-local-synthetic-only") ? "passed-local-synthetic-only" : "failed";
    scenario.observed = checks.map(item => `${item.id}: ${JSON.stringify(item.observed)} — ${item.scope}`);
    scenario.evidenceRefs = checks.map(item => `LOCAL-SYNTHETIC-01#${item.id}`);
    record.validation.overallStatus = result.failed ? "failed" : "partial-local-synthetic-only";
  }
  write(["cases", `${id}.json`], record);
}
const r4 = readJson("runbooks", "r4-s3-outage.json");
r4.validation.observed = [
  `${result.checks.filter(item => item.id.startsWith("S3-")).length} exact in-memory S3 model checks executed; inspect per-check observed values in LOCAL-SYNTHETIC-01.`,
  "No real identity/policy/logging/communications/key/time/DNS/PKI service, physical safety action, network loss or 24-hour endurance was executed."
];
r4.validation.evidenceRefs = ["LOCAL-SYNTHETIC-01"];
r4.validation.localExecution = { executed: true, scopeKind: "local-synthetic-only", status: result.failed ? "failed" : "passed-local-synthetic-only", evidenceRef: "LOCAL-SYNTHETIC-01" };
write(["runbooks", "r4-s3-outage.json"], r4);
build();
const audit = validateAll({ requireBrowser: false });
console.log(JSON.stringify({ localChecks: { passed: result.passed, failed: result.failed }, nodeTests: execution.records[1].summary, nodeExitCode: tests.status, auditErrors: audit.errors, browserRecheckRequiredAfterReaderGeneration: true, operationalAcceptance: execution.releaseAcceptance }, null, 2));
if (tests.status !== 0 || result.failed || audit.errors.length) process.exitCode = 1;
