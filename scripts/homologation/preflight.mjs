#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const EXPECTED_BRANCH = 'agent/homologacao-geral-20260820';
const shouldInstall = process.argv.includes('--install');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const gitCommand = process.platform === 'win32' ? 'git.exe' : 'git';

function tail(text, maxLines = 120) {
  const lines = String(text || '').split(/\r?\n/);
  return lines.slice(Math.max(0, lines.length - maxLines)).join('\n').trim();
}

function run(label, command, args = [], { critical = false } = {}) {
  const started = Date.now();
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    env: process.env,
    shell: false,
    maxBuffer: 16 * 1024 * 1024,
  });

  const stdout = tail(result.stdout);
  const stderr = tail(result.stderr);
  const exitCode = typeof result.status === 'number' ? result.status : 1;

  return {
    label,
    command: [command, ...args].join(' '),
    critical,
    exitCode,
    durationMs: Date.now() - started,
    stdout,
    stderr,
    error: result.error?.message || '',
  };
}

function safeTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function markdownBlock(text) {
  return `\n\`\`\`text\n${text || '(sem saída)'}\n\`\`\`\n`;
}

const results = [];

results.push(run('Git branch', gitCommand, ['branch', '--show-current'], { critical: true }));
results.push(run('Git status', gitCommand, ['status', '--short']));
results.push(run('Git head', gitCommand, ['log', '-1', '--oneline']));
results.push(run('Node version', process.execPath, ['--version'], { critical: true }));
results.push(run('npm version', npmCommand, ['--version'], { critical: true }));

const branch = results[0].stdout.trim();
if (branch !== EXPECTED_BRANCH) {
  results.push({
    label: 'Branch guard',
    command: 'internal',
    critical: true,
    exitCode: 2,
    durationMs: 0,
    stdout: '',
    stderr: `Branch atual: ${branch || '(desconhecida)'}. Esperada: ${EXPECTED_BRANCH}.`,
    error: '',
  });
}

if (shouldInstall) {
  results.push(run('npm ci', npmCommand, ['ci'], { critical: true }));
}

const nodeModulesReady = existsSync('node_modules');
if (!nodeModulesReady && !shouldInstall) {
  results.push({
    label: 'Dependencies guard',
    command: 'internal',
    critical: true,
    exitCode: 2,
    durationMs: 0,
    stdout: '',
    stderr: 'node_modules não existe. Rode novamente com --install ou execute npm ci antes.',
    error: '',
  });
} else {
  results.push(run('Vitest', npmCommand, ['test'], { critical: true }));
  results.push(run('Build', npmCommand, ['run', 'build'], { critical: true }));
  results.push(run('Lint', npmCommand, ['run', 'lint'], { critical: false }));
}

let playwrightStatus = 'não instalado';
try {
  const packagePath = join(process.cwd(), 'node_modules', '@playwright', 'test', 'package.json');
  if (existsSync(packagePath)) playwrightStatus = 'instalado';
} catch {
  playwrightStatus = 'não foi possível verificar';
}

const reportDir = join(process.cwd(), 'docs', 'reports');
mkdirSync(reportDir, { recursive: true });
const reportPath = join(reportDir, `HOMOLOGACAO_PREFLIGHT_${safeTimestamp()}.md`);

const criticalFailures = results.filter((item) => item.critical && item.exitCode !== 0);
const informativeFailures = results.filter((item) => !item.critical && item.exitCode !== 0);

const report = [
  '# Relatório automático de preflight — OptmaMenu',
  '',
  `- Data UTC: ${new Date().toISOString()}`,
  `- Branch esperada: \`${EXPECTED_BRANCH}\``,
  `- Branch encontrada: \`${branch || 'desconhecida'}\``,
  `- Playwright: **${playwrightStatus}**`,
  `- Falhas críticas: **${criticalFailures.length}**`,
  `- Falhas informativas: **${informativeFailures.length}**`,
  '',
  '## Resultados',
  '',
];

for (const result of results) {
  const status = result.exitCode === 0 ? 'PASS' : result.critical ? 'FAIL' : 'WARN';
  report.push(`### ${status} — ${result.label}`);
  report.push('');
  report.push(`- Comando: \`${result.command}\``);
  report.push(`- Exit code: \`${result.exitCode}\``);
  report.push(`- Duração: \`${result.durationMs} ms\``);
  if (result.stdout) {
    report.push('', '**stdout (últimas linhas):**', markdownBlock(result.stdout));
  }
  if (result.stderr || result.error) {
    report.push('', '**stderr/erro (últimas linhas):**', markdownBlock([result.stderr, result.error].filter(Boolean).join('\n')));
  }
}

report.push('', '## Interpretação', '');
report.push('- `npm test` e `npm run build` são gates críticos deste preflight.');
report.push('- `npm run lint` é registrado como WARN porque o repositório possui dívida histórica; não deve ser ocultada nem usada para declarar “lint limpo” sem correção real.');
report.push('- Este script não acessa nem altera o Supabase remoto e não instala Playwright automaticamente.');
report.push('- Execute os SQLs read-only em `scripts/homologation/sql/` separadamente no ambiente autorizado.');

writeFileSync(reportPath, report.join('\n'), 'utf8');

console.log(`Relatório criado em: ${reportPath}`);
for (const result of results) {
  const status = result.exitCode === 0 ? 'PASS' : result.critical ? 'FAIL' : 'WARN';
  console.log(`${status.padEnd(4)} ${result.label} (exit ${result.exitCode})`);
}

process.exit(criticalFailures.length > 0 ? 1 : 0);
