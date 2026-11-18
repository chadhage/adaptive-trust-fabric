import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const projectRoot = fileURLToPath(new URL('../', import.meta.url));

export function isMain(meta) {
  return Boolean(process.argv[1]) && meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
}

export function options(args = process.argv.slice(2)) {
  const result = { root: projectRoot, json: false, skipManifest: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--root' && args[i + 1]) result.root = path.resolve(args[++i]);
    else if (args[i] === '--json') result.json = true;
    else if (args[i] === '--skip-manifest') result.skipManifest = true;
    else throw new Error(`Unknown or incomplete option: ${args[i]}`);
  }
  return result;
}

export function printResult(result, json = false) {
  if (json) console.log(JSON.stringify(result, null, 2));
  else {
    for (const check of result.checks ?? [result]) {
      console.log(`${check.errors.length ? 'FAIL' : 'PASS'} ${check.check}: ${JSON.stringify(check.stats ?? {})}`);
      for (const error of check.errors) console.error(`  ${error}`);
      for (const warning of check.warnings ?? []) console.warn(`  WARN ${warning}`);
    }
  }
  process.exitCode = (result.errors ?? result.checks.flatMap(check => check.errors)).length ? 1 : 0;
}

export function runCli(meta, validate) {
  if (!isMain(meta)) return;
  try {
    const config = options();
    printResult(validate(config.root), config.json);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

export function readJson(root, relative) {
  return JSON.parse(readFileSync(path.join(root, relative), 'utf8'));
}

const entities = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ndash: '–', mdash: '—', hellip: '…', copy: '©', reg: '®', trade: '™',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', rarr: '→', larr: '←',
};

export function decodeHtml(value) {
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (whole, entity) => {
    if (entity[0] !== '#') return entities[entity.toLowerCase()] ?? whole;
    const point = entity[1].toLowerCase() === 'x'
      ? Number.parseInt(entity.slice(2), 16) : Number.parseInt(entity.slice(1), 10);
    return point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff)
      ? String.fromCodePoint(point) : whole;
  });
}

export function textContent(html) {
  return decodeHtml(html.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ').trim();
}

export function attributes(input) {
  const result = {};
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for (const match of input.matchAll(pattern)) {
    result[match[1].toLowerCase()] = decodeHtml(match[2] ?? match[3] ?? match[4] ?? '');
  }
  return result;
}

export function htmlTags(html) {
  const markup = html.replace(/<!--[\s\S]*?-->/g, '')
    .replace(/(<(?:script|style)\b[^>]*>)[\s\S]*?<\/(?:script|style)\s*>/gi, '$1');
  return [...markup.matchAll(/<([a-z][\w:-]*)\b((?:"[^"]*"|'[^']*'|[^'">])*)>/gi)]
    .map(match => ({ name: match[1].toLowerCase(), attrs: attributes(match[2]) }));
}

export function publicFiles(root) {
  const excluded = new Set(['.git', 'node_modules', '_site']);
  const result = [];
  function walk(directory, relative = '') {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if ((entry.name.startsWith('.') && entry.name !== '.github') || excluded.has(entry.name)) continue;
      const name = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(path.join(directory, entry.name), name);
      else if (entry.isFile()) result.push(name);
    }
  }
  walk(root);
  return result.sort();
}

export function safeFile(root, relative) {
  if (typeof relative !== 'string' || !relative || relative.includes('\\') ||
      relative.startsWith('/') || /^[a-z][\w+.-]*:/i.test(relative)) return null;
  const resolved = path.resolve(root, ...relative.split('/'));
  const within = path.relative(root, resolved);
  return within && !within.startsWith(`..${path.sep}`) && within !== '..' && !path.isAbsolute(within)
    ? resolved : null;
}
