import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { access, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { syncResearch } from './sync-research.mjs';
import { withLocalBrowser } from './validate-browser-runtime.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const paper = path.join(root, 'position-paper', 'position-paper.html');
const stylesheet = path.join(root, 'position-paper', 'paper.css');
const research = path.join(root, 'adaptive-trust-fabric-microsite', 'data', 'research.json');
const output = path.join(root, 'position-paper', 'Adaptive-Trust-Fabric-Position-Paper.pdf');
const receipt = path.join(root, 'tools', 'build-paper.receipt.json');

async function exists(file) {
  try { await access(file); return true; } catch { return false; }
}

export async function canonicalHash(file, binary = false) {
  const bytes = binary ? await readFile(file) : Buffer.from((await readFile(file, 'utf8')).replace(/\r\n/g, '\n'), 'utf8');
  return { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
}

async function inputHashes() {
  const inputs = {};
  for (const file of [
    paper, stylesheet, research, fileURLToPath(import.meta.url),
    ...['build-paper.py', 'sync-research.mjs', 'validate-browser-runtime.mjs'].map(name => path.join(root, 'tools', name)),
    ...[
      ['index.html'], ['contract.json'],
      ['cases', 'e1.json'], ['cases', 'e2.json'], ['cases', 'e3.json'],
      ['runbooks', 'r1-emergency.json'], ['runbooks', 'r2-phs.json'],
      ['runbooks', 'r3-tenant-restore.json'], ['runbooks', 'r4-s3-outage.json'],
      ['evidence', 'authorization-request.json'], ['evidence', 'executions.json']
    ].map(parts => path.join(root, 'reference-validation', ...parts))
  ]) {
    inputs[path.relative(root, file).split(path.sep).join('/')] = await canonicalHash(file);
  }
  return inputs;
}

function run(command, args, timeout = 120000) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      if (child.pid) {
        spawn('powershell', ['-NoProfile', '-Command', `Stop-Process -Id ${child.pid} -Force -ErrorAction SilentlyContinue`], { windowsHide: true, stdio: 'ignore' });
      }
      reject(new Error(`${path.basename(command)} exceeded ${timeout / 1000}s; stopped owned PID ${child.pid}.`));
    }, timeout);
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.once('error', error => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.once('close', code => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

async function browserPath() {
  if (process.env.ATF_BROWSER) {
    if (!await exists(process.env.ATF_BROWSER)) throw new Error('ATF_BROWSER does not point to an existing executable.');
    return process.env.ATF_BROWSER;
  }
  const candidates = [
    process.env['ProgramFiles(x86)'] && path.join(process.env['ProgramFiles(x86)'], 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
  ].filter(Boolean);
  for (const candidate of candidates) if (await exists(candidate)) return candidate;
  throw new Error('No installed Edge/Chrome found. Set ATF_BROWSER to an existing executable; no download is performed.');
}

async function inspectPdf(file, rebase = false) {
  const result = await run(process.env.ATF_PYTHON || 'python', [
    path.join(root, 'tools', 'build-paper.py'), '--pdf', file, '--research', research,
    ...(rebase ? ['--rebase-links'] : [])
  ]);
  let report;
  try { report = JSON.parse(result.stdout); } catch {
    throw new Error(`PDF inspector failed. Install/activate the documented existing PyMuPDF environment if missing.\n${result.stderr || result.stdout}`);
  }
  if (result.code !== 0 || report.errors.length) throw new Error(`PDF content/pagination check failed:\n${report.errors.join('\n')}`);
  return report;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  if ([...args].some(arg => !['--check', '--help'].includes(arg))) {
    throw new Error('Usage: node tools\\build-paper.mjs [--check]');
  }
  if (args.has('--help')) {
    console.log('node tools\\build-paper.mjs [--check]');
    console.log('Build: existing Chromium via bounded offline CDP, A4 CSS, backgrounds, light theme, no headers; validates extracted PDF core wording.');
    console.log('--check: no browser or writes; checks source/PDF hashes against the build receipt and inspects existing PDF.');
    console.log('ATF_BROWSER / ATF_PYTHON override installed executables; ATF_BROWSER_PROFILE must select an unused isolated profile directory.');
    return;
  }
  const sync = await syncResearch({ check: true, paperOnly: true });
  if (sync.stale.length) throw new Error('Paper generated blocks are stale. Run tools\\sync-research.mjs only after stable handoffs.');
  const inputs = await inputHashes();
  if (args.has('--check')) {
    const saved = JSON.parse(await readFile(receipt, 'utf8'));
    if (JSON.stringify(saved.inputs) !== JSON.stringify(inputs)) throw new Error('PDF build receipt inputs are stale; rebuild after final content approval.');
    if (JSON.stringify(saved.output) !== JSON.stringify(await canonicalHash(output, true))) throw new Error('PDF does not match its build receipt.');
    const report = await inspectPdf(output);
    console.log(`PASS existing PDF: ${report.page_count} A4 pages; ${report.control_count} complete controls; ${report.source_count} source IDs.`);
    return;
  }
  const browser = await browserPath();
  if (!process.env.ATF_BROWSER_PROFILE) throw new Error('Set ATF_BROWSER_PROFILE to a new, unused isolated publishing profile directory.');
  const profile = path.resolve(process.env.ATF_BROWSER_PROFILE);
  if (await exists(profile)) throw new Error('Refusing to reuse a browser profile. Supply a new isolated ATF_BROWSER_PROFILE directory.');
  const staging = `${profile}-paper.pdf`;
  try {
    let browserVersion;
    await withLocalBrowser({ browser, profile }, async ({ send, evaluate, version }) => {
      browserVersion = version;
      const url = `${pathToFileURL(paper).href}?clawpilotTheme=light`;
      await send('Page.navigate', { url });
      let ready = false;
      for (let attempt = 0; attempt < 50; attempt++) {
        if (await evaluate(`location.href === ${JSON.stringify(url)} && document.readyState === "complete" && document.querySelectorAll("tr[data-control-id]").length === ${sync.counts.controls}`)) {
          ready = true;
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      if (!ready) throw new Error('Local paper did not finish loading.');
      await evaluate('document.fonts.ready.then(() => true)');
      const printed = await send('Page.printToPDF', {
        printBackground: true, preferCSSPageSize: true, displayHeaderFooter: false
      });
      await writeFile(staging, Buffer.from(printed.data, 'base64'));
    });
    const report = await inspectPdf(staging, true);
    if (JSON.stringify(inputs) !== JSON.stringify(await inputHashes())) throw new Error('Inputs changed during printing; PDF was not published. Wait for stable handoffs.');
    const bytes = await readFile(staging);
    await writeFile(output, bytes);
    const record = {
      method: 'Existing Chromium native CDP Page.printToPDF; network offline/HTTP(S) blocked; A4 portrait CSS; light theme; backgrounds; no browser header/footer. PyMuPDF rebases checkout-specific links to public project URLs.',
      repeatability: 'Same source/settings; Chromium timestamps/font/renderer versions can change PDF bytes.',
      browser: browserVersion,
      generated_on: new Date().toISOString(),
      inputs,
      output: await canonicalHash(output, true),
      inspection: { ...report, pdf: path.relative(root, output).split(path.sep).join('/') }
    };
    await writeFile(receipt, JSON.stringify(record, null, 2) + '\n', 'utf8');
    console.log(`BUILT ${path.relative(root, output)}: ${report.page_count} A4 pages; ${report.control_count} complete controls; ${report.source_count} source IDs.`);
    console.log('Local publication checks passed. This does not constitute operational/lab validation.');
  } finally {
    await rm(staging, { force: true, maxRetries: 8, retryDelay: 250 });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
