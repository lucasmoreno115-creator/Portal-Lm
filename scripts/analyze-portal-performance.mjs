#!/usr/bin/env node
import path from 'node:path';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {analyzePerformanceReport,analysisMarkdown} from './lib/portal-performance-analysis.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dir=path.join(root,'artifacts/performance');
const report=JSON.parse(await readFile(path.join(dir,'portal-performance-report.json'),'utf8'));
const analysis=analyzePerformanceReport(report);
await mkdir(dir,{recursive:true});
await writeFile(path.join(dir,'portal-performance-analysis.json'),JSON.stringify(analysis,null,2)+'\n');
await writeFile(path.join(dir,'portal-performance-analysis.md'),analysisMarkdown(analysis)+'\n');
console.log(`Análise ${analysis.status}: ${analysis.validity.runs} runs; nenhuma otimização autorizada.`);
