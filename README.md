# Adaptive Trust Fabric

A Microsoft-aligned architecture and decision framework for global enterprise identity, security and compliance.

**Version:** 1.0 | **Research cutoff:** 17 November 2026

## Executive summary

Global enterprises need common security standards without assuming that every business unit, acquisition, cloud, sovereign environment or factory can depend on one central control plane. Adaptive Trust Fabric provides a framework for deciding where to centralize governance, where to federate authority, and what must continue operating independently during disruption.

> Centralize intent. Federate enforcement. Localize survival. Prove recovery.

The position favors **one Microsoft Entra tenant when all hard requirements can be met**, not one tenant at any cost. Additional tenants, sovereign domains or disconnected environments must deliver a justified boundary outcome that outweighs their operational complexity.

The architecture combines:

- **A common connected core:** Microsoft Entra, Defender, Sentinel, Purview, Intune and Azure governance provide shared identity, policy, protection and evidence capabilities.
- **Boundary-driven enforcement:** tenant, native-cloud, workload, data and operational technology (OT) controls retain authority where sovereignty, safety or mission requirements demand it.
- **Explicit survivability:** five tiers define what identity, policy, security operations and recovery must do when upstream services are unavailable.
- **Independent recovery and reversible change:** recovery must not depend on the compromised systems it restores; acquisitions and cross-boundary relationships need tested exit paths.

Hard constraints come before scoring, cost or convenience. The target is the strongest architecture the organization can safely operate and recover, not the most elaborate topology.

**This repository is a reference and decision-support package, not a deployed security platform.** It contains a format-selection landing page, an interactive microsite, a browser-based slide presentation, an executive infographic, a position paper and structured research. It does not provision infrastructure, configure tenants or inspect a live environment.

## Start here

