import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const SYNTHETIC_KEY = Buffer.from("insecure-local-fixture-key-not-a-production-credential");
export const sha256 = value => createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");

export function signSyntheticCredential(payload, key = SYNTHETIC_KEY) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${createHmac("sha256", key).update(body).digest("base64url")}`;
}

export class LocalSiteFixture {
  #key;
  #serial = 0;

  constructor({ nowSeconds = 0, capacity = 32, key = randomBytes(32) } = {}) {
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 1024) throw new RangeError("Fixture capacity must be 1..1024.");
    this.#key = key;
    this.nowSeconds = nowSeconds;
    this.outageStartedAt = nowSeconds;
    this.maximumAutonomySeconds = 86400;
    this.maximumCredentialSeconds = 900;
    this.keyExpiresAt = nowSeconds + 172800;
    this.pkiExpiresAt = nowSeconds + 172800;
    this.revocationValidUntil = nowSeconds + 86400;
    this.clockDriftSeconds = 0;
    this.keyAvailable = true;
    this.dnsAvailable = true;
    this.pkiAvailable = true;
    this.communicationsAvailable = true;
    this.upstreamAvailable = false;
    this.reconciled = false;
    this.safetyHold = false;
    this.mode = "local";
    this.capacity = capacity;
    this.policyVersion = "quarry-local-policy-1";
    this.roles = new Map([
      ["operator-local", new Set(["operator"])],
      ["safety-local", new Set(["safety"])],
      ["recovery-local", new Set(["recovery"])]
    ]);
    this.revokedSubjects = new Set();
    this.log = [];
    this.messages = [];
    this.exportAcknowledgedDigest = null;
  }

  dependencyFailure() {
    if (!this.keyAvailable || this.nowSeconds >= this.keyExpiresAt) return "local-key-unavailable-or-expired";
    if (Math.abs(this.clockDriftSeconds) > 60) return "clock-bound-exceeded";
    if (!this.dnsAvailable) return "local-name-unavailable";
    if (!this.pkiAvailable || this.nowSeconds >= this.pkiExpiresAt) return "local-trust-unavailable-or-expired";
    if (this.nowSeconds >= this.revocationValidUntil && !this.reconciled) return "revocation-material-expired";
    if (!this.communicationsAvailable) return "required-local-communications-unavailable";
    return null;
  }

  refreshMode() {
    const durationExceeded = !this.upstreamAvailable && this.nowSeconds - this.outageStartedAt >= this.maximumAutonomySeconds;
    if (durationExceeded || this.dependencyFailure() || this.safetyHold || (this.upstreamAvailable && !this.reconciled)) {
      this.mode = "safe-stopped";
    } else if (this.log.length >= this.capacity) {
      this.mode = "read-only";
    } else {
      this.mode = "local";
    }
    return this.mode;
  }

  issueCredential(subject, lifetimeSeconds = this.maximumCredentialSeconds) {
    if (!this.roles.has(subject) || this.revokedSubjects.has(subject) || this.refreshMode() !== "local") return null;
    if (!Number.isInteger(lifetimeSeconds) || lifetimeSeconds < 1 || lifetimeSeconds > this.maximumCredentialSeconds) return null;
    return signSyntheticCredential({
      issuer: "quarry-local",
      audience: "quarry-ops",
      subject,
      issuedAt: this.nowSeconds,
      expiresAt: this.nowSeconds + lifetimeSeconds,
      tokenId: `local-token-${++this.#serial}`
    }, this.#key);
  }

  verifyCredential(token) {
    if (typeof token !== "string") return { valid: false, reason: "invalid-credential" };
    const parts = token.split(".");
    if (parts.length !== 2) return { valid: false, reason: "invalid-credential" };
    const [body, signature] = parts;
    const expected = createHmac("sha256", this.#key).update(body).digest();
    let payload;
    try {
      const actual = Buffer.from(signature, "base64url");
      if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return { valid: false, reason: "signature-mismatch" };
      payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    } catch {
      return { valid: false, reason: "invalid-credential" };
    }
    if (payload.issuer !== "quarry-local") return { valid: false, reason: "wrong-issuer" };
    if (payload.audience !== "quarry-ops") return { valid: false, reason: "wrong-audience" };
    if (!this.roles.has(payload.subject)) return { valid: false, reason: "unknown-local-subject" };
    if (this.revokedSubjects.has(payload.subject)) return { valid: false, reason: "locally-revoked" };
    if (!Number.isFinite(payload.issuedAt) || !Number.isFinite(payload.expiresAt) ||
        payload.issuedAt > this.nowSeconds || payload.expiresAt <= this.nowSeconds ||
        payload.expiresAt <= payload.issuedAt || payload.expiresAt - payload.issuedAt > this.maximumCredentialSeconds) {
      return { valid: false, reason: "expired-or-invalid-time" };
    }
    return { valid: true, reason: "local-credential-valid", subject: payload.subject };
  }

  appendEvent(event) {
    if (this.log.length >= this.capacity) {
      this.refreshMode();
      return false;
    }
    const record = {
      sequence: this.log.length + 1,
      atLogicalSeconds: this.nowSeconds,
      event,
      previousHash: this.log.at(-1)?.hash ?? "0".repeat(64)
    };
    this.log.push({ ...record, hash: sha256(record) });
    this.refreshMode();
    return true;
  }

  perform(token, action) {
    this.refreshMode();
    if (this.mode === "safe-stopped") return { allowed: false, reason: this.safetyHold ? "local-safety-hold" : this.dependencyFailure() ?? "autonomy-or-reconciliation-gate" };
    const identity = this.verifyCredential(token);
    if (!identity.valid) return { allowed: false, reason: identity.reason };
    if (!["telemetry.read", "alarm.ack"].includes(action)) return { allowed: false, reason: "action-not-permitted" };
    if (!this.roles.get(identity.subject).has("operator")) return { allowed: false, reason: "role-not-permitted" };
    if (this.mode === "read-only" && action !== "telemetry.read") return { allowed: false, reason: "evidence-capacity-read-only" };
    const recorded = this.mode === "local" && this.appendEvent({ subject: identity.subject, action, policyVersion: this.policyVersion });
    return { allowed: true, reason: this.mode === "read-only" && !recorded ? "read-only-existing-telemetry" : "local-policy-permit", recorded: Boolean(recorded) };
  }

  revoke(subject) {
    this.revokedSubjects.add(subject);
  }

  sendMessage(from, to, text) {
    if (!this.communicationsAvailable || !this.roles.has(from) || !this.roles.has(to) || this.messages.length >= 8) return null;
    const message = { id: `message-${this.messages.length + 1}`, from, to, text: String(text).slice(0, 256), acknowledged: false };
    this.messages.push(message);
    return message.id;
  }

  acknowledgeMessage(id, actor) {
    const message = this.messages.find(item => item.id === id);
    if (!message || actor !== message.to || !this.communicationsAvailable) return false;
    message.acknowledged = true;
    return true;
  }

  safetyStop(actor) {
    if (!this.roles.get(actor)?.has("safety") || this.revokedSubjects.has(actor)) return false;
    this.safetyHold = true;
    this.refreshMode();
    return true;
  }

  restart(actors) {
    const localRoles = new Set(actors.filter(actor => !this.revokedSubjects.has(actor)).flatMap(actor => [...(this.roles.get(actor) ?? [])]));
    if (!localRoles.has("safety") || !localRoles.has("recovery") || this.dependencyFailure()) return false;
    if (!this.upstreamAvailable && this.nowSeconds - this.outageStartedAt >= this.maximumAutonomySeconds) return false;
    if (this.upstreamAvailable && !this.reconciled) return false;
    this.safetyHold = false;
    return this.refreshMode() === "local";
  }

  reconnect() {
    this.upstreamAvailable = true;
    this.reconciled = false;
    this.refreshMode();
  }

  reconcile({ policyVersion, revocations = [] }) {
    if (!this.upstreamAvailable || policyVersion !== this.policyVersion) return false;
    for (const subject of revocations) this.revokedSubjects.add(subject);
    this.reconciled = true;
    this.refreshMode();
    return true;
  }

  prepareExport() {
    const records = structuredClone(this.log);
    return { records, digest: sha256(records) };
  }

  acknowledgeExport(digest) {
    if (digest !== this.prepareExport().digest) return false;
    this.exportAcknowledgedDigest = digest;
    return true;
  }
}

