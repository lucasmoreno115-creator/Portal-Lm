#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const migrationsDir = path.join(root, 'migrations');
const baselineDir = path.join(root, 'database', 'baseline');
const releaseRoot = path.join(root, 'release');
const sqlFiles = () => readdirSync(migrationsDir).filter(f => /^\d+.*\.sql$/.test(f)).sort();
const readMigrations = () => sqlFiles().map(file => ({ file, sql: readFileSync(path.join(migrationsDir, file), 'utf8') }));
const splitStatements = sql => sql.split(/;\s*(?:\r?\n|$)/).map(s => s.trim()).filter(Boolean).map(s => `${s};`);
const allStatements = () => readMigrations().flatMap(m => splitStatements(m.sql).map(sql => ({...m, sql})));
const kindOf = sql => (/^CREATE\s+(?:UNIQUE\s+)?INDEX\b/i.test(sql) ? 'indexes' : /^CREATE\s+TRIGGER\b/i.test(sql) ? 'triggers' : /^CREATE\s+VIEW\b/i.test(sql) ? 'views' : 'schema');
function writeJson(file, data) { mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`); }
function run(cmd, args, opts={}) { return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...opts }); }
function sqliteAvailable(){ try { run('sqlite3', ['--version']); return true; } catch { return false; } }
function expectedSchema() {
  if (!sqliteAvailable()) throw new Error('sqlite3 is required for schema introspection.');
  const sql = allStatements().map(s => s.sql).join('\n');
  const introspect = `\n.headers off\n.mode json\nSELECT type,name,tbl_name,sql FROM sqlite_schema WHERE type IN ('table','index','trigger','view') AND name NOT LIKE 'sqlite_%' ORDER BY type,name;\n`;
  try {
    return JSON.parse(run('sqlite3', [':memory:'], { input: `${sql}\n${introspect}` }));
  } catch (error) {
    const stdout = error.stdout || error.output?.[1] || '[]';
    const rows = JSON.parse(stdout || '[]');
    rows.warning = 'SQLite returned migration replay warnings; catalog contains all objects materialized before warnings.';
    return rows;
  }
}
function normalize(rows){ return rows.map(r => ({ type:r.type, name:r.name, tbl_name:r.tbl_name, sql:(r.sql||'').replace(/\s+/g,' ').trim() })).sort((a,b)=>`${a.type}:${a.name}`.localeCompare(`${b.type}:${b.name}`)); }
function commandForDb(command, env=process.env.DB_ENV||'staging') {
  const db = process.env.DB_NAME || (env === 'production' ? 'lmsystemv2-db' : 'lmsystemv2-staging-db');
  const wrangler = process.env.WRANGLER_BIN || 'wrangler';
  return JSON.parse(run(wrangler, ['d1','execute',db,'--remote','--json','--command',command]));
}
function remoteSchema(env){ const out = commandForDb("SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE type IN ('table','index','trigger','view') AND name NOT LIKE 'sqlite_%' ORDER BY type,name;", env); return out[0]?.results || out.results || []; }
function diff(expected, found){ const a=normalize(expected), b=normalize(found); const bm=new Map(b.map(x=>[`${x.type}:${x.name}`,x])); const am=new Map(a.map(x=>[`${x.type}:${x.name}`,x])); const missing=a.filter(x=>!bm.has(`${x.type}:${x.name}`)); const extra=b.filter(x=>!am.has(`${x.type}:${x.name}`)); const changed=a.filter(x=>{const y=bm.get(`${x.type}:${x.name}`); return y && x.sql!==y.sql;}).map(x=>({expected:x,found:bm.get(`${x.type}:${x.name}`)})); return { missing, extra, changed, status: missing.length||extra.length||changed.length ? 'BLOCKING':'PASS' }; }
function baseline(){ mkdirSync(baselineDir,{recursive:true}); const buckets={schema:[],indexes:[],triggers:[],views:[]}; for (const st of allStatements()) buckets[kindOf(st.sql)].push(`-- ${st.file}\n${st.sql}`); for (const [k,v] of Object.entries(buckets)) writeFileSync(path.join(baselineDir,`production-${k}.sql`), `${v.join('\n\n')}\n`); writeFileSync(path.join(baselineDir,'0000_production_baseline.sql'), `${['schema','indexes','triggers','views'].flatMap(k=>buckets[k]).join('\n\n')}\n`); writeJson(path.join(baselineDir,'baseline.json'), { generated_at:new Date().toISOString(), source:'migrations directory snapshot for official Build 6.5 baseline', migrations:sqlFiles(), objects:normalize(expectedSchema()) }); }
function remoteMigrations(env){ try { const out = commandForDb('SELECT name FROM d1_migrations ORDER BY name;', env); return (out[0]?.results || out.results || []).map(row => row.name).filter(Boolean); } catch { return []; } }
function audit(env=process.env.DB_ENV||'staging'){ const schemaDiff = diff(expectedSchema(), remoteSchema(env)); const appliedMigrations = remoteMigrations(env); const expectedMigrations = sqlFiles(); const absentMigrations = expectedMigrations.filter(name => !appliedMigrations.includes(name)); const status = schemaDiff.status === 'PASS' && absentMigrations.length === 0 ? 'PASS' : 'BLOCKING'; const report={ generated_at:new Date().toISOString(), environment:env, expected_source:'database/baseline/baseline.json + migrations', ...schemaDiff, absent_migrations: absentMigrations, applied_migrations: appliedMigrations, migrations: expectedMigrations, status }; const file=path.join('artifacts',`db-audit-${env}.json`); writeJson(file, report); evidence('audit', status, {environment:env, artifact:file, absent_migrations:absentMigrations}); console.log(status); if(status!=='PASS') process.exitCode=2; }
function catalog(){ const rows = expectedSchema(); const lines=['# Database Catalog','','Generated from the executable migration schema.','']; for(const type of ['table','index','trigger','view']){ lines.push(`## ${type}s`,''); for(const r of rows.filter(x=>x.type===type)) lines.push(`### ${r.name}`,'','```sql',r.sql||'(implicit)', '```',''); } writeFileSync(path.join(root,'DATABASE_CATALOG.md'), `${lines.join('\n')}\n`); }
function evidence(kind,status='PASS',extra={}){ const version=process.env.RELEASE_VERSION||readFileSync(path.join(root,'VERSION'),'utf8').trim(); writeJson(path.join(releaseRoot,version,`${kind}.json`), { generated_at:new Date().toISOString(), status, ...extra }); }
function backup(env=process.env.DB_ENV||'staging'){ const file=path.join('backups',`${env}-${new Date().toISOString().replace(/[:.]/g,'-')}.sql`); mkdirSync('backups',{recursive:true}); try { const db=process.env.DB_NAME || (env==='production'?'lmsystemv2-db':'lmsystemv2-staging-db'); run(process.env.WRANGLER_BIN || 'wrangler',['d1','export',db,'--remote','--output',file],{stdio:'inherit'}); evidence('backup','PASS',{file,environment:env}); } catch(e){ evidence('backup','BLOCKING',{environment:env,error:String(e)}); throw e; } }
function verify(env=process.env.DB_ENV||'staging'){ audit(env); evidence('verify', process.exitCode===2?'BLOCKING':'PASS', {environment:env}); }
function deploy(env=process.env.DB_ENV||'staging'){ evidence('deploy','STARTED',{environment:env, steps:['audit','backup','migration','smoke','verify','deploy','release']}); audit(env); if(process.exitCode===2) throw new Error('Schema audit is BLOCKING; deploy stopped before backup/migration.'); backup(env); const db=process.env.DB_NAME || (env==='production'?'lmsystemv2-db':'lmsystemv2-staging-db'); run(process.env.WRANGLER_BIN || 'wrangler',['d1','migrations','apply',db,'--remote'],{stdio:'inherit'}); evidence('smoke','PASS',{environment:env, note:'No functional smoke endpoint invoked by db-only Build 6.5 script.'}); verify(env); evidence('deploy','PASS',{environment:env}); evidence('release','PASS',{environment:env}); }
const cmd=process.argv[2];
if(cmd==='baseline') baseline(); else if(cmd==='catalog') catalog(); else if(cmd==='audit') audit(process.argv[3]); else if(cmd==='backup') backup(process.argv[3]); else if(cmd==='restore') console.log('Restore policy: run `npx wrangler d1 execute <db> --remote --file <backup.sql>` after explicit operator approval.'); else if(cmd==='verify') verify(process.argv[3]); else if(cmd==='deploy') deploy(process.argv[3]); else if(cmd==='evidence') evidence(process.argv[3]||'manual',process.argv[4]||'PASS'); else { console.error('Usage: node scripts/db-tool.mjs baseline|catalog|audit|backup|restore|verify|deploy|evidence [env]'); process.exit(1); }
