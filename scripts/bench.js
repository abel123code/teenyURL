import { performance } from "perf_hooks";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const CODE = '4yl4tEG'; // set this!
const N_WARM = Number(process.env.N_WARM ?? "1000");
const N_COLD = Number(process.env.N_COLD ?? "30");

if (!CODE) {
  console.error("Missing CODE env var. Example: CODE=aZ91kP3 node scripts/bench.js");
  process.exit(1);
}

async function resetCache() {
  const res = await fetch(`${BASE}/api/debug/cache/reset`, { method: "POST" });
  if (!res.ok) throw new Error(`Cache reset failed: ${res.status}`);
}

async function hitCode() {
  const t0 = performance.now();
  const res = await fetch(`${BASE}/api/${CODE}`, { redirect: "manual" }); // IMPORTANT: don't follow redirect
  const t1 = performance.now();

  // We expect 302 for valid links
  if (res.status !== 302 && res.status !== 404 && res.status !== 410) {
    throw new Error(`Unexpected status: ${res.status}`);
  }
  return t1 - t0;
}

function percentile(arr, p) {
  if (arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.floor((p / 100) * (sorted.length - 1));
  return sorted[idx];
}

function summarize(label, times) {
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  console.log(`\n${label}`);
  console.log(`n=${times.length}`);
  console.log(`avg=${avg.toFixed(2)}ms`);
  console.log(`p50=${percentile(times, 50).toFixed(2)}ms`);
  console.log(`p95=${percentile(times, 95).toFixed(2)}ms`);
  console.log(`p99=${percentile(times, 99).toFixed(2)}ms`);
}

async function run() {
  // -------- Cold benchmark: reset -> single request, repeated --------
  const coldTimes = [];
  for (let i = 0; i < N_COLD; i++) {
    await resetCache();
    const dt = await hitCode();
    coldTimes.push(dt);
  }
  summarize("COLD (cache cleared before each request; mostly DB path)", coldTimes);

  // -------- Warm benchmark: reset -> warm once -> many requests --------
  await resetCache();
  await hitCode(); // warm it (this one is cold-ish)
  const warmTimes = [];
  for (let i = 0; i < N_WARM; i++) {
    const dt = await hitCode();
    warmTimes.push(dt);
  }
  summarize("WARM (after warm-up; should be cache-hit path)", warmTimes);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
