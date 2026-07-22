#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const configPath = path.join(root, 'qa', 'qa-agent.config.json');
const outputDir = path.join(root, 'artifacts', 'qa-lm');
const now = new Date().toISOString();

function loadConfig() {
  if (!existsSync(configPath)) throw new Error(`Configuração ausente: ${configPath}`);
  return JSON.parse(readFileSync(configPath, 'utf8'));
}

function baseResult(check) {
  return {
    id: check.id,
    module: check.module,
    severity: check.severity,
    required: check.required !== false,
  };
}

function runCommand(check) {
  const startedAt = Date.now();
  const result = spawnSync(check.command, check.args ?? [], {
    cwd: root,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    env: { ...process.env, ...(check.env ?? {}) },
    timeout: check.timeoutMs ?? 180000,
  });

  const passed = result.status === 0 && !result.error;
  return {
    ...baseResult(check),
    kind: 'command',
    status: passed ? 'VALIDATED' : 'FAILED',
    command: [check.command, ...(check.args ?? [])].join(' '),
    exitCode: result.status,
    durationMs: Date.now() - startedAt,
    stdout: (result.stdout ?? '').trim().slice(-12000),
    stderr: (result.stderr ?? result.error?.message ?? '').trim().slice(-12000),
  };
}

function checkRequiredFile(check) {
  const fullPath = path.join(root, check.path);
  const passed = existsSync(fullPath);
  return {
    ...baseResult(check),
    kind: 'file',
    status: passed ? 'VALIDATED' : 'FAILED',
    path: check.path,
    evidence: passed ? 'Arquivo encontrado.' : 'Arquivo obrigatório não encontrado.',
  };
}

function checkSourcePatterns(check) {
  const missing = [];
  const matched = [];
  for (const relativePath of check.paths) {
    const fullPath = path.join(root, relativePath);
    if (!existsSync(fullPath)) {
      missing.push({ path: relativePath, pattern: '*', reason: 'arquivo ausente' });
      continue;
    }
    const source = readFileSync(fullPath, 'utf8');
    for (const pattern of check.patterns) {
      const regex = new RegExp(pattern, 'm');
      if (regex.test(source)) matched.push({ path: relativePath, pattern });
      else missing.push({ path: relativePath, pattern, reason: 'padrão ausente' });
    }
  }
  return {
    ...baseResult(check),
    kind: 'source-pattern',
    status: missing.length === 0 ? 'VALIDATED' : 'FAILED',
    matched,
    missing,
  };
}

async function checkHttp(check) {
  const baseUrl = process.env[check.baseUrlEnv];
  if (!baseUrl) {
    return {
      ...baseResult(check),
      kind: 'http',
      status: check.required === false ? 'NOT_EXECUTED' : 'FAILED',
      evidence: `Variável ${check.baseUrlEnv} não configurada.`,
    };
  }

  const url = new URL(check.path, baseUrl).toString();
  const startedAt = Date.now();
  try {
    const response = await fetch(url, {
      method: check.method ?? 'GET',
      headers: Object.fromEntries(
        Object.entries(check.headersFromEnv ?? {}).map(([header, envName]) => [header, process.env[envName] ?? ''])
      ),
      redirect: 'manual',
      signal: AbortSignal.timeout(check.timeoutMs ?? 15000),
    });
    const body = (await response.text()).slice(0, 4000);
    const expected = check.expectedStatus ?? [200];
    const passed = expected.includes(response.status);
    return {
      ...baseResult(check),
      kind: 'http',
      status: passed ? 'VALIDATED' : 'FAILED',
      url,
      httpStatus: response.status,
      expectedStatus: expected,
      durationMs: Date.now() - startedAt,
      body,
    };
  } catch (error) {
    return {
      ...baseResult(check),
      kind: 'http',
      status: 'FAILED',
      url,
      durationMs: Date.now() - startedAt,
      error: error.message,
    };
  }
}

function severityRank(value) {
  return { BLOCKER: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }[value] ?? 0;
}

function resolveModuleStatus(checks) {
  if (checks.some((item) => item.status === 'FAILED')) return 'FAILED';
  if (checks.some((item) => item.status === 'NOT_EXECUTED' && item.required)) return 'NOT_EXECUTED';
  return 'VALIDATED';
}

