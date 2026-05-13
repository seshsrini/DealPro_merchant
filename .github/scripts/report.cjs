#!/usr/bin/env node
/* eslint-disable no-console */

// Tiny CLI used by the GitHub Actions workflow to POST status events back to
// the VedicJaalam dashboard. Signs every body with HMAC-SHA256 using the
// REPORT_SECRET shared with /api/dealpro-test-plan-results/auto-test/report.
//
// Usage:
//   node report.cjs run_started --githubRunId 123 --githubRunUrl ... --commitSha abc
//   node report.cjs flow_started --testId 1.1 --startedAt 2026-05-01T...
//   node report.cjs flow_finished --testId 1.1 --status pass --durationMs 4321 \
//                                 --screenshotUrls '["https://..."]' --notes "..."
//   node report.cjs run_finished --status success
//
// Required env: REPORT_URL, REPORT_SECRET, RUN_ID

const crypto = require('node:crypto');
const https = require('node:https');
const http = require('node:http');
const { URL } = require('node:url');

function parseArgs(argv) {
  const out = { _kind: argv[2] };
  for (let i = 3; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const value = argv[i + 1];
    out[key] = value;
    i++;
  }
  return out;
}

function buildBody(args) {
  const { _kind } = args;
  const base = { kind: _kind, runId: process.env.RUN_ID };
  if (_kind === 'run_started') {
    return {
      ...base,
      githubRunId: args.githubRunId || null,
      githubRunUrl: args.githubRunUrl || null,
      commitSha: args.commitSha || null,
    };
  }
  if (_kind === 'flow_started') {
    return {
      ...base,
      testId: args.testId,
      startedAt: args.startedAt || new Date().toISOString(),
    };
  }
  if (_kind === 'flow_finished') {
    let screenshots = [];
    if (args.screenshotUrls) {
      try { screenshots = JSON.parse(args.screenshotUrls); } catch { screenshots = []; }
    }
    return {
      ...base,
      testId: args.testId,
      status: args.status === 'pass' ? 'pass' : 'fail',
      durationMs: args.durationMs ? Number(args.durationMs) : null,
      notes: args.notes || null,
      screenshotUrls: screenshots,
    };
  }
  if (_kind === 'run_finished') {
    let totals = { total: 0, passed: 0, failed: 0 };
    if (args.totals) {
      try { totals = JSON.parse(args.totals); } catch {}
    }
    return {
      ...base,
      status: args.status === 'success' ? 'success' : 'failure',
      totals,
      notes: args.notes || null,
    };
  }
  throw new Error(`Unknown kind: ${_kind}`);
}

function postJson(urlStr, raw, headers) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const lib = url.protocol === 'http:' ? http : https;
    const req = lib.request(
      {
        method: 'POST',
        hostname: url.hostname,
        port: url.port || (url.protocol === 'http:' ? 80 : 443),
        path: url.pathname + url.search,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(raw),
          ...headers,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
      },
    );
    req.on('error', reject);
    req.write(raw);
    req.end();
  });
}

(async () => {
  const args = parseArgs(process.argv);
  if (!args._kind) { console.error('kind argument required'); process.exit(1); }
  const url = process.env.REPORT_URL;
  const secret = process.env.REPORT_SECRET;
  const runId = process.env.RUN_ID;
  if (!url || !secret || !runId) {
    console.error('REPORT_URL, REPORT_SECRET, RUN_ID env vars required');
    process.exit(1);
  }

  const body = buildBody(args);
  const raw = JSON.stringify(body);
  const sig = crypto.createHmac('sha256', secret).update(raw).digest('hex');

  try {
    const res = await postJson(url, raw, { 'x-auto-test-signature': sig });
    if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
      console.log(`[report] ${args._kind} OK (${res.statusCode})`);
    } else {
      console.error(`[report] ${args._kind} FAILED (${res.statusCode}): ${res.body}`);
      // Don't fail the build on report POST failure — the test result itself
      // matters more than the dashboard heartbeat.
    }
  } catch (err) {
    console.error(`[report] ${args._kind} threw: ${err.message}`);
  }
})();
