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
| Use the source and requirement records in other tools | [Research JSON](./adaptive-trust-fabric-microsite/data/research.json) |

For example, from the repository root in Windows PowerShell:

```powershell
Start-Process .\index.html
```

No build step, package installation, Azure subscription or web server is required. Enable JavaScript for the microsite's interactive features and slide navigation. The local pages and assessment work offline; opening external source links requires internet access. Keep the microsite's assets alongside its entry page, and retain the sibling position-paper directory so its PDF links work. The original microsite entry point remains unchanged.

### Navigation and appearance

Use the menu button beside the project name on the landing page to open the navigation drawer. It contains the viewing options, position-paper download, research data and project-policy links. Close it with the close button, Escape, a click outside the drawer, or a navigation link. Keyboard focus stays inside the open drawer and returns to the menu button when it closes.

The **Dark theme** switch changes between light and dark. **Use system setting** clears the saved choice. On the published site, the choice is stored in this browser and applies to the landing page and slide presentation; the original microsite and infographic retain their fixed styling. If browser storage is unavailable, the current page can still change theme and displays a storage notice.

The existing `?clawpilotTheme=light` and `?clawpilotTheme=dark` URLs also select and save that theme. The drawer controls require JavaScript; the page's viewing cards and document links remain available without it.

## Repository walkthrough

| File | Purpose and use |
| --- | --- |
| [index.html](./index.html) | GitHub Pages entry point with a navigation drawer, theme controls, viewing options and position paper PDF download. |
| [adaptive-trust-fabric-infographic.html](./adaptive-trust-fabric-infographic.html) | Summary of control responsibilities, evaluation criteria, repository files and documented service limitations. Use **Print / Save PDF** to export it. |
| [adaptive-trust-fabric-microsite/index.html](./adaptive-trust-fabric-microsite/index.html) | Reference architecture, topology assessment, survivability tiers, topology patterns, control requirements, assumption reviews, implementation sequence and source search. Includes an embedded research-data copy for offline use. |
| [adaptive-trust-fabric-microsite/presentation.html](./adaptive-trust-fabric-microsite/presentation.html) | Browser presentation covering the architecture, evaluation criteria, topology patterns, operating tiers, identity, recovery and implementation phases. Shared theme preferences are loaded from the local site script. |
| [adaptive-trust-fabric-microsite/assets/app.js](./adaptive-trust-fabric-microsite/assets/app.js) | Browser-side assessment rules, data rendering, control filters and source search. Read or modify this to understand how assessment inputs become recommendations. |
| [adaptive-trust-fabric-microsite/assets/site.js](./adaptive-trust-fabric-microsite/assets/site.js) | Landing-page drawer controls and shared theme preferences for the landing page and presentation. |
| [adaptive-trust-fabric-microsite/assets/styles.css](./adaptive-trust-fabric-microsite/assets/styles.css) | Microsite layout, responsive styling and visual presentation. |
| [adaptive-trust-fabric-microsite/data/research.json](./adaptive-trust-fabric-microsite/data/research.json) | Source references, claims, control requirements, topology patterns, survivability tiers, evaluation criteria, assumption reviews and implementation phases. Records are linked by source identifiers. |
| [position-paper/Adaptive-Trust-Fabric-Position-Paper.pdf](./position-paper/Adaptive-Trust-Fabric-Position-Paper.pdf) | PDF edition of the position paper. |
| [position-paper/position-paper.html](./position-paper/position-paper.html) | Readable and editable HTML source of the paper, including its executive position, reference architecture, normative standard and source catalog. |
| [position-paper/paper.css](./position-paper/paper.css) | Print-oriented paper styling, including A4 page settings, tables and pagination rules. |
| [manifest.json](./manifest.json) | Package version, research cutoff, byte sizes and SHA-256 checksums for the files listed in the manifest. This is integrity metadata, not an application dependency manifest. |
| [.github/workflows/pages.yml](./.github/workflows/pages.yml) | Stages and deploys the static site to GitHub Pages on pushes to the default branch, `main`, or a manual workflow run. |
| [LICENSE](./LICENSE) | MIT license, Microsoft Corporation copyright notice and warranty/liability disclaimer. |
| [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) | Microsoft Open Source Code of Conduct adoption and conduct-reporting resources. |
| [SECURITY.md](./SECURITY.md) | Microsoft's private security-vulnerability reporting policy and MSRC contact information. |
| [SUPPORT.md](./SUPPORT.md) | Community-support channels and the boundary between this reference material and Microsoft product support. |

## Walk through the microsite

1. **Read Position and Architecture.** Review the evaluation criteria and the separation of policy ownership, identity administration, enforcement, telemetry and recovery.
2. **Run Assess.** Select the isolation level, sovereignty requirement, required survivability, acquisition or divestiture frequency, business-unit autonomy and operating maturity. Select safety-critical OT where applicable, then choose **Evaluate architecture**.
3. **Review the assessment.** Read the rationale, companion patterns, requirements that exclude alternative designs and operating-capability warning. The displayed survivability tier is your input, not a measured capability.
4. **Review Operation during outages and Topology patterns.** Compare identity, policy, security-operations and recovery requirements. Check both the use and rejection conditions for each topology.
5. **Filter Control requirements.** Select a domain and a MUST / SHOULD / MAY level. Use the source identifiers to find the cited documents in the source catalog.
6. **Review assumptions and implementation phases.** Read the documented assumption reviews, consider the proposed implementation sequence, and search Sources by title, source use or provenance class.

