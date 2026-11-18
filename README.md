# Adaptive Trust Fabric

A reference architecture and rule-based topology assessment for enterprise identity, security and compliance, based on cited Microsoft, NIST and CISA documentation.

**Version:** 1.0 | **Research cutoff:** 17 November 2026

## Executive summary

Adaptive Trust Fabric documents requirements for tenant isolation, administrative authority, access control, operation during outages and recovery. It covers Microsoft cloud services, other cloud providers, acquisitions, operational technology (OT) and disconnected environments.

Prefer **one Microsoft Entra tenant when it satisfies the applicable requirements**. For each additional tenant or isolated environment, document the requirement that a shared tenant cannot meet, the administrative authority, dependencies, operating costs and separation procedure.

The architecture separates four concerns:

- **Policy ownership:** define requirements, accountable owners, approved configurations and exceptions.
- **Enforcement locations:** identify the tenant, cloud-provider, application, data and OT controls that implement each requirement.
- **Local operating requirements:** assign an S0-S4 tier and specify which functions must continue when upstream services are unavailable.
- **Recovery procedures:** define recovery credentials, configuration baselines, dependencies and tests that do not require access to the suspected compromised environment.

Check mandatory constraints before comparing risk, cost and complexity. Reject designs that violate a mandatory requirement, and assess whether staffing, skills, monitoring and recovery procedures can support the remaining options.

**This repository contains documentation and a browser-based assessor, not a deployed security service.** It includes a landing page, an interactive microsite, a slide presentation, an infographic, a position paper and structured research records. It does not provision infrastructure, configure tenants or inspect a live environment.

## Start here

