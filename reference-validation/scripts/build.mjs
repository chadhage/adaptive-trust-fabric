import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { sha256 } from "./local-models.mjs";
import { createReader } from "./reader.mjs";
import { referenceRoot, projectRoot, readJson } from "./validate.mjs";

const require = createRequire(import.meta.url);
const writeJson = (relative, value) => fs.writeFileSync(path.join(referenceRoot, relative), JSON.stringify(value, null, 2) + "\n", "utf8");
const xml = value => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const wrap = (text, length = 72) => {
  const lines = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      if (line.length && line.length + word.length + 1 > length) { lines.push(line); line = ""; }
      line += (line ? " " : "") + word;
    }
    lines.push(line);
  }
  return lines.join("\n");
};

function createDiagram(record, kind) {
  const graph = kind === "authority" ? record.authorityGraph : record.recoveryGraph;
  const prefix = `${record.id.toLowerCase()}-${kind}`;
  const elements = [];
  const labels = new Map(graph.nodes.map(node => [node.id, node.label]));
  const canvasWidth = 1880;
  const base = (id, type, x, y, width, height, color = "#0078D4") => ({
    id: `${prefix}-${id}`, type, x, y, width, height, angle: 0, strokeColor: color,
    backgroundColor: "transparent", fillStyle: "solid", strokeWidth: 2, strokeStyle: "solid",
    roughness: 0, opacity: 100, groupIds: [], frameId: null, index: null, roundness: null,
    seed: elements.length + 1, version: 1, versionNonce: elements.length + 100, isDeleted: false,
    boundElements: null, updated: 1, link: null, locked: false
  });
  const text = (id, message, x, y, width, fontSize = 14, container = null) => {
    const lineCount = message.split("\n").length;
    const item = {
      ...base(id, "text", x, y, width, fontSize * 2.5 * lineCount, "#000000"),
      text: message, originalText: message, fontSize, fontFamily: 2, lineHeight: 2.5,
      textAlign: "left", verticalAlign: "top", containerId: container, autoResize: false
    };
    elements.push(item);
    return item;
  };
  const box = (id, message, x, y, width, color) => {
    const messageWrapped = wrap(message, 32);
    const height = 14 * 2.5 * messageWrapped.split("\n").length + 24;
    const item = base(id, "rectangle", x, y, width, height, color);
    elements.push(item);
    const caption = text(`${id}-text`, messageWrapped, x + 12, y + 12, width - 24, 14, item.id);
    item.boundElements = [{ type: "text", id: caption.id }];
    return item;
  };
  text("title", `${record.id} ${kind === "authority" ? "directed authority" : "recovery dependencies"} — synthetic edge view`, 40, 20, 1800, 24);
  text("insight", wrap(kind === "authority"
    ? "Arrow: from exercises the listed permission over to. Credential, delegation and revocation belong to that edge. Repeated node boxes are occurrences of the same logical record node. No deployed authority was inspected."
    : "Arrow: recovering component depends on target. RED dashed edges are rejected alternatives, retained to expose bootstrap cycles; they are excluded from the selected dependency graph. Design mitigation is NOT tested recovery.", 140), 40, 100, 1800, 14);
  let y = 260;
  for (const edge of graph.edges) {
    const rejected = kind === "recovery" && graph.rejectedEdgeIds.includes(edge.id);
    const color = rejected ? "#D13438" : kind === "authority" ? "#0078D4" : "#5C2D91";
    const heading = `${edge.id}${rejected ? " — REJECTED DESIGN" : ""}`;
    text(`${edge.id}-heading`, heading, 60, y, 1760, 16);
    const message = wrap(kind === "authority" ? edge.permission : edge.dependency, 80);
    const label = text(`${edge.id}-meaning`, message, 490, y + 55, 900, 12);
    const boxY = label.y + label.height + 16;
    const left = box(`${edge.id}-source`, `${edge.from}\n${labels.get(edge.from)}`, 60, boxY, 400, color);
    const right = box(`${edge.id}-target`, `${edge.to}\n${labels.get(edge.to)}`, 1420, boxY, 400, color);
    const centerY = boxY + Math.max(left.height, right.height) / 2;
    const arrow = {
      ...base(`${edge.id}-arrow`, "arrow", 470, centerY, 940, 0, color),
      points: [[0, 0], [940, 0]], startBinding: { elementId: left.id, focus: 0, gap: 10 },
      endBinding: { elementId: right.id, focus: 0, gap: 10 },
      startArrowhead: null, endArrowhead: "arrow", elbowed: false,
      customData: { edgeId: edge.id, from: edge.from, to: edge.to, rejected }
    };
    if (rejected) arrow.strokeStyle = "dashed";
    elements.push(arrow);
    left.boundElements.push({ type: "arrow", id: arrow.id });
    right.boundElements.push({ type: "arrow", id: arrow.id });
    const belowY = boxY + Math.max(left.height, right.height) + 20;
    const detail = kind === "authority"
      ? `Credential: ${edge.credential}\nDelegation: ${edge.delegation}\nRevoke — ${edge.revocation.actor}: ${edge.revocation.mechanism}\nTiming/residual: ${edge.revocation.latencyLimit} ${edge.revocation.residualAccess}`
      : `Failure: ${edge.failureEffect}\nAlternative: ${edge.alternative}`;
    const description = text(`${edge.id}-details`, wrap(detail, 168), 60, belowY, 1760, 12);
    y = description.y + description.height + 64;
  }
  const note = kind === "authority" ? `Forbidden authority paths:\n${graph.forbiddenPaths.join("\n")}`
    : `Known cycles:\n${graph.cycles.map(cycle => `${cycle.id}: ${cycle.nodeIds.join(" -> ")}; ${cycle.status}. ${cycle.mitigation}`).join("\n")}\nIndependent anchors:\n${graph.independentAnchors.map(anchor => `${anchor.nodeId}: independent of ${anchor.independentOf.join(", ")}; still depends on ${anchor.remainingDependencies.join(", ")}. Proof: ${anchor.proofRequired}`).join("\n")}`;
  const finalNote = text("limits", wrap(note, 168), 60, y, 1760, 12);
  const canvasHeight = finalNote.y + finalNote.height + 60;
  elements.unshift({
    ...base("container", "rectangle", 20, 220, 1840, canvasHeight - 240, "#495057"),
    customData: { role: "container" }
  });
  return {
    type: "excalidraw", version: 2, source: "adaptive-trust-fabric-local-generator",
    elements, appState: { viewBackgroundColor: "#ffffff", gridSize: null },
    files: {},
    customData: { caseId: record.id, kind, canvasWidth, canvasHeight, scope: "synthetic-only", recordPath: `cases/${record.id.toLowerCase()}.json` }
  };
}

