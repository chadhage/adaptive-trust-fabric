import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(root, 'adaptive-trust-fabric-microsite', 'data', 'research.json');

export function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

export function embeddedJson(data) {
  return JSON.stringify(data, null, 2)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function replaceEmbedded(html, data) {
  const block = /(<script\b(?=[^>]*\s+id\s*=\s*["']research-data["'])(?=[^>]*\s+type\s*=\s*["']application\/json["'])[^>]*>)[\s\S]*?(<\/script>)/g;
  const matches = [...html.matchAll(block)];
  if (matches.length !== 1) throw new Error('Expected exactly one script#research-data JSON block.');
  return html.replace(block, (_, start, end) => `${start}${embeddedJson(data)}\n  ${end}`);
}

export function replaceGenerated(html, name, content) {
  const start = `<!-- BEGIN GENERATED:${name} -->`;
  const end = `<!-- END GENERATED:${name} -->`;
  if (html.split(start).length !== 2 || html.split(end).length !== 2) {
    throw new Error(`Expected exactly one generated ${name} marker pair.`);
  }
  const before = html.indexOf(start) + start.length;
  const after = html.indexOf(end);
  if (before > after) throw new Error(`Reversed generated ${name} markers.`);
  return `${html.slice(0, before)}\n${content}\n${html.slice(after)}`;
}

function sourceLinks(ids, sourceMap) {
  return ids.map(id => {
    const source = sourceMap.get(id);
    if (!source) throw new Error(`Unknown source reference: ${id}`);
    return `<a class="ref" href="${escapeHtml(source.url)}">[${escapeHtml(id)}]</a>`;
  }).join(' ');
}

export function controlAppendix(data) {
  const sources = new Map(data.sources.map(source => [source.id, source]));
  const rows = data.normativeControls.map(control => {
    const verification = control.verification?.method;
    if (!verification) throw new Error(`${control.id} lacks structured verification.method.`);
    const origin = control.requirement_origin || control.provenance;
    return `      <tr id="control-${escapeHtml(control.id)}" data-control-id="${escapeHtml(control.id)}"><td><span class="level ${escapeHtml(control.level.toLowerCase())}" data-field="level">${escapeHtml(control.level)}</span><br><b>${escapeHtml(control.id)}</b></td><td data-field="domain">${escapeHtml(control.domain)}</td><td><p class="control-core" data-field="text">${escapeHtml(control.text)}</p><p class="control-detail"><b>Owner:</b> ${escapeHtml(control.accountable_role)}<br><b>Verify:</b> ${escapeHtml(verification)}</p><p class="control-detail"><a href="../adaptive-trust-fabric-microsite/index.html#control-${escapeHtml(control.id)}">Detailed applicability, evidence, pass/fail criteria and exceptions</a></p></td><td>${sourceLinks(control.sources, sources)}<br><span class="provenance" data-field="provenance">${escapeHtml(control.provenance)}</span><p class="control-detail"><b>Requirement origin:</b> ${escapeHtml(origin)}</p></td></tr>`;
  });
  return [
    '  <table class="standard-table compact">',
    '    <colgroup><col><col><col><col></colgroup>',
    '    <thead><tr><th>Level / ID</th><th>Domain</th><th>Core requirement and verification</th><th>Provenance / origin</th></tr></thead>',
    '    <tbody>',
    ...rows,
    '    </tbody>',
    '  </table>'
  ].join('\n');
}

export function roadmapTable(data) {
  return [
    '  <table class="roadmap">',
    '    <thead><tr><th style="width:16%">Planning range</th><th style="width:22%">Work area</th><th>Actions and readiness gates</th></tr></thead>',
    '    <tbody>',
    ...data.roadmap.map(phase => {
      const actions = phase.actions.map(action => `<li>${escapeHtml(action)}</li>`).join('');
      const gate = phase.gate || phase.exit_gate;
      const gateText = gate ? `<p><b>Expansion gate:</b> ${escapeHtml(gate)}</p>` : '';
      return `      <tr><td>${escapeHtml(phase.phase)}</td><td><b>${escapeHtml(phase.outcome)}</b></td><td><ul>${actions}</ul>${gateText}</td></tr>`;
    }),
    '    </tbody>',
    '  </table>'
  ].join('\n');
}

export function sourceCatalog(data) {
  return '  <div class="sources">\n' + data.sources.map(source => {
    const details = [source.provenance];
    if (source.last_updated) details.push(`source revision ${source.last_updated}`);
    if (source.accessed) details.push(`recorded access ${source.accessed}`);
    if (source.evidence?.status) details.push(`evidence ${source.evidence.status}`);
    return `    <div class="source" id="source-${escapeHtml(source.id)}"><div class="sid">${escapeHtml(source.id)}</div><p><a href="${escapeHtml(source.url)}">${escapeHtml(source.title)}</a> <span class="small">(${escapeHtml(details.join('; '))})</span></p></div>`;
  }).join('\n') + '\n  </div>';
}

function validateData(data) {
  for (const key of ['sources', 'claims', 'normativeControls', 'roadmap']) {
    if (!Array.isArray(data[key]) || data[key].length === 0) throw new Error(`Missing ${key} records.`);
  }
  for (const key of ['sources', 'claims', 'normativeControls']) {
    const ids = data[key].map(record => record.id);
    if (ids.some(id => !id) || new Set(ids).size !== ids.length) {
      throw new Error(`Missing or duplicate identifiers in ${key}.`);
    }
  }
}

export async function syncResearch(options = {}) {
  const originalSource = await readFile(sourcePath, 'utf8');
  const data = JSON.parse(originalSource);
  validateData(data);
  const targets = [];
  if (!options.paperOnly) {
    targets.push({
      file: path.join(root, 'adaptive-trust-fabric-microsite', 'index.html'),
      transform: html => replaceEmbedded(html, data)
    });
  }
  if (!options.micrositeOnly) {
    targets.push({
      file: path.join(root, 'position-paper', 'position-paper.html'),
      transform: html => {
        let updated = replaceGenerated(html, 'controls', controlAppendix(data));
        updated = replaceGenerated(updated, 'roadmap', roadmapTable(data));
        return replaceGenerated(updated, 'sources', sourceCatalog(data));
      }
    });
  }
  const updates = await Promise.all(targets.map(async target => {
    const original = await readFile(target.file, 'utf8');
    const newline = original.includes('\r\n') ? '\r\n' : '\n';
    const normalized = original.replace(/\r\n/g, '\n');
    const generated = target.transform(normalized).replace(/\n/g, newline);
    return { file: target.file, original, generated };
  }));
  if (await readFile(sourcePath, 'utf8') !== originalSource) {
    throw new Error('Canonical data changed during generation; retry only after its owner declares it stable.');
  }
  const stale = updates.filter(update => update.original !== update.generated);
  for (const update of stale) {
    if (!options.check) await writeFile(update.file, update.generated, 'utf8');
    console.log(`${options.check ? 'STALE' : 'UPDATED'} ${path.relative(root, update.file)}`);
  }
  if (!stale.length) console.log('Generated research blocks are current.');
  console.log(`${data.sources.length} sources; ${data.claims.length} claims; ${data.normativeControls.length} controls.`);
  return { stale: stale.map(update => path.relative(root, update.file)), counts: {
    sources: data.sources.length, claims: data.claims.length, controls: data.normativeControls.length
  } };
}

export async function syncManifest({ check = false } = {}) {
  const file = path.join(root, 'manifest.json');
  const original = await readFile(file, 'utf8');
  const manifest = JSON.parse(original);
  const stale = [];
  const textExtensions = new Set(['.md', '.html', '.css', '.js', '.mjs', '.cjs', '.json', '.py', '.svg', '.excalidraw', '.yml', '.yaml', '.txt', '.csv', '.ps1']);
  const paths = new Set();
  for (const entry of manifest.files) {
    const target = path.resolve(root, ...entry.path.split('/'));
    const key = target.toLowerCase();
    if (!key.startsWith((root + path.sep).toLowerCase()) || key === file.toLowerCase() || paths.has(key)) {
      throw new Error(`Unsafe, self-referential or duplicate manifest path: ${entry.path}`);
    }
    paths.add(key);
    const raw = await readFile(target);
    const canonical = (textExtensions.has(path.extname(target).toLowerCase()) || path.basename(target) === 'LICENSE')
      ? Buffer.from(raw.toString('utf8').replace(/\r\n/g, '\n'), 'utf8') : raw;
    const hash = createHash('sha256').update(canonical).digest('hex');
    if (entry.bytes !== canonical.length || entry.sha256 !== hash) stale.push(entry.path);
    entry.bytes = canonical.length;
    entry.sha256 = hash;
  }
  for (const entry of stale) console.log(`${check ? 'STALE' : 'HASHED'} ${entry}`);
  if (!check && stale.length) await writeFile(file, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(`${manifest.files.length} listed files; UTF-8 CRLF-to-LF text; binary bytes unchanged. No Git index writes.`);
  return { stale };
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const allowed = new Set(['--check', '--paper-only', '--microsite-only', '--manifest-only', '--help']);
  const modes = ['--paper-only', '--microsite-only', '--manifest-only'].filter(mode => args.has(mode));
  if ([...args].some(arg => !allowed.has(arg)) || modes.length > 1) {
    throw new Error('Usage: node tools\\sync-research.mjs [--check] [--paper-only|--microsite-only|--manifest-only]');
  }
  if (args.has('--help')) {
    console.log('node tools\\sync-research.mjs [--check] [--paper-only|--microsite-only|--manifest-only]');
    console.log('Writes only generated blocks. --check is read-only and exits 1 if any block is stale.');
    console.log('--manifest-only refreshes only listed manifest hashes; use only after all content, PDF and QA repairs are stable.');
    return;
  }
  const result = args.has('--manifest-only')
    ? await syncManifest({ check: args.has('--check') })
    : await syncResearch({
      check: args.has('--check'), paperOnly: args.has('--paper-only'), micrositeOnly: args.has('--microsite-only')
    });
  if (args.has('--check') && result.stale.length) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
