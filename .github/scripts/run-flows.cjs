#!/usr/bin/env node
/* eslint-disable no-console */

// Discovers every .yaml flow under tests/maestro/, runs them sequentially with
// `maestro test`, captures per-step screenshots, uploads them to Supabase
// Storage, and POSTs flow_started/flow_finished back to the VedicJaalam
// dashboard via report.cjs.
//
// Each flow's filename (without extension) is mapped to a test_id from the
// dealpro-test-plan.json catalogue. Convention:
//   tests/maestro/1.1-merchant-signup.yaml  →  test_id "1.1"
//
// Required env (in addition to those used by report.cjs):
//   • SUPABASE_URL
//   • SUPABASE_SERVICE_ROLE_KEY      (writes to the auto-test-screenshots bucket)
//   • SUPABASE_SCREENSHOT_BUCKET     (defaults to "auto-test-screenshots")

const { execSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const { URL } = require('node:url');

const FLOWS_DIR = path.join(process.cwd(), 'tests', 'maestro');
const ARTIFACTS_DIR = path.join(process.cwd(), 'maestro-artifacts');
const REPORT = path.join(process.cwd(), '.github', 'scripts', 'report.cjs');

function deriveTestId(filename) {
  // Convention: filename = "<test_id>__<slug>.yaml" (double underscore separates).
  // Examples:
  //   "M-AUTH-01__signup-happy-path.yaml"  → "M-AUTH-01"
  //   "M-AUTH-NEG-01__invalid-phone.yaml"  → "M-AUTH-NEG-01"
  // Falls back to the bare basename if no `__` separator is present.
  const base = path.basename(filename).replace(/\.ya?ml$/i, '');
  const idx = base.indexOf('__');
  return idx > 0 ? base.slice(0, idx) : base;
}

function runReport(kind, args) {
  const cliArgs = [REPORT, kind];
  for (const [k, v] of Object.entries(args)) {
    if (v === null || v === undefined) continue;
    cliArgs.push(`--${k}`, typeof v === 'string' ? v : JSON.stringify(v));
  }
  const r = spawnSync('node', cliArgs, { stdio: 'inherit' });
  if (r.status !== 0) console.error(`[run-flows] report ${kind} exited ${r.status}`);
}

async function uploadScreenshot(localPath, remoteName) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_SCREENSHOT_BUCKET || 'auto-test-screenshots';
  if (!url || !key) return null;

  const body = fs.readFileSync(localPath);
  const upload = new URL(`${url}/storage/v1/object/${bucket}/${remoteName}`);
  return new Promise((resolve) => {
    const req = https.request(
      {
        method: 'POST',
        hostname: upload.hostname,
        port: upload.port || 443,
        path: upload.pathname,
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'image/png',
          'Content-Length': body.length,
          'x-upsert': 'true',
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(`${url}/storage/v1/object/public/${bucket}/${remoteName}`);
          } else {
            console.error(`[run-flows] upload failed ${res.statusCode}: ${data}`);
            resolve(null);
          }
        });
      },
    );
    req.on('error', (err) => { console.error('[run-flows] upload err', err.message); resolve(null); });
    req.write(body);
    req.end();
  });
}

async function runOneFlow(filePath) {
  const filename = path.basename(filePath);
  const testId = deriveTestId(filename);
  const flowArtifactsDir = path.join(ARTIFACTS_DIR, testId);
  fs.mkdirSync(flowArtifactsDir, { recursive: true });

  runReport('flow_started', { testId, startedAt: new Date().toISOString() });

  const startedAt = Date.now();
  // Run Maestro with cwd = flowArtifactsDir so explicit `takeScreenshot`
  // commands in the flow write PNGs there (they default to cwd, NOT to
  // --debug-output). --debug-output still receives the UI hierarchy +
  // failure dumps. filePath is absolute so the cwd change is safe.
  const result = spawnSync(
    'maestro',
    ['test', '--debug-output', flowArtifactsDir, filePath],
    {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      cwd: flowArtifactsDir,
    },
  );
  const durationMs = Date.now() - startedAt;
  const status = result.status === 0 ? 'pass' : 'fail';

  // Collect screenshots from the flow artifacts dir. Includes both explicit
  // takeScreenshot output AND Maestro's auto-generated failure-debug
  // screenshots (which include unicode markers like ❌ in the filename —
  // sanitize before upload since Supabase Storage rejects non-ASCII keys).
  let screenshotUrls = [];
  try {
    const candidates = collectPngs(flowArtifactsDir);
    for (let i = 0; i < candidates.length && i < 20; i++) {
      const local = candidates[i];
      const safeName = path
        .basename(local)
        .replace(/[^A-Za-z0-9._-]/g, '_')
        .replace(/_+/g, '_');
      const remote = `${process.env.RUN_ID}/${testId}/${String(i + 1).padStart(2, '0')}-${safeName}`;
      const url = await uploadScreenshot(local, remote);
      if (url) screenshotUrls.push(url);
    }
  } catch (err) {
    console.error('[run-flows] screenshot collection failed:', err.message);
  }

  let notes = null;
  if (status === 'fail') {
    // Surface the tail of Maestro's stderr-ish summary file if present, else
    // a generic message — the workflow log link in the report has the full
    // detail.
    const summary = path.join(flowArtifactsDir, 'maestro.log');
    if (fs.existsSync(summary)) {
      const txt = fs.readFileSync(summary, 'utf8').slice(-2000);
      notes = txt;
    } else {
      notes = `Maestro flow exited with code ${result.status}`;
    }
  }

  runReport('flow_finished', {
    testId,
    status,
    durationMs,
    notes,
    screenshotUrls: JSON.stringify(screenshotUrls),
  });

  return { testId, status };
}

function collectPngs(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectPngs(full));
    else if (entry.name.toLowerCase().endsWith('.png')) out.push(full);
  }
  return out.sort();
}

(async () => {
  if (!fs.existsSync(FLOWS_DIR)) {
    console.error(`[run-flows] No flows dir at ${FLOWS_DIR}`);
    process.exit(0);
  }
  const flows = fs
    .readdirSync(FLOWS_DIR)
    .filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
    // Skip shared config / fixture files — only files prefixed with a real
    // test_id (containing '__') are flows. config.yaml is just env vars
    // re-used by every flow via ${...} interpolation.
    .filter((f) => f.includes('__'))
    .sort()
    .map((f) => path.join(FLOWS_DIR, f));

  if (flows.length === 0) {
    console.error('[run-flows] No .yaml flows found');
    process.exit(0);
  }

  let passed = 0;
  let failed = 0;
  for (const flow of flows) {
    try {
      const { status } = await runOneFlow(flow);
      if (status === 'pass') passed++; else failed++;
    } catch (err) {
      console.error(`[run-flows] ${flow} threw:`, err.message);
      failed++;
    }
  }

  // Make the totals visible to the run_finished step via env file.
  const totals = { total: flows.length, passed, failed };
  fs.appendFileSync(process.env.GITHUB_ENV || '/dev/null', `MAESTRO_TOTALS=${JSON.stringify(totals)}\n`);
  console.log(`[run-flows] done: ${JSON.stringify(totals)}`);

  // Non-zero exit if any flow failed, so the run_finished step reports failure.
  process.exit(failed > 0 ? 1 : 0);
})();