export function diagramToSvg(diagram) {
  const { canvasWidth, canvasHeight } = diagram.customData;
  const colors = ["#0078D4", "#5C2D91", "#D13438"];
  const markers = colors.map((color, index) => `<marker id="arrow-${index}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${color}"/></marker>`).join("");
  const output = [`<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}" role="img" aria-labelledby="diagram-title diagram-description">`,
    `<title id="diagram-title">${xml(diagram.customData.caseId + " " + diagram.customData.kind + " synthetic directed graph")}</title>`,
    '<desc id="diagram-description">Offline edge view. Repeated boxes refer to the same logical node IDs. Synthetic architecture only, not service or recovery validation. Red dashed edges are rejected designs.</desc>',
    `<rect width="${canvasWidth}" height="${canvasHeight}" fill="#ffffff"/><defs>${markers}</defs>`];
  for (const item of diagram.elements) {
    if (item.type === "rectangle") output.push(`<rect x="${item.x}" y="${item.y}" width="${item.width}" height="${item.height}" rx="6" fill="none" stroke="${item.strokeColor}" stroke-width="${item.strokeWidth}"/>`);
    if (item.type === "arrow") output.push(`<path d="M ${item.x} ${item.y} L ${item.x + item.width} ${item.y + item.height}" fill="none" stroke="${item.strokeColor}" stroke-width="2"${item.strokeStyle === "dashed" ? ' stroke-dasharray="10 8"' : ""} marker-end="url(#arrow-${colors.indexOf(item.strokeColor)})"/>`);
    if (item.type === "text") {
      const inset = item.fontSize / 2;
      const lines = item.text.split("\n").map((line, index) => `<tspan x="${item.x + inset}" y="${item.y + item.fontSize * 1.25 + index * item.fontSize * 2.5}">${xml(line)}</tspan>`).join("");
      output.push(`<text id="${xml(item.id)}" fill="#000000" font-family="Segoe UI, Arial, sans-serif" font-size="${item.fontSize}">${lines}</text>`);
    }
  }
  output.push("</svg>\n");
  return output.join("\n");
}

