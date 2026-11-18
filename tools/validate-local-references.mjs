import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { attributes, htmlTags, publicFiles, runCli } from './validate-common.mjs';

function cssReferences(css) {
  return [...css.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]+))\s*\)|@import\s+["']([^"']+)["']/gi)]
    .map(match => match[1] ?? match[2] ?? match[3] ?? match[4]);
}

export function inspectHtml(html) {
  const ids = new Set();
  const duplicates = [];
  const references = [];
  const idReferences = [];
  const tags = htmlTags(html);
  for (const { name, attrs } of tags) {
    if ('id' in attrs) {
      if (!attrs.id || ids.has(attrs.id)) duplicates.push(attrs.id || '(empty)');
      ids.add(attrs.id);
    }
    for (const field of ['href', 'src', 'poster', 'data', 'action', 'xlink:href']) {
      if (attrs[field] && (field !== 'data' || name === 'object')) references.push(attrs[field]);
    }
    if (attrs.srcset) {
      for (const candidate of attrs.srcset.split(',')) {
        const resource = candidate.trim().split(/\s+/)[0];
        if (resource && !resource.startsWith('data:')) references.push(resource);
      }
    }
    if (attrs.style) references.push(...cssReferences(attrs.style));
    for (const field of ['aria-controls', 'aria-labelledby', 'aria-describedby', 'for', 'headers']) {
      if (attrs[field]) idReferences.push(...attrs[field].trim().split(/\s+/));
    }
    if (name === 'base' && attrs.href) references.push('!unsupported-base-element');
  }
  for (const style of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)) {
    references.push(...cssReferences(style[1]));
  }
  const generatedIds = [];
  if (tags.some(tag => tag.name === 'script' && /(?:^|\/)assets\/app\.js$/.test(tag.attrs.src ?? ''))) {
    for (const script of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
      if (attributes(script[1]).id !== 'research-data') continue;
      try {
        const data = JSON.parse(script[2]);
        for (const [collection, prefix] of [
          ['sources', 'source-'], ['claims', 'claim-'],
          ['normativeControls', 'control-'], ['survivabilityTiers', 'tier-tab-'],
        ]) {
          for (const item of Array.isArray(data[collection]) ? data[collection] : []) {
            if (typeof item?.id === 'string') generatedIds.push(`${prefix}${item.id}`);
          }
        }
      } catch { /* The research/content validators report malformed embedded JSON. */ }
    }
  }
  // These are declared targets, not proof of rendering. Browser QA independently
  // checks the actual generated records, focus and filtered deep-link journeys.
  for (const id of generatedIds) ids.add(id);
  return { ids, duplicates, references, idReferences, generatedIds };
}

export function validateReferenceMap(files) {
  const errors = [];
  const documents = new Map();
  let checked = 0;
  let external = 0;
  for (const [file, content] of files) {
    if (/\.(?:html?|svg)$/i.test(file)) {
      const document = inspectHtml(content);
      documents.set(file, document);
      for (const id of document.duplicates) errors.push(`${file}: duplicate or empty HTML id "${id}"`);
      for (const id of document.idReferences) {
        if (!document.ids.has(id)) errors.push(`${file}: missing accessible relationship target #${id}`);
      }
    } else if (/\.css$/i.test(file)) {
      documents.set(file, { references: cssReferences(content) });
    } else if (/\.md$/i.test(file)) {
      const references = [...content.matchAll(/!?\[[^\]]*\]\((?:<([^>]+)>|([^\s)]+))(?:\s+["'][^)]*)?\)/g)]
        .map(match => match[1] ?? match[2]);
      documents.set(file, { references });
    }
  }
  for (const [file, document] of documents) {
    for (const reference of document.references) {
      if (/^(?:https?:|mailto:|tel:|data:|blob:|\/\/)/i.test(reference)) {
        external++;
        continue;
      }
      if (reference.startsWith('!') || reference.includes('\\') || reference.startsWith('/') ||
          /^[a-z][\w+.-]*:/i.test(reference)) {
        errors.push(`${file}: nonportable local reference "${reference}"`);
        continue;
      }
      try {
        const current = new URL(file, 'https://project.invalid/project/');
        const target = new URL(reference, current);
        if (!target.pathname.startsWith('/project/')) {
          errors.push(`${file}: reference escapes project-site path "${reference}"`);
          continue;
        }
        let destination = decodeURIComponent(target.pathname.slice('/project/'.length));
        if (destination.endsWith('/')) {
          // Repository documentation may link a source directory; browser
          // navigation still requires an actual index.html at that location.
          if (/\.md$/i.test(file) && [...files.keys()].some(name => name.startsWith(destination))) {
            checked++;
            continue;
          }
          destination += 'index.html';
        }
        checked++;
        if (!files.has(destination)) {
          errors.push(`${file}: missing local target "${reference}" (${destination})`);
          continue;
        }
        if (target.hash && /\.(?:html?|svg)$/i.test(destination)) {
          const id = decodeURIComponent(target.hash.slice(1));
          if (id && !documents.get(destination)?.ids?.has(id)) {
            errors.push(`${file}: missing fragment "${reference}"`);
          }
        }
      } catch (error) {
        errors.push(`${file}: invalid reference "${reference}": ${error.message}`);
      }
    }
  }
  return {
    check: 'local-references', errors,
    stats: {
      checked, external, htmlDocuments: [...documents.keys()].filter(file => /\.html?$/i.test(file)).length,
      declaredRuntimeFragments: [...documents.values()].reduce((count, document) => count + (document.generatedIds?.length ?? 0), 0),
    },
  };
}

export function validateLocalReferences(root, renderedDocuments = new Map()) {
  const files = new Map(publicFiles(root).map(relative => {
    const file = path.join(root, ...relative.split('/'));
    return [relative, /\.(?:html?|css|md|svg)$/i.test(relative) ? readFileSync(file, 'utf8') : ''];
  }));
  if (!existsSync(root) || !statSync(root).isDirectory()) throw new Error('Invalid project root');
  for (const [relative, markup] of renderedDocuments) {
    if (!files.has(relative)) throw new Error(`Unknown rendered document: ${relative}`);
    files.set(relative, markup);
  }
  return validateReferenceMap(files);
}

runCli(import.meta, validateLocalReferences);