export function verifyHashLinkedLog(records) {
  let previous = "0".repeat(64);
  for (let i = 0; i < records.length; i++) {
    const { hash, ...body } = records[i];
    if (body.sequence !== i + 1 || body.previousHash !== previous || sha256(body) !== hash) return false;
    previous = hash;
  }
  return true;
}

export class AcquisitionFixture {
  constructor() {
    this.nowSeconds = 0;
    this.issuer = "https://orbit.example.invalid";
    this.application = "sanitized-deal-room";
    this.members = new Set(Array.from({ length: 10 }, (_, index) => `orbit-synthetic-${index + 1}`));
    this.homeEnabled = new Set(this.members);
    this.sponsorExpiresAt = 30 * 86400;
    this.trustEnabled = true;
    this.applicationEnabled = true;
    this.sessions = new Map();
    this.deniedSubjects = new Set();
    this.revokedSessions = new Set();
    this.workloadBindings = new Set(["transition-deploy-binding"]);
  }

  signIn({ subject, issuer = this.issuer, application = this.application }) {
    if (!this.trustEnabled || !this.applicationEnabled || issuer !== this.issuer || application !== this.application ||
        !this.members.has(subject) || !this.homeEnabled.has(subject) || this.deniedSubjects.has(subject) ||
        this.nowSeconds >= this.sponsorExpiresAt) return null;
    const id = `deal-session-${this.sessions.size + 1}`;
    this.sessions.set(id, { subject, expiresAt: this.nowSeconds + 3600 });
    return id;
  }