**Example:** the default selections produce T1 with S0 survivability. Change **Required survivability** to S4 and evaluate again to get T4 and its operating-capability warning.

The assessment applies **fixed rules to the selected inputs**. It does not inspect tenant configuration, calculate risk or cost, run failure scenarios or verify that requirements are met. Review its output using organization-specific dependency analysis, testing and product documentation. The assumption reviews compare statements with source limitations; they are not results from an executable security test suite.

### Understand topology and survivability labels

Topology describes how authority and boundaries are organized:

| Pattern | Intended role |
| --- | --- |
| T1 - One global tenant with delegated boundaries | Default when required boundaries can be met safely within one tenant. |
| T2 - Federated multi-tenant enterprise | Separate tenant control planes with governed collaboration across them. |
| T3 - Sovereign or independently recoverable tenant | Independent local authority over identity, administration, keys or recovery. |
| T4 - Disconnected enclave / cyber-physical cell | Operations requiring intentional isolation or independence from upstream services. |
| T5 - Acquisition transition zone | Restricted cross-tenant access during discovery and remediation, with a tested separation procedure; shown as a companion pattern in the assessment. |

Survivability describes the required operating behavior during disruption:

| Tier | Required operation |
| --- | --- |
| S0 - Cloud-dependent | Normal online SaaS and cloud operation. |
| S1 - Transient outage | Required functions continue through outages measured in hours, using session continuity and emergency access where supported. |
| S2 - Extended degraded | Days of reduced function with selected local services. |
| S3 - Independent operations | Required functions continue without upstream control planes. |
| S4 - Disconnected / air-gapped | Intentional isolation with local identity, policy, detection and recovery. |

Use these tiers to specify required functions and outage durations, then test them in the target environment. They are not product availability guarantees.

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

The top-level collections include `sources`, `claims`, `normativeControls`, `survivabilityTiers`, `topologies`, `hardConstraints`, `adversarialFindings` and `roadmap`. Source identifiers link claims and controls to URLs, provenance, recorded access dates and source-use descriptions. The existing `adversarialFindings` key contains the assumption-review records. Claim confidence labels are qualitative author assessments, not calibrated probabilities.

For example, list the framework's mandatory controls in PowerShell:

```powershell
$research = Get-Content -LiteralPath .\adaptive-trust-fabric-microsite\data\research.json -Raw |
    ConvertFrom-Json

$research.normativeControls |
    Where-Object level -eq 'MUST' |
    Select-Object id, domain, text
```

Source provenance is classified as **Microsoft Explicit**, **External Standard**, **Research Supported**, **Derived Architectural Position** or **Open/Contested**. MUST / SHOULD / MAY express this framework's requirements and recommendations. Source provenance does not make those normative levels Microsoft or regulatory requirements.

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

Only the [landing page](./index.html), [infographic](./adaptive-trust-fabric-infographic.html), [MIT license](./LICENSE), [microsite directory](./adaptive-trust-fabric-microsite/) and [position-paper directory](./position-paper/) are staged for publication. Relative links retain the repository's project-site prefix, and the paper remains available alongside the microsite. The landing-page footer links to the repository editions of the conduct, security and support policies. Repository metadata and workflow files are not included in the site artifact.

## Update and share the package

- **Writing style:** use defined engineering terms, state assumptions and failure conditions, and distinguish cited product behavior, proposed requirements and test results. Avoid slogans, unsupported superlatives and claims of verification without a stated method.
- **Microsite behavior and presentation:** edit the [HTML entry page](./adaptive-trust-fabric-microsite/index.html), [JavaScript](./adaptive-trust-fabric-microsite/assets/app.js) or [stylesheet](./adaptive-trust-fabric-microsite/assets/styles.css), then reopen or refresh the local page.
- **Landing page and slides:** edit the [format selector](./index.html) or [presentation](./adaptive-trust-fabric-microsite/presentation.html). Both include their own styling and work without external libraries.
- **Navigation and themes:** the landing-page drawer markup is in the [format selector](./index.html). Shared preference handling and drawer interactions are in [site.js](./adaptive-trust-fabric-microsite/assets/site.js); both the landing page and presentation load it before their styles.
- **Research changes:** keep the [JSON dataset](./adaptive-trust-fabric-microsite/data/research.json) and the `script#research-data` JSON block in the [microsite HTML](./adaptive-trust-fabric-microsite/index.html) synchronized. The browser reads the embedded copy; editing the standalone JSON alone does not update the microsite. Keep the landing-page counts, slides, paper and infographic consistent with the revised research.
- **Paper changes:** update the [paper HTML](./position-paper/position-paper.html) and [print stylesheet](./position-paper/paper.css), then regenerate the [PDF](./position-paper/Adaptive-Trust-Fabric-Position-Paper.pdf). A browser's Print / Save as PDF feature provides an export path; use A4 and background graphics, and inspect pagination and layout. Output can vary by print renderer; no automated PDF build script is included.
- **Integrity metadata:** refresh the byte count and SHA-256 checksum in the [manifest](./manifest.json) for each listed file you change.
- **Static hosting:** publish the repository's content with its relative paths intact. Hosting only the microsite subdirectory will omit the sibling PDF that its links reference.

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
