import { readFileSync } from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { attributes, readJson, runCli, textContent } from './validate-common.mjs';

function fieldText(html, field) {
  for (const match of html.matchAll(/<([a-z][\w:-]*)\b([^>]*\bdata-field\s*=\s*(?:"[^"]*"|'[^']*')[^>]*)>([\s\S]*?)<\/\1\s*>/gi)) {
    if (attributes(match[2])['data-field'] === field) return textContent(match[3]);
  }
  return null;
}

export function validateContentData(data, microsite, paper) {
  const errors = [];
  const scripts = [...microsite.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)]
    .filter(match => attributes(match[1]).id === 'research-data');
  if (scripts.length !== 1 || attributes(scripts[0]?.[1] ?? '').type !== 'application/json') {
    errors.push('Microsite must contain exactly one script#research-data[type="application/json"]');
  } else {
    try {
      if (!isDeepStrictEqual(JSON.parse(scripts[0][2]), data)) errors.push('Embedded research JSON differs semantically from canonical research.json');
    } catch (error) { errors.push(`Embedded research JSON cannot be parsed: ${error.message}`); }
  }
  const rows = new Map();
  for (const match of paper.matchAll(/<tr\b([^>]*)>([\s\S]*?)<\/tr\s*>/gi)) {
    const attrs = attributes(match[1]);
    if (!attrs['data-control-id']) continue;
    const id = attrs['data-control-id'];
    if (rows.has(id)) errors.push(`Paper contains duplicate control ${id}`);
    if (attrs.id !== `control-${id}`) errors.push(`Paper ${id} has no stable control-${id} anchor`);
    rows.set(id, match[2]);
  }
  for (const control of data.normativeControls ?? []) {
    const row = rows.get(control.id);
    if (!row) {
      errors.push(`Paper is missing canonical control ${control.id}`);
      continue;
    }
    for (const field of ['text', 'level', 'domain', 'provenance']) {
      if (fieldText(row, field) !== String(control[field] ?? '').replace(/\s+/g, ' ').trim()) {
        errors.push(`Paper ${control.id}.${field} is missing or differs from canonical content`);
      }
    }
    const actual = [...new Set([...textContent(row).matchAll(/\[((?:MS|STD|RES)-\d{2})\]/g)].map(match => match[1]))].sort();
    if (!isDeepStrictEqual(actual, [...control.sources].sort())) errors.push(`Paper ${control.id} source references differ from canonical sources`);
  }
  const canonicalIds = new Set((data.normativeControls ?? []).map(control => control.id));
  for (const id of rows.keys()) if (!canonicalIds.has(id)) errors.push(`Paper contains noncanonical control ${id}`);
  return { check: 'content-synchronization', errors, stats: { embeddedRecordsMatched: !errors.some(error => /JSON|research-data/.test(error)), paperControls: rows.size } };
}

export function validateContent(root) {
  return validateContentData(
    readJson(root, 'adaptive-trust-fabric-microsite/data/research.json'),
    readFileSync(path.join(root, 'adaptive-trust-fabric-microsite', 'index.html'), 'utf8'),
    readFileSync(path.join(root, 'position-paper', 'position-paper.html'), 'utf8'),
  );
}

runCli(import.meta, validateContent);