export function build() {
  const canonicalFile = path.join(projectRoot, "adaptive-trust-fabric-microsite", "data", "research.json");
  const canonicalBytes = fs.readFileSync(canonicalFile);
  const canonical = JSON.parse(canonicalBytes);
  const engine = require(path.join(projectRoot, "adaptive-trust-fabric-microsite", "assets", "assessment.js"));
  const cases = ["e1", "e2", "e3"].map(id => readJson("cases", `${id}.json`));
  fs.mkdirSync(path.join(referenceRoot, "diagrams"), { recursive: true });
  for (const record of cases) {
    for (const fact of record.sourceFacts) {
      const claimRefs = canonical.claims.filter(claim => fact.claimIds.includes(claim.id)).flatMap(claim => claim.evidence?.source_refs ?? []);
      const sourceRefs = canonical.sources.filter(source => fact.sourceIds.includes(source.id)).flatMap(source => source.evidence?.source_refs ?? []);
      const refs = [...claimRefs, ...sourceRefs].filter(ref => fact.sourceIds.includes(ref.source_id));
      fact.evidence.source_refs = [...new Map(refs.map(ref => [JSON.stringify(ref), ref])).values()];
      fact.evidence.verified_on = fact.evidence.source_refs.map(ref => ref.verified_on).filter(Boolean).sort().at(-1) ?? null;
      fact.evidence.confidence_rationale = "Derived restatement of the final canonical documentary source records below; the synthetic requirements and all operational applicability remain declared or unknown.";
    }
    record.decision.assessmentOutput = engine.assess(record.decision.assessmentInput);
    writeJson(path.join("cases", `${record.id.toLowerCase()}.json`), record);
    for (const kind of ["authority", "recovery"]) {
      const diagram = createDiagram(record, kind);
      writeJson(path.join("diagrams", `${record.id.toLowerCase()}-${kind}.excalidraw`), diagram);
      fs.writeFileSync(path.join(referenceRoot, "diagrams", `${record.id.toLowerCase()}-${kind}.svg`), diagramToSvg(diagram), "utf8");
    }
  }
  const runbookPaths = {
    R1: "runbooks/r1-emergency.json", R2: "runbooks/r2-phs.json",
    R3: "runbooks/r3-tenant-restore.json", R4: "runbooks/r4-s3-outage.json"
  };
  const runbooks = Object.values(runbookPaths).map(relative => readJson(...relative.split("/")));
  const evidencePath = path.join(referenceRoot, "evidence", "executions.json");
  const executions = fs.existsSync(evidencePath) ? JSON.parse(fs.readFileSync(evidencePath, "utf8")) : { generatedAt: null, records: [] };
  const data = { cases, runbooks, runbookPaths, authorization: readJson("evidence", "authorization-request.json"), executions };
  fs.writeFileSync(path.join(referenceRoot, "index.html"), createReader(data), "utf8");
  writeJson("catalog.json", {
    schemaVersion: "1.0.0",
    scopeKind: "synthetic-only",
    canonicalData: { path: "adaptive-trust-fabric-microsite/data/research.json", sha256: sha256(canonicalBytes.toString("utf8")), claims: canonical.claims.length, controls: canonical.normativeControls.length, capabilities: canonical.capabilityMatrix?.length ?? 0 },
    assessment: {
      contractVersion: engine.contractVersion,
      path: "adaptive-trust-fabric-microsite/assets/assessment.js",
      sha256: sha256(fs.readFileSync(path.join(projectRoot, "adaptive-trust-fabric-microsite", "assets", "assessment.js"), "utf8")),
      states: Object.fromEntries(cases.map(record => [record.id, record.decision.assessmentOutput.state]))
    },
    cases: cases.map(record => ({ id: record.id, title: record.title, path: `cases/${record.id.toLowerCase()}.json`, anchor: `index.html#case-${record.id}`, status: record.validation.overallStatus })),
    runbooks: runbooks.map(record => ({ id: record.id, title: record.title, path: runbookPaths[record.id], anchor: `index.html#runbook-${record.id}`, implementationStatus: record.implementationStatus, validationStatus: record.validation.status })),
    operationalAcceptance: "blocked-no-authorized-lab",
    regeneratedBy: "node reference-validation\\scripts\\build.mjs"
  });
  return { cases: cases.length, runbooks: runbooks.length, editableDiagrams: 6, svgExports: 6, engineStates: cases.map(record => `${record.id}:${record.decision.assessmentOutput.state}`) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(build(), null, 2));
