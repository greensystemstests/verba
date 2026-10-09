// Runs every test suite. Integration suites need a production build (`npm run build`)
// and TEST_DATABASE_URL pointing at a disposable PostgreSQL server (never production).
import {spawnSync} from 'node:child_process';
const suites=['scripts/i18n-check.mjs','tests/translation-checks.mjs','tests/workflows.mjs','tests/account-quote-workflows.mjs','tests/translation-workflows.mjs','tests/spec-workflows.mjs'];
if(!process.env.TEST_DATABASE_URL){console.error('Set TEST_DATABASE_URL to a disposable PostgreSQL server, e.g. postgresql://user@127.0.0.1:5432/postgres');process.exit(1);}
for(const suite of suites){console.log('\n▶ '+suite);const r=spawnSync(process.execPath,[suite],{stdio:'inherit'});if(r.status!==0){console.error('✗ '+suite+' failed');process.exit(r.status||1);}}
console.log('\nAll suites passed.');
