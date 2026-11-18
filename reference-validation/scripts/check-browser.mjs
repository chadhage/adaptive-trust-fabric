import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { withLocalBrowser } from "../../tools/validate-browser-runtime.mjs";
import { referenceRoot, readJson } from "./validate.mjs";
import { sha256 } from "./local-models.mjs";

const options = {};
for (let index = 2; index < process.argv.length; index += 2) {
  const flag = process.argv[index];
  if (!["--browser", "--profile", "--output"].includes(flag) || !process.argv[index + 1]) throw new Error("Usage: node reference-validation\\scripts\\check-browser.mjs --browser <installed-executable> --profile <new-owned-session-directory> --output <authorized-session-evidence-directory>");
  options[flag.slice(2)] = path.resolve(process.argv[index + 1]);
}
if (!options.profile || !options.output) throw new Error("Explicit new owned profile and session evidence output directories are required. No package or browser is installed.");
fs.mkdirSync(options.output, { recursive: true });
const startedAt = new Date();
const report = {
  schemaVersion: "1.0.0", id: "LOCAL-BROWSER-01", status: "running",
  scopeKind: "local-file-reader-and-svg-only", countsAsLiveValidation: false,
  authorizationRef: "AUTH-REQUEST-01", startedAt: startedAt.toISOString(),
  network: "Owned headless browser; HTTP(S) blocked and CDP offline emulation. No external page or upload.",
  results: [], screenshots: [], inputHashes: [],
  limitations: ["Reader rendering, native keyboard behavior and SVG geometry only.", "No cloud, identity, network interruption, OT service, physical safety or recovery exercise.", "Navigator online status alone is not proof of network behavior; actual HTTP attempts are inspected."]
};
const reportFile = path.join(referenceRoot, "evidence", "browser-checks.json");
if (fs.existsSync(reportFile)) {
  const previous = JSON.parse(fs.readFileSync(reportFile, "utf8"));
  report.previousAttempts = [
    ...(previous.previousAttempts ?? []),
    {
      startedAt: previous.startedAt, endedAt: previous.endedAt, status: previous.status,
      passed: previous.passed, failed: previous.failed, inputHashes: previous.inputHashes,
      failures: previous.results.filter(item => !item.passed)
    }
  ];
}
const check = (id, expected, observed) => report.results.push({ id, expected, observed, passed: JSON.stringify(expected) === JSON.stringify(observed) });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const fileInput = relative => {
  const file = path.join(referenceRoot, ...relative.split("/"));
  report.inputHashes.push({ path: relative, algorithm: "sha256", value: sha256(fs.readFileSync(file, "utf8")) });
  return file;
};
const readerPath = fileInput("index.html");
fileInput("scripts/check-browser.mjs");
fileInput("../tools/validate-browser-runtime.mjs");
try {
  await withLocalBrowser(options, async ({ send, evaluate, events, version }) => {
    report.browser = { product: version.product, jsVersion: version.jsVersion };
    const navigate = async (file, query = "", ready = false) => {
      const url = pathToFileURL(file).href + query;
      await send("Page.navigate", { url });
      for (let attempt = 0; attempt < 150; attempt++) {
        if (await evaluate(`location.href === ${JSON.stringify(url)} && document.readyState === "complete"${ready ? ' && document.documentElement.dataset.readerReady === "true"' : ""}`)) {
          await evaluate("document.fonts.ready.then(() => true)");
          return;
        }
        await pause(50);
      }
      throw new Error("Bounded local navigation did not finish.");
    };
    const key = async (name = "Enter") => {
      const code = name === " " ? "Space" : name;
      const number = name === " " ? 32 : 13;
      await send("Input.dispatchKeyEvent", { type: "keyDown", key: name, code, windowsVirtualKeyCode: number, nativeVirtualKeyCode: number, text: name === " " ? " " : "\r" });
      await send("Input.dispatchKeyEvent", { type: "keyUp", key: name, code, windowsVirtualKeyCode: number, nativeVirtualKeyCode: number });
      await pause(50);
    };
    for (const width of [1440, 320]) for (const theme of ["light", "dark"]) {
      await send("Emulation.setDeviceMetricsOverride", { width, height: 960, deviceScaleFactor: 1, mobile: false });
      await navigate(readerPath, `?clawpilotTheme=${theme}`, true);
      check(`reader-${width}-${theme}-theme`, theme, await evaluate("document.documentElement.dataset.theme"));
      check(`reader-${width}-${theme}-rendered-records`, [26, 26, 26], await evaluate(`["E1","E2","E3"].map(id => [...document.querySelectorAll("#case-"+id+" details")].find(item => item.querySelector("summary")?.textContent.startsWith("All 26 controls"))?.querySelectorAll("tbody tr").length)`));
      check(`reader-${width}-${theme}-blocked-operations-visible`, true, await evaluate(`document.body.textContent.includes("No Entra, AD/PHS, Azure Local or OT lab is authorized.") && document.querySelector("#runbook-R2").textContent.includes("does not automatically")`));
      await evaluate('document.getElementById("expand-all").focus()');
      await key();
      check(`reader-${width}-${theme}-keyboard-expand`, true, await evaluate('[...document.querySelectorAll("details")].every(item => item.open)'));
      check(`reader-${width}-${theme}-expanded-root-and-scroller-bounds`, { rootFits: true, wrappersFit: true }, await evaluate(`({
        rootFits: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2,
        wrappersFit: [...document.querySelectorAll(".table-wrap")].every(item => {
          const box = item.getBoundingClientRect(); return box.left >= -2 && box.right <= innerWidth + 2;
        })
      })`));
      await evaluate('document.getElementById("collapse-all").focus()');
      await key();
      check(`reader-${width}-${theme}-keyboard-collapse`, true, await evaluate('[...document.querySelectorAll("details")].every(item => !item.open)'));
      await evaluate('document.querySelector("#case-E1 summary").focus()');
      await key();
      check(`reader-${width}-${theme}-native-disclosure-enter`, true, await evaluate('document.querySelector("#case-E1 details").open'));
      await key(" ");
      check(`reader-${width}-${theme}-native-disclosure-space`, false, await evaluate('document.querySelector("#case-E1 details").open'));
      await evaluate('document.getElementById("theme-toggle").focus()');
      await key();
      check(`reader-${width}-${theme}-keyboard-theme-toggle`, theme === "light" ? "dark" : "light", await evaluate("document.documentElement.dataset.theme"));
      await key();
      await evaluate('document.querySelector(\'nav a[href="#case-E2"]\').focus()');
      await key();
      check(`reader-${width}-${theme}-anchor-focus`, { hash: "#case-E2", focus: "case-E2" }, await evaluate("({hash: location.hash, focus: document.activeElement.id})"));
      for (const id of ["R2", "R1", "R3", "R4"]) {
        const navigationStartedAt = Date.now();
        for (const name of ["gates", "evidence", "rollback"]) {
          await evaluate(`document.querySelector('#runbook-${id} nav a[href="#${id}-${name}"]').focus()`);
          await key();
          check(`reader-${width}-${theme}-${id}-${name}-navigation`,
            { hash: `#${id}-${name}`, focus: `${id}-${name}`, visible: true },
            await evaluate(`({ hash: location.hash, focus: document.activeElement.id,
              visible: document.getElementById("${id}-${name}").getBoundingClientRect().top >= -2 &&
                document.getElementById("${id}-${name}").getBoundingClientRect().top < innerHeight })`));
        }
        const navigationMilliseconds = Date.now() - navigationStartedAt;
        (report.runbookNavigation ??= []).push({
          id, width, theme, navigationMilliseconds,
          scope: "Automated keyboard navigation to go/no-go, evidence capture and rollback; not a human reading-time study."
        });
        check(`reader-${width}-${theme}-${id}-bounded-navigation`, true, navigationMilliseconds < 60000);
        check(`reader-${width}-${theme}-${id}-readable-procedure`, {
          noRawJson: true, gates: true, rollback: true, capture: true, steps: true, observations: true, localScope: true, acceptance: true, provenance: true
        }, await evaluate(`(() => {
          const record = JSON.parse(document.getElementById("reference-data").textContent).runbooks.find(item => item.id === "${id}");
          const root = document.getElementById("runbook-${id}");
          const contains = (element, values) => values.every(value => element.textContent.includes(value));
          const gate = document.getElementById("${id}-gates");
          const rollback = document.getElementById("${id}-rollback");
          const capture = document.getElementById("${id}-evidence");
          const validation = document.getElementById("${id}-validation");
          return {
            noRawJson: root.querySelectorAll("pre").length === 0,
            gates: contains(gate, [record.validation.blocker, record.scope.requiredApprovalRef,
              ...record.prerequisites.flatMap(item => [item.id, item.requirement, item.status, item.evidence])]),
            rollback: contains(rollback, [...record.rollback.trigger, ...record.rollback.steps, ...record.rollback.acceptance]),
            capture: contains(capture, record.evidenceRequirements),
            steps: record.steps.every(step => contains(document.getElementById(step.id),
              [step.actorRole, step.action, step.expected, step.onFailure, ...step.evidence])),
            observations: contains(validation, ["Operational execution: Not executed", ...record.validation.expected,
              ...record.validation.observed, ...record.validation.doesNotEstablish, ...record.validation.evidenceRefs]),
            localScope: record.validation.localExecution ? contains(validation, Object.values(record.validation.localExecution).filter(value => typeof value === "string")) :
              validation.textContent.includes("No operational observations or evidence recorded."),
            acceptance: contains(document.getElementById("${id}-acceptance"), [...record.passCriteria, ...record.failCriteria]),
            provenance: contains(root, [...record.relatedControls, ...Object.values(record.owners), ...record.review.triggers,
              ...record.sourceReferences.flatMap(item => [...item.claimIds, ...item.sourceIds, ...item.capabilityIds, item.qualification])])
          };
        })()`));
        if (width === 1440 && theme === "light") {
          const excerpts = await evaluate(`(() => {
            const gate = document.getElementById("${id}-gates");
            const validation = document.getElementById("${id}-validation");
            return { id: "${id}",
              gates: [...gate.children].slice(0, 3).map(item => item.textContent).join("\\n"),
              validation: [...validation.children].filter(item => item.tagName !== "DETAILS").map(item => item.textContent).join("\\n") };
          })()`);
          fs.writeFileSync(path.join(options.output, `${id.toLowerCase()}-reader-excerpts.json`), JSON.stringify(excerpts, null, 2) + "\n", "utf8");
          if (id === "R2") {
            await evaluate('document.getElementById("runbook-R2").scrollIntoView()');
            const screenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
            fs.writeFileSync(path.join(options.output, "r2-reader-pilot.png"), Buffer.from(screenshot.data, "base64"));
            report.screenshots.push({ name: "r2-reader-pilot.png", retention: "Coordinator-owned session evidence directory; not an external upload." });
          }
        }
      }
      await evaluate("window.scrollTo(0, 0)");
      const screenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
      const screenshotName = `reference-reader-${width}-${theme}.png`;
      fs.writeFileSync(path.join(options.output, screenshotName), Buffer.from(screenshot.data, "base64"));
      report.screenshots.push({ name: screenshotName, retention: "Coordinator-owned session evidence directory; not an external upload." });
    }
    for (const id of ["e1", "e2", "e3"]) for (const kind of ["authority", "recovery"]) {
      const relative = `diagrams/${id}-${kind}.svg`;
      const diagram = readJson("diagrams", `${id}-${kind}.excalidraw`);
      await send("Emulation.setDeviceMetricsOverride", { width: 1880, height: 960, deviceScaleFactor: 1, mobile: false });
      await navigate(fileInput(relative));
      const geometry = await evaluate(`(() => {
        const svg = document.documentElement;
        const view = svg.viewBox.baseVal;
        const texts = [...document.querySelectorAll("text")];
        const outside = texts.filter(item => {
          const box = item.getBBox(); return box.x < -1 || box.y < -1 || box.x + box.width > view.width + 1 || box.y + box.height > view.height + 1;
        }).map(item => item.id);
        const nonblack = texts.filter(item => getComputedStyle(item).fill !== "rgb(0, 0, 0)").map(item => item.id);
        return { outside, nonblack, edges: document.querySelectorAll("path[marker-end]").length,
          textBounds: texts.map(item => { const box = item.getBBox(); return {id:item.id,x:box.x,y:box.y,width:box.width,height:box.height}; }) };
      })()`);
      check(`${id}-${kind}-native-svg-text-inside-canvas`, [], geometry.outside);
      check(`${id}-${kind}-native-svg-black-text`, [], geometry.nonblack);
      check(`${id}-${kind}-native-svg-all-directed-edges`, diagram.elements.filter(item => item.type === "arrow").length, geometry.edges);
      const tooLarge = geometry.textBounds.filter(bounds => {
        const declared = diagram.elements.find(item => item.id === bounds.id);
        return !declared || bounds.x < declared.x - 1 || bounds.y < declared.y - 1 ||
          bounds.x + bounds.width > declared.x + declared.width + 1 ||
          bounds.y + bounds.height > declared.y + declared.height + 1;
      }).map(item => item.id);
      check(`${id}-${kind}-native-font-fits-editable-text-bounds`, [], tooLarge);
      if (id === "e3" && kind === "recovery") {
        const screenshot = await send("Page.captureScreenshot", {
          format: "png", captureBeyondViewport: true,
          clip: { x: 0, y: 0, width: diagram.customData.canvasWidth, height: diagram.customData.canvasHeight, scale: 1 }
        });
        fs.writeFileSync(path.join(options.output, "e3-recovery-full.png"), Buffer.from(screenshot.data, "base64"));
        report.screenshots.push({ name: "e3-recovery-full.png", retention: "Coordinator-owned session evidence directory; not an external upload." });
      }
    }
    const http = events.filter(event => event.method === "Network.requestWillBeSent" && /^https?:/.test(event.params.request.url)).map(event => event.params.request.url);
    const runtimeErrors = events.filter(event => event.method === "Runtime.exceptionThrown").map(event => event.params.exceptionDetails.text);
    check("no-http-subrequests", [], http);
    check("no-browser-runtime-exceptions", [], runtimeErrors);
  });
} catch (error) {
  report.executionError = error.message;
}
report.endedAt = new Date().toISOString();
report.wallDurationMilliseconds = new Date(report.endedAt) - startedAt;
report.failed = report.results.filter(item => !item.passed).length + (report.executionError ? 1 : 0);
report.passed = report.results.filter(item => item.passed).length;
report.status = report.failed ? "failed" : "passed-local-synthetic-only";
fs.writeFileSync(reportFile, JSON.stringify(report, null, 2) + "\n", "utf8");
console.log(JSON.stringify({ id: report.id, passed: report.passed, failed: report.failed, executionError: report.executionError, failures: report.results.filter(item => !item.passed), scopeKind: report.scopeKind }, null, 2));
if (report.failed) process.exitCode = 1;