function buildReport(results) {
  const failed = results.filter((item) => item.status === 'FAILED');
  const notExecuted = results.filter((item) => item.status === 'NOT_EXECUTED');
  const requiredNotExecuted = notExecuted.filter((item) => item.required);
  const optionalNotExecuted = notExecuted.filter((item) => !item.required);
  const modules = {};

  for (const result of results) {
    modules[result.module] ??= [];
    modules[result.module].push(result);
  }

  const moduleStatus = Object.fromEntries(
    Object.entries(modules).map(([module, checks]) => [module, resolveModuleStatus(checks)])
  );

  const hasBlockingCondition = failed.length > 0 || requiredNotExecuted.length > 0;
  const verdict = hasBlockingCondition ? 'NOT_VALIDATED' : 'VALIDATED';
  const executionStatus = hasBlockingCondition ? 'BROKEN' : 'HEALTHY';
  const highestSeverity = [...failed, ...requiredNotExecuted]
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity))[0]?.severity ?? null;

  return {
    agent: 'AGENTE QA LM',
    generatedAt: now,
    executionStatus,
    verdict,
    highestSeverity,
    summary: {
      total: results.length,
      validated: results.filter((item) => item.status === 'VALIDATED').length,
      failed: failed.length,
      notExecuted: notExecuted.length,
      requiredNotExecuted: requiredNotExecuted.length,
      optionalNotExecuted: optionalNotExecuted.length,
    },
    modules: moduleStatus,
    problems: [...failed, ...requiredNotExecuted],
    notExecuted,
    checks: results,
  };
}

function reportMarkdown(report) {
  const icon = report.verdict === 'VALIDATED' ? '✅' : '❌';
  const lines = [
    '# Relatório — Agente QA LM',
    '',
    `Gerado em: ${report.generatedAt}`,
    '',
    `Saúde do executor: **${report.executionStatus}**`,
    '',
    '## 1. Resumo Executivo',
    '',
    `**${icon} ${report.verdict === 'VALIDATED' ? 'Ecossistema VALIDADO' : 'Ecossistema NÃO VALIDADO'}**`,
    '',
    '## 2. Checklist',
    '',
    ...Object.entries(report.modules).map(([module, status]) => `- ${module}: ${status === 'VALIDATED' ? '✅' : status === 'FAILED' ? '❌' : '⚪'} ${status}`),
    '',
    '## 3. Problemas encontrados',
    '',
  ];

  if (report.problems.length === 0) lines.push('Nenhum problema encontrado.', '');
  else {
    for (const problem of report.problems) {
      lines.push(`### ${problem.severity} — ${problem.id}`, '', `Módulo: ${problem.module}`, '', '```json', JSON.stringify(problem, null, 2), '```', '');
    }
  }

  lines.push(
    '## 4. Evidências',
    '',
    `- Testes executados: ${report.summary.total}`,
    `- Validados: ${report.summary.validated}`,
    `- Reprovados: ${report.summary.failed}`,
    `- Não executados: ${report.summary.notExecuted}`,
    `- Obrigatórios não executados: ${report.summary.requiredNotExecuted}`,
    `- Opcionais não executados: ${report.summary.optionalNotExecuted}`,
    '',
    '## 5. Veredito Final',
    '',
    report.verdict === 'VALIDATED' ? '✅ Pode considerar este fluxo validado.' : '❌ Não considerar este fluxo validado.',
    ''
  );
  return lines.join('\n');
}

async function main() {
  const config = loadConfig();
  const results = [];

  for (const check of config.checks) {
    if (check.kind === 'command') results.push(runCommand(check));
    else if (check.kind === 'file') results.push(checkRequiredFile(check));
    else if (check.kind === 'source-pattern') results.push(checkSourcePatterns(check));
    else if (check.kind === 'http') results.push(await checkHttp(check));
    else results.push({ ...baseResult(check), severity: 'BLOCKER', status: 'FAILED', evidence: `Tipo desconhecido: ${check.kind}` });
  }

  const report = buildReport(results);
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(path.join(outputDir, 'qa-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(path.join(outputDir, 'qa-report.md'), reportMarkdown(report));

  console.log(JSON.stringify({ executionStatus: report.executionStatus, verdict: report.verdict, summary: report.summary, outputDir: path.relative(root, outputDir) }, null, 2));
  process.exitCode = report.executionStatus === 'HEALTHY' ? 0 : 1;
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
