import { readFileSync } from 'node:fs';
import path from 'node:path';
import { runCli } from './validate-common.mjs';

function jobs(text) {
  const body = text.split(/^jobs:\s*$/m)[1] ?? '';
  const sections = [...body.matchAll(/^  ([\w-]+):\s*$/gm)];
  return new Map(sections.map((match, index) => [
    match[1], body.slice(match.index, sections[index + 1]?.index ?? body.length),
  ]));
}

// This is a bounded policy check for these two small workflows, not a YAML
// interpreter. Unsupported indirection is rejected rather than evaluated.
export function validateWorkflowText(validation, pages) {
  const errors = [];
  const forbidden = [
    [/\bpull_request_target\s*:|\bworkflow_run\s*:/, 'privileged event'],
    [/\b(?:write-all|[a-z-]+:\s*write)\b/, 'write permission'],
    [/\bsecrets\s*:|\bsecrets\./, 'secret access'],
    [/^\s*environment\s*:/m, 'deployment environment'],
    [/uses:\s*[^\n]*(?:deploy-pages|configure-pages|upload-pages-artifact|pages\.yml)/, 'deployment action'],
  ];
  for (const [pattern, name] of forbidden) {
    if (pattern.test(validation)) errors.push(`PR validation must not contain ${name}`);
  }
  if (!/^  pull_request:\s*$/m.test(validation) || !/^  workflow_call:\s*$/m.test(validation)) {
    errors.push('Validation must support both pull_request and workflow_call');
  }
  if (!/permissions:\s*\n\s+contents:\s*read/.test(validation)) errors.push('Validation must declare read-only contents permission');
  if (!/persist-credentials:\s*false/.test(validation)) errors.push('Validation checkout must not persist credentials');
  if (!/run:\s*node --test\s*$/m.test(validation) ||
      !/run:\s*node tools\/validate-project\.mjs\s*$/m.test(validation)) {
    errors.push('Validation must run decision/validator tests and full integrity validation without bypasses');
  }
  const deploymentJobs = jobs(pages);
  const top = pages.split(/^jobs:\s*$/m)[0];
  if (/\b(?:pages|id-token):\s*write/.test(top)) errors.push('Pages write permissions must be job-scoped, not inherited by validation/build');
  const validate = deploymentJobs.get('validate') ?? '';
  const build = deploymentJobs.get('build') ?? '';
  const deploy = deploymentJobs.get('deploy') ?? '';
  if (!/uses:\s*\.\/\.github\/workflows\/validate\.yml\s*$/m.test(validate)) errors.push('Pages must call the same reusable validation workflow');
  if (!/^\s+needs:\s*validate\s*$/m.test(build)) errors.push('Pages build must depend on validation');
  if (!/^\s+needs:\s*build\s*$/m.test(deploy)) errors.push('Pages deploy must depend on the validated build');
  for (const [name, job] of deploymentJobs) {
    if (name !== 'deploy' && /\b(?:pages|id-token):\s*write/.test(job)) errors.push(`${name} must not inherit deployment credentials`);
  }
  if (!/pages:\s*write/.test(deploy) || !/id-token:\s*write/.test(deploy)) errors.push('Only the deploy job must hold its required Pages/OIDC permissions');
  if (!/node tools\/validate-local-references\.mjs --root _site/.test(build)) errors.push('Staged Pages assets must receive project-relative link validation');
  if (!/if:\s*github\.ref == 'refs\/heads\/main'/.test(deploy)) errors.push('Pages deployment must be restricted to main');
  if (/secrets:\s*inherit/.test(pages) || /<<:|[!&*][a-z][\w-]*\s*$/m.test(validation + pages)) {
    errors.push('Workflow policy does not permit inherited secrets or YAML indirection');
  }
  return { check: 'workflow-policy', errors, stats: { pullRequestDeploys: false, deploymentGate: 'validate -> build -> deploy' } };
}

export function validateWorkflows(root) {
  return validateWorkflowText(
    readFileSync(path.join(root, '.github', 'workflows', 'validate.yml'), 'utf8'),
    readFileSync(path.join(root, '.github', 'workflows', 'pages.yml'), 'utf8'),
  );
}

runCli(import.meta, validateWorkflows);
