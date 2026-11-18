import { createHash } from 'node:crypto';
import { isUtf8 } from 'node:buffer';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { readJson, runCli, safeFile } from './validate-common.mjs';

const textExtensions = new Set([
  '.html', '.css', '.js', '.mjs', '.cjs', '.json', '.md', '.txt', '.svg',
  '.yaml', '.yml', '.excalidraw', '.csv', '.ps1', '.py',
]);

// Only checkout CRLF conversion is normalized. BOMs, trailing whitespace, bare
// CRs and final-newline differences remain significant; PDFs are always binary.
export function canonicalBytes(relative, bytes) {
  const text = textExtensions.has(path.extname(relative).toLowerCase()) ||
    path.basename(relative) === 'LICENSE';
  if (text && !isUtf8(bytes)) throw new Error(`${relative}: canonical text must be valid UTF-8`);
  return text ? Buffer.from(bytes.toString('utf8').replace(/\r\n/g, '\n'), 'utf8') : bytes;
}

export function validateManifestEntries(manifest, readBytes) {
  const errors = [];
  let checked = 0;
  if (!manifest || !Array.isArray(manifest.files) || manifest.files.length === 0) {
    return { check: 'manifest', errors: ['manifest.files must be a nonempty array'], stats: { checked } };
  }
  for (const field of ['package', 'version', 'research_cutoff']) {
    if (typeof manifest[field] !== 'string' || !manifest[field].trim()) errors.push(`manifest.${field} is required`);
  }
  const seen = new Set();
  for (const [index, entry] of manifest.files.entries()) {
    const label = entry?.path ?? `files[${index}]`;
    if (!entry || !safeFile(path.resolve('.'), entry.path) || entry.path === 'manifest.json') {
      errors.push(`${label}: invalid or self-referential manifest path`);
      continue;
    }
    if (seen.has(entry.path.toLowerCase())) errors.push(`${label}: duplicate manifest path`);
    seen.add(entry.path.toLowerCase());
    if (!Number.isSafeInteger(entry.bytes) || entry.bytes < 0) errors.push(`${label}: invalid byte count`);
    if (!/^[a-f0-9]{64}$/.test(entry.sha256 ?? '')) errors.push(`${label}: invalid SHA-256`);
    try {
      const bytes = canonicalBytes(entry.path, readBytes(entry.path));
      const hash = createHash('sha256').update(bytes).digest('hex');
      checked++;
      if (entry.bytes !== bytes.length) errors.push(`${label}: bytes ${entry.bytes} != canonical ${bytes.length}`);
      if (entry.sha256 !== hash) errors.push(`${label}: SHA-256 mismatch`);
    } catch (error) {
      errors.push(`${label}: ${error.message}`);
    }
  }
  return { check: 'manifest', errors, stats: { checked, convention: 'UTF-8 text CRLF-to-LF only; binary exact' } };
}

export function validateManifest(root) {
  return validateManifestEntries(readJson(root, 'manifest.json'), relative => readFileSync(path.join(root, ...relative.split('/'))));
}

runCli(import.meta, validateManifest);