**Published site:** [Adaptive Trust Fabric on GitHub Pages](https://chadhage.github.io/adaptive-trust-fabric/).

Start at the [landing page](./index.html) and choose the interactive microsite, slide presentation or infographic. Use **Download position paper (PDF)** to save the paper. For offline use, download or clone the repository and preserve its directory structure. Open the HTML files locally in a modern browser; GitHub's file viewer displays HTML source rather than running the page.

| Your goal | Start with |
| --- | --- |
| Choose a viewing format | [Landing page](./index.html) |
| Present the architecture and evaluation criteria | [12-slide browser presentation](./adaptive-trust-fabric-microsite/presentation.html) |
| Review the architecture summary | [Architecture infographic](./adaptive-trust-fabric-infographic.html) |
| Compare requirements with the assessment rules | [Interactive microsite](./adaptive-trust-fabric-microsite/index.html) |
| Review the analysis, control requirements and references | [Position paper PDF](./position-paper/Adaptive-Trust-Fabric-Position-Paper.pdf) or [HTML edition](./position-paper/position-paper.html) |
| Follow worked reviews and bounded operating procedures | [Offline examples, runbooks and execution ledger](./reference-validation/index.html) |
| Use the source and requirement records in other tools | [Research JSON](./adaptive-trust-fabric-microsite/data/research.json) |

For example, from the repository root in Windows PowerShell:

```powershell
Start-Process .\index.html
```

No build step, package installation, Azure subscription or web server is required. Enable JavaScript for the microsite's interactive features and slide navigation. The local pages and assessment work offline; opening external source links requires internet access. Keep the microsite's assets alongside its entry page, and retain the sibling position-paper directory so its PDF links work. The original microsite entry point remains unchanged.

### Navigation and appearance

Use the menu button beside the project name on the landing page to open the navigation drawer. It contains the viewing options, position-paper download, research data and project-policy links. Close it with the close button, Escape, a click outside the drawer, or a navigation link. Keyboard focus stays inside the open drawer and returns to the menu button when it closes.

Use **Home** in the infographic header or footer to return to the landing page.

The **Dark theme** switch changes between light and dark. **Use system setting** clears the saved choice. On the published site, the choice is stored in this browser and applies to the landing page and slide presentation. The microsite, infographic and HTML paper follow the system setting or their explicit theme URL independently. If browser storage is unavailable, the landing page can still change theme and displays a storage notice.

The existing `?clawpilotTheme=light` and `?clawpilotTheme=dark` URLs select and save that theme on the landing page and presentation. On the infographic, the parameter selects a theme for that page without saving it. The drawer controls require JavaScript; the page's viewing cards and document links remain available without it.

## Repository walkthrough

| File | Purpose and use |
| --- | --- |
| [index.html](./index.html) | GitHub Pages entry point with a navigation drawer, theme controls, viewing options and position paper PDF download. |
| [adaptive-trust-fabric-infographic.html](./adaptive-trust-fabric-infographic.html) | Visual guide to access decisions, control responsibilities, topology, survivability and recovery. Use **Print / Save PDF** to export it. |
| [adaptive-trust-fabric-microsite/index.html](./adaptive-trust-fabric-microsite/index.html) | Reference architecture, topology assessment, survivability tiers, topology patterns, control requirements, assumption reviews, implementation sequence and source search. Includes an embedded research-data copy for offline use. |
| [adaptive-trust-fabric-microsite/presentation.html](./adaptive-trust-fabric-microsite/presentation.html) | Browser presentation covering the architecture, evaluation criteria, topology patterns, operating tiers, identity, recovery and implementation phases. Shared theme preferences are loaded from the local site script. |
| [adaptive-trust-fabric-microsite/assets/app.js](./adaptive-trust-fabric-microsite/assets/app.js) | Browser rendering, control evidence/filtering, source search and form-to-engine integration. |
| [adaptive-trust-fabric-microsite/assets/assessment.js](./adaptive-trust-fabric-microsite/assets/assessment.js) | Pure, dependency-free assessment engine; browser `ATFAssessment` and CommonJS exports use the same rules without network access. |
| [adaptive-trust-fabric-microsite/assets/site.js](./adaptive-trust-fabric-microsite/assets/site.js) | Landing-page drawer controls and shared theme preferences for the landing page and presentation. |
| [adaptive-trust-fabric-microsite/assets/styles.css](./adaptive-trust-fabric-microsite/assets/styles.css) | Microsite layout, responsive styling and visual presentation. |
| [adaptive-trust-fabric-microsite/data/research.json](./adaptive-trust-fabric-microsite/data/research.json) | Source references, claims, control requirements, topology patterns, survivability tiers, evaluation criteria, assumption reviews and implementation phases. Records are linked by source identifiers. |
| [position-paper/Adaptive-Trust-Fabric-Position-Paper.pdf](./position-paper/Adaptive-Trust-Fabric-Position-Paper.pdf) | PDF edition of the position paper. |
| [position-paper/position-paper.html](./position-paper/position-paper.html) | Readable and editable HTML source of the paper, including its executive position, reference architecture, normative standard and source catalog. |
| [position-paper/paper.css](./position-paper/paper.css) | Print-oriented paper styling, including A4 page settings, tables and pagination rules. |
| [reference-validation/index.html](./reference-validation/index.html) | Offline reader for synthetic E1-E3 review records, R1-R4 runbooks, authority/recovery diagrams and the authorization/execution ledger. |
| [tools/sync-research.mjs](./tools/sync-research.mjs) | Maintainer-only generation/check of the embedded JSON and complete paper control appendix, roadmap and source catalog; explicit manifest-only mode. |
| [tools/build-paper.mjs](./tools/build-paper.mjs) and [PDF inspector](./tools/build-paper.py) | Installed-browser PDF generation, extracted-text/pagination checks and source/PDF build receipt; not required by visitors. |
| [manifest.json](./manifest.json) | Byte sizes and SHA-256 for listed canonical files: UTF-8 text with CRLF normalized to LF, binary PDFs unchanged. No staging is required. This is integrity metadata, not a dependency manifest or operational certification. |
| [.github/workflows/pages.yml](./.github/workflows/pages.yml) | Stages and deploys the static site to GitHub Pages on pushes to the default branch, `main`, or a manual workflow run. |
| [LICENSE](./LICENSE) | MIT license, Microsoft Corporation copyright notice and warranty/liability disclaimer. |
| [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) | Microsoft Open Source Code of Conduct adoption and conduct-reporting resources. |
| [SECURITY.md](./SECURITY.md) | Microsoft's private security-vulnerability reporting policy and MSRC contact information. |
| [SUPPORT.md](./SUPPORT.md) | Community-support channels and the boundary between this reference material and Microsoft product support. |

## Walk through the microsite

1. **Read Position and Architecture.** Review the evaluation criteria and the separation of policy ownership, identity administration, enforcement, telemetry and recovery.
2. **Run Assess.** Record isolation, sovereignty, survivability, recovery and OT requirements, then declare the supporting boundary, authority, dependency and operating evidence. Leave facts unknown when they have not been established.
3. **Review the assessment.** Read each independent decision dimension, mandatory gate, typed reason, excluded alternative and next validation check. The displayed survivability tier is your requirement, not a measured capability.
4. **Review Operation during outages and Topology patterns.** Compare identity, policy, security-operations and recovery requirements. Check both the use and rejection conditions for each topology.
5. **Filter Control requirements.** Select a domain and a MUST / SHOULD / MAY level. Use the source identifiers to find the cited documents in the source catalog.
6. **Review assumptions and implementation phases.** Read the documented assumption reviews, consider the proposed implementation sequence, and search Sources by title, source use or provenance class.

**Default behavior:** unanswered mandatory facts produce **insufficient evidence**, not a ready T1 recommendation. A regulatory label, local-key preference, acquisition frequency or maturity label alone does not establish a need for another tenant.

The assessment applies **fixed rules to the selected inputs**. It does not inspect tenant configuration, calculate risk or cost, run failure scenarios or verify that requirements are met. Review its output using organization-specific dependency analysis, testing and product documentation. The assumption reviews compare statements with source limitations; they are not results from an executable security test suite.

| Result | Meaning |
| --- | --- |
| **Candidate** | All applicable mandatory facts are declared and no known mandatory conflict is present. A design-review candidate only; self-reported evidence is not inspected readiness. |
| **Insufficient evidence** | At least one required fact is unknown or invalid and no known common mandatory conflict takes precedence. The next checks identify what must be established. |
| **Excluded** | A known mandatory conflict excludes the assessed configuration. Other decision dimensions can remain candidates or unknown. |

Tenant topology, identity authority, sovereignty, connectivity and recovery are separate outputs. S3 does not imply T3. T4 is a disconnected operating-pattern overlay for S4, not a number of online Entra tenants. Known circular recovery or unacceptable privileged paths cannot be compensated for by scoring other benefits.

### Understand topology and survivability labels

Topology describes how authority and boundaries are organized:

| Pattern | Intended role |
| --- | --- |
| T1 - One global tenant with delegated boundaries | Default when required boundaries can be met safely within one tenant. |
| T2 - Federated multi-tenant enterprise | Separate tenant control planes with governed collaboration across them. |
| T3 - Sovereign or independently recoverable tenant | Documented independently governed tenant identities with shared privileged dependencies removed; may describe an existing tenant and does not inherently require offline/on-premises identity. Local key custody alone is insufficient. |
| T4 - Disconnected enclave / cyber-physical cell | Disconnected S4 operating overlay; identity and tenant-topology decisions remain separate. |
| T5 - Acquisition transition zone | Restricted cross-tenant access during discovery and remediation, with a tested separation procedure; shown as a companion pattern in the assessment. |

Survivability describes the required operating behavior during disruption:

| Tier | Required operation |
| --- | --- |
| S0 - Cloud-dependent | Normal online SaaS and cloud operation. |
| S1 - Transient outage | Only bounded, explicitly tested existing-session/cached behavior. Cloud-only emergency accounts still depend on Entra and reachable cloud services. |
| S2 - Extended degraded | Days of reduced function with selected local services. |
| S3 - Independent operations | Required functions continue without upstream control planes. |
| S4 - Disconnected / air-gapped | Intentional isolation with local identity, policy, detection and recovery. |

Use these tiers to specify required functions and outage durations, then test them in the target environment. They are not product availability guarantees.

Existing sessions and cloud-only emergency accounts do not bypass a full Entra outage. PHS synchronization is not automatic switchover from federation or pass-through authentication; a documented cutover must be tested. A distinct identity is required for each separately managed **logical agent**, not automatically every process, replica or session; assign both an accountable sponsor and technical owner.

## Use the slide presentation

Open the [presentation](./adaptive-trust-fabric-microsite/presentation.html) from the landing page. It runs in the browser without PowerPoint or an external slide library.

- Use **Previous / Next**, the arrow keys, Page Up / Page Down, or Space / Shift+Space to move through the deck.
- Use **Go to slide** to choose a topic, or Home / End to jump to the beginning or end. Keyboard shortcuts do not override the slide selector's native controls.
- Choose **Fullscreen** or press F when supported by the browser; Escape exits fullscreen.
- Choose **Print / PDF** to print all slides, not just the current slide. Use landscape A4 and enable background graphics.
- Share a topic directly with a fragment such as [the survivability slide](./adaptive-trust-fabric-microsite/presentation.html#slide-6).
- Use **All formats** to return to the landing page. Source and action links lead into the original microsite or paper.

Without JavaScript, the presentation displays all slides in reading order. It summarizes the same analysis and does not add product commitments.

## Use the research data

The [research dataset](./adaptive-trust-fabric-microsite/data/research.json) contains **33 source references, 18 claims, 26 control requirements and 10 assumption reviews**, alongside five topology patterns, five survivability tiers, mandatory constraints, evaluation criteria and four implementation phases.

The top-level collections include `sources`, `claims`, `normativeControls`, `survivabilityTiers`, `topologies`, `hardConstraints`, `adversarialFindings` and `roadmap`, with an `evidenceContract`, ten capability records in `capabilityMatrix` and a `sourceMaintenance` policy. Source identifiers link claims and controls to URLs, provenance, recorded access dates and source-use descriptions. The existing `adversarialFindings` key contains the assumption-review records. Claim confidence labels are qualitative author assessments, not calibrated probabilities.

The additive `evidence` envelope records status, verification date, source references (URL, section, revision, verification method and supported statement), applicability, limitations, confidence rationale and operational-validation status. A checked source does not prove a deployed control. Each control also records requirement origin, accountable role, exclusions, dependencies, failure behavior, a verification method with expected evidence and pass/fail criteria, and exception approval/review conditions. The paper includes **all 26 core requirements**; each links to detailed guidance in the microsite.

`sources[]` preserves a record's broader/context bibliography. Its nonempty `evidence.source_refs[]` selects the exact reviewed passages supporting the narrow proposition and may be a subset, not a copied one-to-one list. Selected IDs must resolve inside that bibliography, with valid URLs, sections, revisions and review dates; a bibliography alone is not selected supporting evidence.

For example, list the framework's mandatory controls in PowerShell:

```powershell
$research = Get-Content -LiteralPath .\adaptive-trust-fabric-microsite\data\research.json -Raw |
    ConvertFrom-Json

$research.normativeControls |
    Where-Object level -eq 'MUST' |
    Select-Object id, domain, text
```

Source provenance is classified as **Microsoft Explicit**, **External Standard**, **Research Supported**, **Derived Architectural Position** or **Open/Contested**. MUST / SHOULD / MAY express this framework's requirements and recommendations. Source provenance does not make those normative levels Microsoft or regulatory requirements.

### Worked examples, runbooks and evidence status

The [local reader](./reference-validation/index.html) contains [E1](./reference-validation/index.html#case-E1), [E2](./reference-validation/index.html#case-E2) and [E3](./reference-validation/index.html#case-E3) synthetic design-review records. Each preserves requirements, boundaries, authority and recovery graphs, control applicability, an engine-backed decision and validation status. The records distinguish declared, verified, unknown and failed requirement evidence; do not treat fixture declarations as observations of a real environment.

Runbooks cover [R1 emergency access](./reference-validation/index.html#runbook-R1), [R2 PHS cutover](./reference-validation/index.html#runbook-R2), [R3 tenant-configuration restore](./reference-validation/index.html#runbook-R3) and [R4 S3 outage operation](./reference-validation/index.html#runbook-R4). They define prerequisites, bounded steps, expected evidence, rollback/abort conditions and review responsibilities. Authority and recovery diagrams make indirect privileges and circular dependencies inspectable.

**Authorized execution scope is local-only synthetic fixtures and browser tests.** No dedicated Entra/AD/PHS/OT lab was authorized. Live Graph/Azure/tenant writes, role changes, switchover, restores, service interruption and billable resources are out of scope. Original live acceptance for A04 and R1/R2/R3 exercises remains **blocked**, not replaced by a simulation. Local S3 fixture/process evidence proves only the exact local functions exercised, not OT safety or a platform's independent operation. Read the [authorization](./reference-validation/index.html#authorization) and [execution ledger](./reference-validation/index.html#evidence) before citing a result. Delivered tooling and review drafts are distinct from formally completed operational acceptance.

## Apply it in an architecture review

The proposed review sequence is:

1. Record mandatory legal, sovereignty, safety, identity-isolation and continuity constraints.
2. Map trust, privileged authority and dependencies, including the separate path needed to recover a compromised environment.
3. Test candidate designs against outages, compromise, loss of communications and organizational change.
4. Compare feasible topologies on risk, cost, complexity and reversibility; document the rationale and applicable controls.
5. Assess staffing and operating capabilities, assign owners and sequence the work. Test operations and recovery procedures before adding dependencies or control planes.

## GitHub Pages publishing

The [Pages workflow](./.github/workflows/pages.yml) deploys the site automatically after a push to `main`. It can also be started from **Actions > Deploy GitHub Pages > Run workflow**.

In the repository's **Settings > Pages**, the publishing source must be **GitHub Actions**. The workflow uses the `github-pages` deployment environment and the standard Pages artifact/deployment actions; there is no Jekyll or application build step.

The static publication retains the [landing page](./index.html), [infographic](./adaptive-trust-fabric-infographic.html), [MIT license](./LICENSE), [microsite directory](./adaptive-trust-fabric-microsite/), [position-paper directory](./position-paper/) and [reference-validation reader and records](./reference-validation/). Relative links retain the repository's project-site prefix. Maintainer tools, tests, browser profiles and workflow internals are not visitor dependencies. The landing-page footer links to the repository editions of the conduct, security and support policies.

## Update and share the package

- **Writing style:** use defined engineering terms, state assumptions and failure conditions, and distinguish cited product behavior, proposed requirements and test results. Avoid slogans, unsupported superlatives and claims of verification without a stated method.
- **Visitor-facing focus:** keep the paper (HTML and PDF), presentation, infographic and interactive microsite focused on business decisions, architecture and technical requirements. Keep repository instructions, packaging details and content-production methodology in the README rather than those four artifacts.
- **Microsite behavior and presentation:** edit the [HTML entry page](./adaptive-trust-fabric-microsite/index.html), pure [assessment engine](./adaptive-trust-fabric-microsite/assets/assessment.js), rendering [JavaScript](./adaptive-trust-fabric-microsite/assets/app.js) or [stylesheet](./adaptive-trust-fabric-microsite/assets/styles.css), then reopen or refresh the local page.
- **Landing page and slides:** edit the [format selector](./index.html) or [presentation](./adaptive-trust-fabric-microsite/presentation.html). Both include their own styling and work without external libraries.
- **Navigation and themes:** the landing-page drawer markup is in the [format selector](./index.html). Shared preference handling and drawer interactions are in [site.js](./adaptive-trust-fabric-microsite/assets/site.js); both the landing page and presentation load it before their styles.
- **Research changes:** edit the canonical [JSON dataset](./adaptive-trust-fabric-microsite/data/research.json), then use the generator below. Do not hand-edit `script#research-data` or the paper's `BEGIN GENERATED:controls`, `roadmap` and `sources` blocks. The browser reads the embedded copy; standalone JSON edits alone do not update it. Keep narrative summaries and counts consistent with accepted records.
- **Example and runbook changes:** edit the source JSON under `reference-validation\cases` or `runbooks`, preserving the [record schema](./reference-validation/schema/review-record.schema.json) and canonical IDs. These records have a separate offline embedded reader: rebuild with `node .\reference-validation\scripts\build.mjs`, then follow the [contract's declared local validation sequence](./reference-validation/contract.json), including a fresh bounded browser check and the read-only validator. Regeneration changes fingerprints and invalidates previous browser/PDF evidence. Record only checks actually executed; never use local recording to complete blocked live exercises. Do not regenerate immutable reference artifacts during a publication freeze.
- **Paper changes:** update the [paper HTML](./position-paper/position-paper.html) outside generated blocks and [print stylesheet](./position-paper/paper.css), synchronize research and regenerate the [PDF](./position-paper/Adaptive-Trust-Fabric-Position-Paper.pdf). The helper prints actual final HTML and validates extracted core wording and A4 pages; it never reuses an old PDF as evidence of a new export.
- **Integrity metadata:** refresh listed byte counts and SHA-256 only after content, evidence records, QA repairs and PDF/receipt are stable. Text uses UTF-8 with **CRLF replaced by LF only** (no trimming, Unicode or trailing-newline normalization); PDFs use exact binary bytes. This matches the repository's canonical LF Git blobs without staging user changes. The manifest excludes itself and is not a signature or proof of operational validation.
- **Static hosting:** publish the repository's content with its relative paths intact. Hosting only the microsite subdirectory will omit the sibling PDF that its links reference.

### Repeatable publication and local checks

Visitors need none of these commands. Maintainers use Node.js 22+ for dependency-free generators/tests and an installed Edge/Chrome plus Python with **PyMuPDF** for PDF inspection. No framework, cloud subscription, service provisioning or package installation is required in the prepared environment.

After canonical records and HTML structure are stable:

```powershell
node .\tools\sync-research.mjs
node .\tools\sync-research.mjs --check
node --test .\tools\build-paper.test.mjs
node --test .\tests\validation.test.mjs
node --test .\tests\assessment*.test.cjs
node .\tools\validate-research.mjs
node .\tools\validate-content.mjs
node .\tools\validate-local-references.mjs
node .\reference-validation\scripts\validate.mjs
```

`--paper-only` and `--microsite-only` restrict generation/checks to one target. The helper replaces bounded generated blocks only, preserves target line endings, escapes HTML-sensitive JSON, and rejects duplicate/missing markers or unresolved control source IDs. `--check` is read-only and exits nonzero on stale output. In concurrent maintenance, obtain the HTML owner's explicit release before modifying the microsite and the data owner's stable handoff before final generation.

Build the paper only after the edition's exact evidence status and content are declared final. For an isolated browser profile, supply a **new, unused** directory in the publishing session's files area, never your personal profile:

```powershell
$publishScratch = 'C:\path\to\your\publishing-session\files'
$env:ATF_BROWSER_PROFILE = Join-Path $publishScratch ('paper-' + [guid]::NewGuid())
node .\tools\build-paper.mjs
node .\tools\build-paper.mjs --check
node .\tools\validate-project.mjs --skip-manifest
```

`ATF_BROWSER` can select an existing Edge/Chrome/Chromium executable and `ATF_PYTHON` an existing Python interpreter. The helper reuses the bounded native-CDP browser launcher, blocks HTTP(S), makes the page offline and prints actual local HTML using A4 portrait CSS, light theme, background graphics, no browser headers/footers and local fonts/assets. It removes its isolated profile after completion. If a browser exits before its debugging endpoint is ready, select a working existing Chromium executable explicitly; the helper does not download one or reuse an old PDF.

The PDF inspector rebases checkout-specific file links to the public project URLs so downloaded PDFs do not point to the maintainer's machine. Those PDF links require internet and the corresponding published static edition; this work does not deploy it. The HTML edition's relative links remain usable offline. `tools\build-paper.receipt.json` records canonical input hashes (including the linked examples, runbooks, authorization and execution ledger), actual PDF hash, browser version/settings and real extracted-text/page observations. `--check` does not print or write: it rejects stale sources/PDF and reinspects the existing PDF. Browser versions, fonts and timestamps can change binary bytes; this is a repeatable export procedure, not a byte-identical PDF guarantee. Manually inspect the cover, appendix, source catalog and page breaks as well.

After final local QA and all dependent validation artifacts are stable, refresh and check integrity:

```powershell
node .\tools\sync-research.mjs --manifest-only
node .\tools\sync-research.mjs --manifest-only --check
node .\tools\validate-project.mjs
```

Manifest-only mode touches no publication content and never stages or commits. Add newly published files to `manifest.json` deliberately before refreshing; it is an explicit inventory, not an automatic claim to cover every repository file. For an existing committed file, read-only `git show HEAD:path/to/file` or `git hash-object --path=path/to/file path/to/file` can inspect canonical Git content/filters without changing the index; Git object IDs are **not** SHA-256 manifest values.

Review time-sensitive evidence separately with `node .\tools\source-maintenance.mjs --as-of 2026-11-18 --json`, choosing the review date deliberately. An offline freshness audit is not a live link recheck. Refresh a source when its age, preview, licensing, regional or failure-behavior triggers require it; retain what was inspected, by whom/method, what changed and affected claim/control IDs. Re-run generation, affected tests and the PDF workflow after source-driven content changes.

## Status and limitations

This is **architectural guidance based on cited sources, not an official Microsoft product commitment**, a compliance certification or a substitute for legal, regulatory or safety advice.

The material reflects the stated research cutoff, not a live verification of product capabilities. Before implementation, revalidate licensing, preview status, service limits, supported clouds and regions, feature availability, threat models and organization-specific obligations. MUST / SHOULD / MAY express the framework's architecture-standard language; consult each control's provenance and applicability before adopting it.

## Open-source notices

### License

Copyright (c) Microsoft Corporation. This project is licensed under the [MIT License](./LICENSE).

The software and associated documentation are provided "AS IS", without warranty of any kind. See the license for the complete permission, warranty and liability terms. Links to third-party publications do not change those publications' licenses or terms.

### Code of conduct

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). See [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) for the FAQ and reporting resources.

### Security

Please do not report security vulnerabilities through public GitHub issues. Follow [SECURITY.md](./SECURITY.md) to report them privately to the Microsoft Security Response Center.

### Support

For community support and content corrections, see [SUPPORT.md](./SUPPORT.md). This reference package does not provide a Microsoft product-support entitlement or service-level agreement.

### Trademarks

This project may contain trademarks or logos for projects, products or services. Authorized use of Microsoft trademarks or logos is subject to and must follow the [Microsoft Trademark and Brand Guidelines](https://www.microsoft.com/en-us/legal/intellectualproperty/trademarks).

Use of Microsoft trademarks or logos in modified versions of this project must not cause confusion or imply Microsoft sponsorship. Use of third-party trademarks or logos is subject to those third parties' policies.
