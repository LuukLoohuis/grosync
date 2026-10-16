#!/usr/bin/env node
// Draait vitest-tests met node --test, omdat vitest 3 op Node 25 blijft hangen.
// esbuild bundelt elk testbestand (met de @/-paden uit tsconfig) en vervangt
// 'vitest' door een kleine shim: describe/it/expect op node:test en node:assert.
// vi.mock en vi.fn zitten er niet in; tests die die nodig hebben draaien hier niet.
//
//   node scripts/node-test.mjs src/lib/accountUpgrade.test.ts
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { build } from 'esbuild';

const SHIM = `
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
export { describe, it };
const matchers = (actual, negate) => {
  const check = (pass, message) => assert.ok(negate ? !pass : pass, (negate ? 'not: ' : '') + message);
  return {
    toBe: (expected) => (negate ? assert.notStrictEqual : assert.strictEqual)(actual, expected),
    toEqual: (expected) => (negate ? assert.notDeepStrictEqual : assert.deepStrictEqual)(actual, expected),
    toBeNull: () => check(actual === null, JSON.stringify(actual) + ' is null'),
    toContain: (item) => check(actual.includes(item), JSON.stringify(actual) + ' contains ' + JSON.stringify(item)),
    toMatch: (pattern) => check(new RegExp(pattern).test(actual), JSON.stringify(actual) + ' matches ' + pattern),
  };
};
export const expect = (actual) => ({ ...matchers(actual, false), not: matchers(actual, true) });
`;

const tests = process.argv.slice(2);
if (tests.length === 0) {
  console.error('Gebruik: node scripts/node-test.mjs <bestand.test.ts> …');
  process.exit(1);
}

const out = mkdtempSync(join(tmpdir(), 'node-test-'));
try {
  const outfiles = [];
  for (const test of tests) {
    const outfile = join(out, `${basename(test).replace(/\.tsx?$/, '')}.mjs`);
    await build({
      entryPoints: [test],
      outfile,
      bundle: true,
      platform: 'node',
      format: 'esm',
      logLevel: 'warning',
      plugins: [{
        name: 'vitest-shim',
        setup(b) {
          b.onResolve({ filter: /^vitest$/ }, () => ({ path: 'vitest', namespace: 'vitest-shim' }));
          b.onLoad({ filter: /.*/, namespace: 'vitest-shim' }, () => ({ contents: SHIM, loader: 'js' }));
        },
      }],
    });
    outfiles.push(outfile);
  }
  const { status } = spawnSync(process.execPath, ['--test', ...outfiles], { stdio: 'inherit' });
  process.exitCode = status ?? 1;
} finally {
  rmSync(out, { recursive: true, force: true });
}
