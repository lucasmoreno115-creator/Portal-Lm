#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(readFileSync(path.join(root, 'qa', 'qa-agent.config.json'), 'utf8'));
const manifest = JSON.parse(readFileSync(path.join(root, 'qa', 'coverage-manifest.json'), 'utf8'));
const outputDir = path.join(root, 'artifacts', 'qa-lm');
const failures = [];
const evidence = [];
const checkIds = new Set(config.checks.map((check) => check.id));
const requirementIds = new Set();

for (const module of manifest.modules) {
  if (!module.name || !Array.isArray(module.requirements) || module.requirements.length === 0) {
    failures.push({ severity:'BLOCKER', module:module.name || 'UNKNOWN', problem:'Módulo sem requisitos de cobertura.' });
    continue;
  }

  for (const requirement of module.requirements) {
    if (requirementIds.has(requirement.id)) {
      failures.push({ severity:'BLOCKER', module:module.name, requirement:requirement.id, problem:'Identificador de requisito duplicado.' });
      continue;
    }
    requirementIds.add(requirement.id);

    const missingChecks = (requirement.checks || []).filter((id) => !checkIds.has(id));
    if (!requirement.description || !Array.isArray(requirement.checks) || requirement.checks.length === 0) {
      failures.push({ severity:'BLOCKER', module:module.name, requirement:requirement.id, problem:'Requisito sem descrição ou sem checks associados.' });
    } else if (missingChecks.length > 0) {
      failures.push({ severity:'BLOCKER', module:module.name, requirement:requirement.id, problem:'Check referenciado não existe na configuração.', missingChecks });
    } else {
      evidence.push({ module:module.name, requirement:requirement.id, checks:requirement.checks, live:Boolean(requirement.live) });
    }
  }
}

const mandatoryModules = [
  'Banco','API','Workspace','Student Record','Planejamento Alimentar','Portal do Aluno',
  'Feedback Semanal','Pendências','Follow-up','Compatibilidade Premium × Projeto LM'
];
const manifestModules = new Set(manifest.modules.map((module) => module.name));
for (const module of mandatoryModules) {
  if (!manifestModules.has(module)) failures.push({ severity:'BLOCKER', module, problem:'Módulo obrigatório ausente do manifesto.' });
}

const coverage = manifest.modules.map((module) => {
  const requirements = module.requirements || [];
  const covered = requirements.filter((requirement) =>
    Array.isArray(requirement.checks) && requirement.checks.length > 0 && requirement.checks.every((id) => checkIds.has(id))
  ).length;
  return {
    module: module.name,
    requirements: requirements.length,
    covered,
    coveragePercent: requirements.length === 0 ? 0 : Math.round((covered / requirements.length) * 100),
    liveRequirements: requirements.filter((requirement) => requirement.live).length,
  };
});

const report = {
  sprint:'QA 6',
  product:manifest.product,
  generatedAt:new Date().toISOString(),
  status:failures.length === 0 ? 'VALIDATED' : 'NOT_VALIDATED',
  summary:{ modules:coverage.length, requirements:requirementIds.size, failures:failures.length },
  coverage,
  failures,
  evidence,
};

mkdirSync(outputDir, { recursive:true });
writeFileSync(path.join(outputDir, 'coverage-report.json'), `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(path.join(outputDir, 'coverage-report.md'), [
  '# Matriz de Cobertura — Agente QA LM',
  '',
  `Produto: **${report.product}**`,
  '',
  `Status: **${report.status}**`,
  '',
  '| Módulo | Requisitos | Cobertos | Cobertura | Live |',
  '|---|---:|---:|---:|---:|',
  ...coverage.map((item) => `| ${item.module} | ${item.requirements} | ${item.covered} | ${item.coveragePercent}% | ${item.liveRequirements} |`),
  '',
  failures.length ? '## Problemas\n\n```json\n' + JSON.stringify(failures, null, 2) + '\n```' : '## Problemas\n\nNenhum problema de cobertura encontrado.',
  '',
].join('\n'));

console.log(JSON.stringify(report, null, 2));
process.exitCode = failures.length === 0 ? 0 : 1;