  useSession(id, action = "document.read") {
    const session = this.sessions.get(id);
    return Boolean(session && this.applicationEnabled && action === "document.read" &&
      !this.revokedSessions.has(id) && !this.deniedSubjects.has(session.subject) && this.nowSeconds < session.expiresAt);
  }

  disableHome(subject) {
    this.homeEnabled.delete(subject);
  }

  denyAtResource(subject) {
    this.members.delete(subject);
    this.deniedSubjects.add(subject);
    for (const [id, session] of this.sessions) if (session.subject === subject) this.revokedSessions.add(id);
  }

  canDeploy(binding) {
    return this.applicationEnabled && this.workloadBindings.has(binding);
  }

  separate() {
    for (const subject of this.members) this.deniedSubjects.add(subject);
    this.members.clear();
    this.trustEnabled = false;
    this.applicationEnabled = false;
    this.workloadBindings.clear();
    for (const id of this.sessions.keys()) this.revokedSessions.add(id);
  }
}

export function runSyntheticChecks() {
  const checks = [];
  const check = (id, scope, expected, observed) => checks.push({
    id, scope, expected, observed,
    status: JSON.stringify(expected) === JSON.stringify(observed) ? "passed-local-synthetic-only" : "failed"
  });
  const site = () => new LocalSiteFixture({ key: SYNTHETIC_KEY });
  const primary = site();
  const operator = primary.issueCredential("operator-local");
  check("S3-01", "Ephemeral local HMAC credential and local policy only", true, primary.perform(operator, "telemetry.read").allowed);
  check("S3-02", "Central-only identity is not enrolled in the local fixture", null, primary.issueCredential("central-admin"));
  check("S3-03", "Local allow-list denies a physical-control action", false, primary.perform(operator, "plc.write").allowed);
  check("S3-04", "Local allow-list permits only the declared synthetic alarm acknowledgement", true, primary.perform(operator, "alarm.ack").allowed);
  const payload = JSON.parse(Buffer.from(operator.split(".")[0], "base64url").toString("utf8"));
  check("S3-05", "Issuer check after a valid fixture signature; not PKI/Entra testing", "wrong-issuer", primary.verifyCredential(signSyntheticCredential({ ...payload, issuer: "corporate" })).reason);
  check("S3-06", "Audience check after a valid fixture signature", "wrong-audience", primary.verifyCredential(signSyntheticCredential({ ...payload, audience: "different-app" })).reason);
  check("S3-07", "Tampered fixture credential is rejected", false, primary.verifyCredential(`${operator.split(".")[0]}x.${operator.split(".")[1]}`).valid);
  primary.revoke("operator-local");
  check("S3-08", "Local in-memory revocation denies the next modeled action", "locally-revoked", primary.perform(operator, "alarm.ack").reason);
  const expiring = site();
  const short = expiring.issueCredential("operator-local");
  expiring.nowSeconds = 900;
  check("S3-09", "Accelerated logical credential expiry at exactly 15 minutes", "expired-or-invalid-time", expiring.verifyCredential(short).reason);
  check("S3-10", "Local hash linkage over recorded fixture events", true, verifyHashLinkedLog(primary.log));
  const changedLog = structuredClone(primary.log);
  changedLog[0].event.action = "altered-history";
  check("S3-11", "Detection of one changed historical in-memory record; no independent integrity anchor", false, verifyHashLinkedLog(changedLog));
  const bounded = new LocalSiteFixture({ capacity: 2, key: SYNTHETIC_KEY });
  const boundedOperator = bounded.issueCredential("operator-local");
  bounded.perform(boundedOperator, "alarm.ack");
  bounded.perform(boundedOperator, "alarm.ack");
  check("S3-12", "Bounded queue becomes read-only at capacity with no silent discard", { mode: "read-only", allowed: false, retained: 2 }, { mode: bounded.mode, allowed: bounded.perform(boundedOperator, "alarm.ack").allowed, retained: bounded.log.length });
  const comms = site();
  const message = comms.sendMessage("operator-local", "safety-local", "Synthetic alarm only");
  check("S3-13", "In-memory local mailbox send/recipient acknowledgement; not radio/intercom", true, comms.acknowledgeMessage(message, "safety-local"));
  for (const [id, field, value, description] of [
    ["S3-14", "keyAvailable", false, "local key availability flag"],
    ["S3-15", "clockDriftSeconds", 61, "logical clock error above the declared 60-second bound"],
    ["S3-16", "dnsAvailable", false, "local name availability flag"],
    ["S3-17", "pkiExpiresAt", 0, "local PKI-expiry flag"],
    ["S3-18", "communicationsAvailable", false, "required local communications flag"]
  ]) {
    const faulty = site();
    const token = faulty.issueCredential("operator-local");
    faulty[field] = value;
    check(id, `One-fault gate: ${description}; not an actual service test`, { allowed: false, mode: "safe-stopped" }, { allowed: faulty.perform(token, "alarm.ack").allowed, mode: faulty.mode });
  }
  const duration = site();
  duration.nowSeconds = 86400;
  check("S3-19", "Accelerated logical 24-hour boundary; not a wall-clock endurance test", "safe-stopped", duration.refreshMode());
  const safety = site();
  check("S3-20", "Local safety-role flag can stop the model", true, safety.safetyStop("safety-local"));
  check("S3-21", "Central-only actor cannot bypass local safety/recovery restart gate", false, safety.restart(["central-admin"]));
  check("S3-22", "One local role alone cannot satisfy joint restart", false, safety.restart(["safety-local"]));
  check("S3-23", "Both local roles restore only the healthy software model", true, safety.restart(["safety-local", "recovery-local"]));
  const before = primary.prepareExport();
  primary.reconnect();
  check("S3-24", "Reconnection alone does not resume operations", "safe-stopped", primary.mode);
  primary.reconcile({ policyVersion: primary.policyVersion });
  check("S3-25", "Reconciliation retains local revocation; no actual ingestion service", "locally-revoked", primary.perform(operator, "alarm.ack").reason);
  check("S3-26", "Local export records remain until and after matching receipt, without claiming external durability", { sameDigest: true, receiptAccepted: true, retained: before.records.length }, { sameDigest: primary.prepareExport().digest === before.digest, receiptAccepted: primary.acknowledgeExport(before.digest), retained: primary.log.length });
  const acquisition = new AcquisitionFixture();
  const request = { subject: "orbit-synthetic-1" };
  const session = acquisition.signIn(request);
  check("E2-01", "Named source/cohort/app can read the synthetic document", true, acquisition.useSession(session));
  check("E2-02", "Unlisted user, issuer, app and admin action are denied by the local model", [null, null, null, false], [
    acquisition.signIn({ subject: "unlisted" }),
    acquisition.signIn({ ...request, issuer: "https://wrong.example.invalid" }),
    acquisition.signIn({ ...request, application: "another-app" }),
    acquisition.useSession(session, "tenant.admin")
  ]);
  acquisition.disableHome(request.subject);
  check("E2-03", "Source disablement blocks new model sign-in but does not magically revoke a resource session", { fresh: null, oldSession: true }, { fresh: acquisition.signIn(request), oldSession: acquisition.useSession(session) });
  acquisition.denyAtResource(request.subject);
  check("E2-04", "Explicit resource-side denial removes the existing model session", false, acquisition.useSession(session));
  const secondSession = acquisition.signIn({ subject: "orbit-synthetic-2" });
  acquisition.separate();
  check("E2-05", "Modeled separation denies fresh and old sessions and removes deployment binding", { fresh: null, oldSession: false, deploy: false, memberships: 0, trust: false }, {
    fresh: acquisition.signIn({ subject: "orbit-synthetic-2" }),
    oldSession: acquisition.useSession(secondSession),
    deploy: acquisition.canDeploy("transition-deploy-binding"),
    memberships: acquisition.members.size,
    trust: acquisition.trustEnabled
  });
  const expiredSponsor = new AcquisitionFixture();
  expiredSponsor.nowSeconds = expiredSponsor.sponsorExpiresAt;
  check("E2-06", "Expired sponsorship denies new model access at exactly 30 logical days", null, expiredSponsor.signIn(request));
  return {
    scopeKind: "local-synthetic-only",
    countsAsLiveValidation: false,
    checks,
    passed: checks.filter(item => item.status === "passed-local-synthetic-only").length,
    failed: checks.filter(item => item.status === "failed").length,
    limitations: [
      "No network API, credential store, tenant, subscription, AD service or equipment is accessed.",
      "HMAC key is ephemeral or an explicitly insecure fixture key; this is not production identity/cryptographic assurance.",
      "Key/DNS/time/PKI/communications failures are input flags or logical values, not real services.",
      "Logs are bounded in-memory hash-linked fixtures, not independently anchored, durable or tamper-proof storage.",
      "Logical time is accelerated; no 24-hour endurance or real revocation latency was measured.",
      "No physical actuation, hazard assessment, interlock or actual safe-state/restart was exercised.",
      "Acquisition separation demonstrates only this local app/session model, not Entra or a deployed application."
    ]
  };
}
