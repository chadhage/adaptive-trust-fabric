import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { readJson, runCli, safeFile } from './validate-common.mjs';
import { canonicalBytes } from './validate-manifest.mjs';

const requiredInputs = [
  'position-paper/position-paper.html',
  'position-paper/paper.css',
  'adaptive-trust-fabric-microsite/data/research.json',
  'tools/build-paper.mjs',
  'tools/build-paper.py',
  'tools/validate-browser-runtime.mjs',
];
const pdf = 'position-paper/Adaptive-Trust-Fabric-Position-Paper.pdf';

export function validatePublicationReceipt(receipt, readBytes) {
  const errors = [];
  const inputs = receipt?.inputs;
  if (!inputs || typeof inputs !== 'object' || Array.isArray(inputs)) {
    return { check: 'publication-receipt', errors: ['PDF receipt.inputs is required'], stats: {} };
  }
  for (const relative of requiredInputs) {
    if (!Object.hasOwn(inputs, relative)) errors.push(`PDF receipt is missing required input ${relative}`);
  }
  for (const [relative, expected] of [...Object.entries(inputs), [pdf, receipt.output]]) {
    if (!safeFile(path.resolve('.'), relative)) {
      errors.push(`PDF receipt contains unsafe input path ${relative}`);
      continue;
    }
    if (!Number.isSafeInteger(expected?.bytes) || !/^[a-f0-9]{64}$/.test(expected?.sha256 ?? '')) {
      errors.push(`${relative}: malformed PDF receipt fingerprint`);
      continue;
    }
    try {
      const bytes = relative === pdf ? readBytes(relative) : canonicalBytes(relative, readBytes(relative));
      const sha256 = createHash('sha256').update(bytes).digest('hex');
      if (bytes.length !== expected.bytes || sha256 !== expected.sha256) {
        errors.push(`${relative}: stale PDF build receipt; regenerate the paper after final source changes`);
      }
    } catch (error) { errors.push(`${relative}: ${error.message}`); }
  }
  return {
    check: 'publication-receipt', errors,
    stats: { inputs: Object.keys(inputs).length, pdf: 'exact binary fingerprint; semantic/visual checks performed at build and final QA' },
  };
}

export function validatePublication(root) {
  return validatePublicationReceipt(readJson(root, 'tools/build-paper.receipt.json'),
    relative => readFileSync(path.join(root, ...relative.split('/'))));
}

runCli(import.meta, validatePublication);
