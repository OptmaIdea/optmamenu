import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const CUTOFF = '20261022000000';
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function escapeRegex(value) {
  return value.replace(/[^a-zA-Z0-9_]/g, '\\$&');
}

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n\r]*/g, ' ');
}

export function auditSql(source, filename = '<fixture>') {
  const errors = [];
  const sql = stripComments(source);
  const tableCreate = /\bCREATE\s+(?:UNLOGGED\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:(?:"?([a-z_]\w*)"?)[.])?("?([a-z_]\w*)"?)/gi;

  for (const match of sql.matchAll(tableCreate)) {
    const schema = (match[1] || 'public').toLowerCase();
    const table = (match[3] || '').toLowerCase();
    if (schema !== 'public' || !table) continue;

    const t = escapeRegex(table);
    const rls = new RegExp('\\bALTER\\s+TABLE\\s+(?:IF\\s+EXISTS\\s+)?(?:(?:"?public"?)[.])?"?' + t + '"?\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY\\b', 'i');
    const grant = new RegExp('\\bGRANT\\s+[^;]{1,300}?\\s+ON\\s+(?:TABLE\\s+)?(?:(?:"?public"?)[.])?"?' + t + '"?\\s+TO\\s+([^;]+);', 'gi');
    const privateMarker = new RegExp('--\\s*optmamenu:data-api-private\\s+' + t + '(?=\\s|$)', 'im');
    const markedPrivate = privateMarker.test(source);
    const grants = [...sql.matchAll(grant)];
    const exposed = grants.some(m => /\b(?:anon|authenticated|service_role)\b/i.test(m[1]));

    if (!rls.test(sql)) {
      errors.push(filename + ': public.' + table + ' needs explicit ENABLE ROW LEVEL SECURITY');
    }
    if (markedPrivate && exposed) {
      errors.push(filename + ': public.' + table + ' declared private but exposes a Data API role');
    } else if (!markedPrivate && !exposed) {
      errors.push(filename + ': public.' + table + ' needs role-specific GRANT or -- optmamenu:data-api-private ' + table);
    }
  }
  return errors;
}

export function auditDirectory(root = repoRoot) {
  const folder = path.join(root, 'supabase/migrations');
  const files = fs.readdirSync(folder)
    .filter(name => /^\d{14}_[a-zA-Z0-9_.-]+\.sql$/.test(name) && name.slice(0, 14) >= CUTOFF)
    .sort();
  return {
    files,
    errors: files.flatMap(name => auditSql(
      fs.readFileSync(path.join(folder, name), 'utf8'), name)),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { files, errors } = auditDirectory();
  if (errors.length) {
    for (const e of errors) console.error('P03 VIOLATION: ' + e);
    process.exitCode = 1;
  } else {
    console.log('P03 PASS: ' + files.length + ' future migrations reviewed for explicit RLS + grants or deliberate private-table markers.');
  }
}
