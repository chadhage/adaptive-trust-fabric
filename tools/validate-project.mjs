import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { isMain, options, printResult, publicFiles } from './validate-common.mjs';
import { validateResearch } from './validate-research.mjs';
import { validateContent } from './validate-content.mjs';
import { validateLocalReferences } from './validate-local-references.mjs';
import { validateManifest } from './validate-manifest.mjs';
import { validateWorkflows } from './validate-workflows.mjs';
import { validatePublication } from './validate-publication.mjs';

export function validateProject(root, { skipManifest = false } = {}) {
  const checks = [];
  for (const validator of [validateResearch, validateContent, validateLocalReferences, validateWorkflows, validatePublication, ...(skipManifest ? [] : [validateManifest])]) {
    try { checks.push(validator(root)); }
    catch (error) { checks.push({ check: validator.name, errors: [error.message], stats: {} }); }
  }
  const scripts = publicFiles(root).filter(file => /\.(?:js|mjs|cjs)$/i.test(file));
  const syntaxErrors = [];
  for (const relative of scripts) {
    const result = spawnSync(process.execPath, ['--check', path.join(root, ...relative.split('/'))], { encoding: 'utf8' });
    if (result.status !== 0) syntaxErrors.push(`${relative}: ${(result.stderr || result.error?.message || `Exit ${result.status}`).trim()}`);
  }
  checks.push({ check: 'javascript-syntax', errors: syntaxErrors, stats: { scripts: scripts.length } });
  for (const [relative, args] of [
    ['tools/sync-research.mjs', ['--check']],
    ['tools/source-maintenance.mjs', ['--json']],
  ]) {
    const result = spawnSync(process.execPath, [path.join(root, ...relative.split('/')), ...args], { cwd: root, encoding: 'utf8' });
    const check = {
      check: relative,
      errors: result.status === 0 ? [] : [(result.stderr || result.stdout || result.error?.message || `Exit ${result.status}`).trim()],
      stats: { exitCode: result.status },
    };
    if (args.includes('--json')) {
      try {
        const audit = JSON.parse(result.stdout);
        check.warnings = audit.warnings ?? [];
        Object.assign(check.stats, {
          asOf: audit.as_of, sources: audit.sources_total, evidenceRecords: audit.evidence_records_checked,
          due: audit.due_sources?.length, unverified: audit.unverified_sources?.length, warnings: check.warnings.length,
        });
      } catch {
        check.errors.push(`${relative}: machine-readable audit output is missing or invalid`);
      }
    }
    checks.push(check);
  }
  return { checks, errors: checks.flatMap(check => check.errors), manifestSkipped: skipManifest };
}

if (isMain(import.meta)) {
  try {
    const config = options();
    printResult(validateProject(config.root, config), config.json);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