**Published site:** [Adaptive Trust Fabric on GitHub Pages](https://chadhage.github.io/adaptive-trust-fabric/).

Start at the [landing page](./index.html) and choose the interactive microsite, slide presentation or infographic. Use **Download white paper (PDF)** to save the complete position paper. For offline use, download or clone the complete repository and preserve its directory structure. Open the HTML files locally in a modern browser; viewing their source on GitHub will not run the experience.

| Your goal | Start with |
| --- | --- |
| Choose a viewing format | [Landing page](./index.html) |
| Deliver a guided architecture briefing | [12-slide browser presentation](./adaptive-trust-fabric-microsite/presentation.html) |
| Brief executives or introduce the operating model | [Architecture-at-a-glance infographic](./adaptive-trust-fabric-infographic.html) |
| Explore the architecture and assess organizational conditions | [Interactive microsite](./adaptive-trust-fabric-microsite/index.html) |
| Review the full argument, controls and supporting evidence | [Position paper PDF](./position-paper/Adaptive-Trust-Fabric-Position-Paper.pdf) or [HTML edition](./position-paper/position-paper.html) |
| Reuse the evidence in analysis or tooling | [Machine-readable research](./adaptive-trust-fabric-microsite/data/research.json) |

For example, from the repository root in Windows PowerShell:

```powershell
Start-Process .\index.html
```

No build step, package installation, Azure subscription or web server is required. Enable JavaScript for the microsite's interactive features and slide navigation. The local pages and assessment work offline; opening external source links requires internet access. Keep the microsite's assets alongside its entry page, and retain the sibling position-paper directory so its PDF links work. The original microsite entry point remains unchanged.

## Repository walkthrough

| File | Purpose and use |
| --- | --- |
| [index.html](./index.html) | GitHub Pages starting page with three viewing choices (interactive microsite, slide presentation and infographic) plus a white paper PDF download. |
| [adaptive-trust-fabric-infographic.html](./adaptive-trust-fabric-infographic.html) | Standalone visual overview of the operating model, evidence, deliverables and decision system. Use **Print / Save PDF** for a briefing handout. |
| [adaptive-trust-fabric-microsite/index.html](./adaptive-trust-fabric-microsite/index.html) | Main interactive experience: reference architecture, topology assessment, survivability tiers, topology library, control standard, adversarial findings, roadmap and evidence explorer. Includes an embedded research-data snapshot for offline use. |
| [adaptive-trust-fabric-microsite/presentation.html](./adaptive-trust-fabric-microsite/presentation.html) | Self-contained browser slide deck covering the position, reference architecture, decision hierarchy, topologies, survivability, identity, sovereignty, recovery, evidence and roadmap. |
| [adaptive-trust-fabric-microsite/assets/app.js](./adaptive-trust-fabric-microsite/assets/app.js) | Browser-side assessment rules, data rendering, control filters and source search. Read or modify this to understand how assessment inputs become recommendations. |
| [adaptive-trust-fabric-microsite/assets/styles.css](./adaptive-trust-fabric-microsite/assets/styles.css) | Microsite layout, responsive styling and visual presentation. |
| [adaptive-trust-fabric-microsite/data/research.json](./adaptive-trust-fabric-microsite/data/research.json) | Structured evidence, claims, controls, topology patterns, survivability tiers, decision criteria, adversarial findings and roadmap. Use for programmatic analysis and source traceability. |
| [position-paper/Adaptive-Trust-Fabric-Position-Paper.pdf](./position-paper/Adaptive-Trust-Fabric-Position-Paper.pdf) | Ready-to-share position paper for detailed reading and architecture reviews. |
| [position-paper/position-paper.html](./position-paper/position-paper.html) | Readable and editable HTML source of the paper, including its executive position, reference architecture, normative standard and source catalog. |
| [position-paper/paper.css](./position-paper/paper.css) | Print-oriented paper styling, including A4 page settings, tables and pagination rules. |
| [manifest.json](./manifest.json) | Package version, research cutoff, byte sizes and SHA-256 checksums for the files listed in the manifest. This is integrity metadata, not an application dependency manifest. |
| [.github/workflows/pages.yml](./.github/workflows/pages.yml) | Stages and deploys the static site to GitHub Pages on pushes to the default branch, `main`, or a manual workflow run. |

## Walk through the microsite

1. **Read Position and Architecture.** Establish the governing thesis and distinguish policy ownership, identity authority, enforcement, telemetry and recovery.
2. **Run Assess.** Select the strongest boundary requirement, sovereignty requirement, required survivability, merger/acquisition or divestiture tempo, business-unit autonomy and operating maturity. Flag safety-critical OT where applicable, then choose **Evaluate architecture**.
3. **Review the result, not just its topology label.** Read the rationale, companion patterns, disqualifying constraints and maturity warning. The displayed survivability tier is the requirement you selected, not a measured capability.
4. **Explore Mission continuity and the Topology library.** Compare each tier's identity, policy, security-operations and recovery expectations. Check both the use and rejection conditions for candidate topologies.
5. **Filter the Normative standard.** Select a domain and a MUST / SHOULD / MAY level to identify applicable controls. Follow their source identifiers into the evidence catalog.
6. **Challenge and plan.** Read the adversarial findings, use the phased roadmap to sequence capability development, and search Evidence by source title, evidence use or provenance class.

**Try it:** the default assessment selections produce T1 with S0 survivability. Change **Required survivability** to S4 and evaluate again to see the disconnected-enclave pattern, T4, and its maturity considerations.

The assessment is a **rule-based architectural heuristic**, not an automated audit or a full architecture optimizer. Its recommendations require organization-specific authority/dependency analysis, scenario testing, product validation and accountable review. The adversarial findings are documented challenges to architectural claims, not an executable security test suite.

### Understand topology and survivability labels

Topology describes how authority and boundaries are organized:

| Pattern | Intended role |
| --- | --- |
| T1 - One global tenant with delegated boundaries | Default when required boundaries can be met safely within one tenant. |
| T2 - Federated multi-tenant enterprise | Separate tenant control planes with governed collaboration across them. |
| T3 - Sovereign or independently recoverable tenant | Independent local authority over identity, administration, keys or recovery. |
| T4 - Disconnected enclave / cyber-physical cell | Operations requiring intentional isolation or independence from upstream services. |
| T5 - Acquisition transition zone | Isolation-first discovery and staged, reversible trust for acquisitions or joint ventures; shown as a companion pattern in the assessment. |

Survivability describes the required operating behavior during disruption:

| Tier | Mission expectation |
| --- | --- |
| S0 - Cloud-dependent | Normal online SaaS and cloud operation. |
| S1 - Transient outage | Hours of safe continuity through cached/session behavior and emergency access. |
| S2 - Extended degraded | Days of reduced function with selected local services. |
| S3 - Independent operations | Mission operation without upstream control planes. |
| S4 - Disconnected / air-gapped | Intentional isolation with local identity, policy, detection and recovery. |

These are architectural requirements to design and prove, not product availability guarantees.

## Use the slide presentation

Open the [presentation](./adaptive-trust-fabric-microsite/presentation.html) from the landing page. It runs in the browser without PowerPoint or an external slide library.

- Use **Previous / Next**, the arrow keys, Page Up / Page Down, or Space / Shift+Space to move through the deck.
- Use **Go to slide** to choose a topic, or Home / End to jump to the beginning or end. Keyboard shortcuts do not override the slide selector's native controls.
- Choose **Fullscreen** or press F when supported by the browser; Escape exits fullscreen.
- Choose **Print / PDF** to print the complete deck, not just the current slide. Use landscape A4 and enable background graphics for the designed output.
- Share a topic directly with a fragment such as [the survivability slide](./adaptive-trust-fabric-microsite/presentation.html#slide-6).
- Use **All formats** to return to the landing page. Source and action links lead into the original microsite or paper.

Without JavaScript, the deck displays all slides in reading order. Its content is a briefing derived from the same research, not a separate product recommendation.

## Reuse the research and evidence

The [research dataset](./adaptive-trust-fabric-microsite/data/research.json) contains **33 sources, 18 claims, 26 normative controls and 10 adversarial findings**, alongside five topology patterns, five survivability tiers, hard constraints, decision dimensions, the decision hierarchy and a four-phase roadmap.

Useful top-level collections include `sources`, `claims`, `normativeControls`, `survivabilityTiers`, `topologies`, `hardConstraints`, `adversarialFindings` and `roadmap`. Source identifiers connect claims and controls to evidence records containing URLs, provenance, access dates and the purpose for which the source was used.

For example, list the framework's mandatory controls in PowerShell:

```powershell
$research = Get-Content -LiteralPath .\adaptive-trust-fabric-microsite\data\research.json -Raw |
    ConvertFrom-Json

$research.normativeControls |
    Where-Object level -eq 'MUST' |
    Select-Object id, domain, text
```

Evidence is classified as **Microsoft Explicit**, **External Standard**, **Research Supported**, **Derived Architectural Position** or **Open/Contested**. Preserve these distinctions when reusing recommendations: a synthesized architectural position is not automatically a Microsoft mandate or a regulatory requirement.

## Apply it in an architecture review

Use the package to structure a decision, not to skip the design work:

1. Record hard legal, sovereignty, safety, identity-isolation and continuity constraints.
2. Map trust, privileged authority and dependencies, including the separate path needed to recover a compromised environment.
3. Stress-test candidate designs against outages, compromise, loss of communications and organizational change.
4. Compare feasible topologies on risk, cost, complexity and reversibility; document the rationale and applicable controls.
5. Check operating maturity, assign owners and use the roadmap to stage adoption. Expand complexity only after operations and recovery drills demonstrate readiness.

## GitHub Pages publishing

The [Pages workflow](./.github/workflows/pages.yml) deploys the site automatically after a push to `main`. It can also be started from **Actions > Deploy GitHub Pages > Run workflow**.

In the repository's **Settings > Pages**, the publishing source must be **GitHub Actions**. The workflow uses the `github-pages` deployment environment and the standard Pages artifact/deployment actions; there is no Jekyll or application build step.

Only the [landing page](./index.html), [infographic](./adaptive-trust-fabric-infographic.html), [microsite directory](./adaptive-trust-fabric-microsite/) and [position-paper directory](./position-paper/) are staged for publication. Relative links retain the repository's project-site prefix, and the paper remains available alongside the microsite. Repository metadata and workflow files are not included in the site artifact.

## Update and share the package

- **Microsite behavior and presentation:** edit the [HTML entry page](./adaptive-trust-fabric-microsite/index.html), [JavaScript](./adaptive-trust-fabric-microsite/assets/app.js) or [stylesheet](./adaptive-trust-fabric-microsite/assets/styles.css), then reopen or refresh the local page.
- **Landing page and slides:** edit the [format selector](./index.html) or [presentation](./adaptive-trust-fabric-microsite/presentation.html). Both include their own styling and work without external libraries.
- **Research changes:** keep the [JSON dataset](./adaptive-trust-fabric-microsite/data/research.json) and the `script#research-data` JSON block in the [microsite HTML](./adaptive-trust-fabric-microsite/index.html) synchronized. The browser reads the embedded copy; editing the standalone JSON alone does not update the microsite. Keep the landing-page counts, slides, paper and infographic consistent with the revised research.
- **Paper changes:** update the [paper HTML](./position-paper/position-paper.html) and [print stylesheet](./position-paper/paper.css), then regenerate the [PDF](./position-paper/Adaptive-Trust-Fabric-Position-Paper.pdf). A browser's Print / Save as PDF feature provides an export path; use A4 and background graphics, and inspect pagination and layout. Output can vary by print renderer; no automated PDF build script is included.
- **Integrity metadata:** refresh the byte count and SHA-256 checksum in the [manifest](./manifest.json) for each listed file you change.
- **Static hosting:** publish the repository's content with its relative paths intact. Hosting only the microsite subdirectory will omit the sibling PDF that its links reference.

## Status and limitations

This is a **Microsoft-aligned architectural position, not an official Microsoft product commitment**, a compliance certification or a substitute for legal, regulatory or safety advice.

The material reflects the stated research cutoff, not a live verification of product capabilities. Before implementation, revalidate licensing, preview status, service limits, supported clouds and regions, feature availability, threat models and organization-specific obligations. MUST / SHOULD / MAY express the framework's architecture-standard language; consult each control's provenance and applicability before adopting it.
