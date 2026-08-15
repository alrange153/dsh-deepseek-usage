/**
 * dsh-deepseek-usage — host half.
 *
 * A dual-face dsh plugin that exposes DeepSeek API usage data to the web GUI:
 *
 *  - `GET /deepseek-usage/api/state`     — configuration / capability probe.
 *  - `GET /deepseek-usage/api/balance`   — live balance from the official
 *                                          api.deepseek.com/user/balance endpoint
 *                                          (bearer = the DEEPSEEK_API_KEY credential).
 *  - `GET /deepseek-usage/api/overview?from&to&bucket&source` — aggregated usage:
 *                                          requests, tokens (input/cache/output),
 *                                          cost, per-model breakdown, time series and
 *                                          deltas vs the previous equal-length window.
 *
 * Usage is folded from DSH's own persisted session logs (`ctx.sessionPersistence`):
 * every completed LLM call is persisted as an `assistant/message` event carrying the
 * provider-reported usage buckets and model route, so requests and tokens are exact.
 * Cost is derived from a small pricing table (per-model ¥/1M tokens) and is flagged as
 * an estimate. When a platform session token is configured (`DEEPSEEK_PLATFORM_TOKEN`
 * credential) the plugin instead prefers the private platform usage endpoints
 * (`platform.deepseek.com/api/v0/usage/amount|cost?month=&year=`), which report the
 * authoritative request/token/cost figures for the whole account.
 */
import { credentialRef } from '@deepseek-ai/dsh-credentials';

// ---------------------------------------------------------------------------
// Pricing (¥ per 1M tokens). DeepSeek charges cache-hit input, cache-miss
// input and output separately; reasoning tokens bill at the output rate and
// are a subset of output, so they are never added on top.
// ---------------------------------------------------------------------------
const DEFAULT_PRICING = {
  fallback: { input: 2, cacheHit: 0.5, output: 8 },
  models: {
    'deepseek-chat': { input: 2, cacheHit: 0.5, output: 8 },
    'deepseek-reasoner': { input: 4, cacheHit: 1, output: 16 },
    'deepseek-v3': { input: 2, cacheHit: 0.5, output: 8 },
    'deepseek-r1': { input: 4, cacheHit: 1, output: 16 },
  },
};

const BALANCE_URL = 'https://api.deepseek.com/user/balance';
const PLATFORM_USAGE_AMOUNT_URL = 'https://platform.deepseek.com/api/v0/usage/amount';
const PLATFORM_USAGE_COST_URL = 'https://platform.deepseek.com/api/v0/usage/cost';
const BALANCE_CACHE_MS = 30_000;
const OVERVIEW_CACHE_MS = 8_000;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
function mergePricing(configured) {
  const base = {
    fallback: { ...DEFAULT_PRICING.fallback, ...configured?.fallback },
    models: { ...DEFAULT_PRICING.models },
  };
  if (configured?.models) {
    for (const [model, rate] of Object.entries(configured.models)) {
      base.models[model] = { ...base.fallback, ...rate };
    }
  }
  return base;
}

function modelPricing(pricing, model) {
  return pricing.models[model] ?? pricing.fallback;
}

/** Cost in currency units for one request's usage buckets. */
function costOf(rate, usage) {
  const input = usage.input ?? 0;
  const cacheRead = usage.cacheRead ?? 0;
  const output = usage.output ?? 0;
  return (input * rate.input + cacheRead * rate.cacheHit + output * rate.output) / 1e6;
}

function readBodyJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      try {
        resolve(chunks.length === 0 ? {} : JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(body);
}

function dayKeyLocal(ms) {
  const d = new Date(ms);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Prompt-side cache hit rate in percent (one decimal), or null without prompt tokens. */
function cacheHitRateOf(input, cacheRead) {
  const prompt = input + cacheRead;
  if (prompt <= 0) return null;
  return Math.round((cacheRead / prompt) * 1000) / 10;
}

function hourKeyLocal(ms) {
  const d = new Date(ms);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}T${hh}:00`;
}

function bucketKeyLocal(ms, bucket) {
  return bucket === 'hour' ? hourKeyLocal(ms) : dayKeyLocal(ms);
}

function bucketLabel(key, bucket) {
  if (bucket === 'hour') {
    const [, rest] = key.split('T');
    const [hh] = rest.split(':');
    return `${key.slice(5, 10)} ${hh}:00`;
  }
  return key.slice(5);
}

/** Iterate {year, month} pairs covering [fromMs, toMs] inclusive. */
function* monthsInRange(fromMs, toMs) {
  const cursor = new Date(fromMs);
  cursor.setDate(1);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(toMs);
  while (cursor.getTime() <= end.getTime()) {
    yield { year: cursor.getFullYear(), month: cursor.getMonth() + 1 };
    cursor.setMonth(cursor.getMonth() + 1);
  }
}

function monthDate(ms) {
  const d = new Date(ms);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

/** Parse "YYYY-MM-DD" as UTC midnight and return the epoch ms. */
function platformDateMs(dateStr) {
  return Date.parse(`${dateStr}T00:00:00Z`);
}

// ---------------------------------------------------------------------------
// Credential helpers
// ---------------------------------------------------------------------------
async function resolveSecret(ctx, envName) {
  if (!envName) return undefined;
  try {
    const hit = await ctx.credentials.resolve(credentialRef(envName));
    return hit?.value;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Balance
// ---------------------------------------------------------------------------
async function fetchBalance(apiKey) {
  const response = await fetch(BALANCE_URL, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (response.status !== 200) {
    throw new Error(`balance endpoint returned HTTP ${response.status}`);
  }
  const payload = await response.json();
  const infos = Array.isArray(payload?.balance_infos) ? payload.balance_infos : [];
  if (infos.length === 0) {
    return {
      available: payload.is_available === true,
      currency: 'CNY',
      total: 0,
      granted: 0,
      toppedUp: 0,
    };
  }
  const pick = infos.find((b) => b.currency === 'USD' && Number(b.total_balance) > 0)
    ?? infos.find((b) => Number(b.total_balance) > 0)
    ?? infos.find((b) => b.currency === 'USD')
    ?? infos[0];
  return {
    available: payload.is_available === true,
    currency: pick.currency,
    total: Number(pick.total_balance) || 0,
    granted: Number(pick.granted_balance) || 0,
    toppedUp: Number(pick.topped_up_balance) || 0,
  };
}

// ---------------------------------------------------------------------------
// Local usage fold: DSH session logs are the single source of truth. Every
// completed provider call persists an `assistant/message` event whose `data`
// carries `usage` (inputTokens / cacheReadTokens / outputTokens /
// reasoningTokens) and `message.source.{provider, model}`.
// ---------------------------------------------------------------------------
function foldLocalSession(events, pricing, from, to) {
  const requests = [];
  for (const event of events) {
    if (event?.type !== 'assistant/message') continue;
    const data = event.data;
    const usage = data?.usage;
    if (!usage) continue;
    const ts = event.time;
    if (!Number.isFinite(ts) || ts < from || ts > to) continue;
    const source = data.message?.source;
    const model = typeof source?.model === 'string'
      ? source.model
      : (typeof data.model === 'string' ? data.model : 'unknown');
    const record = {
      ts,
      model,
      input: usage.inputTokens ?? 0,
      cacheRead: usage.cacheReadTokens ?? 0,
      output: usage.outputTokens ?? 0,
      reasoning: usage.reasoningTokens ?? 0,
    };
    record.cost = costOf(modelPricing(pricing, model), record);
    requests.push(record);
  }
  return requests;
}

async function collectLocalRequests(ctx, pricing, from, to) {
  const persistence = ctx.get('sessionPersistence');
  if (!persistence) throw new Error('sessionPersistence service unavailable');
  const headers = await persistence.list();
  const all = [];
  for (const header of headers) {
    // A session created after the window end cannot contain in-window events.
    if (header.createdAt > to) continue;
    let events;
    try {
      ({ events } = await persistence.readFrom(header.id, 0));
    } catch {
      continue; // corrupt/unsupported log — do not fail the whole dashboard
    }
    for (const record of foldLocalSession(events, pricing, from, to)) all.push(record);
  }
  return all;
}

// ---------------------------------------------------------------------------
// Platform mode: private dashboard endpoints. Best effort — the schema is
// undocumented and may change; any failure falls back to the local fold.
// ---------------------------------------------------------------------------
function normalizePlatformNumber(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function isPlatformAuthError(payload) {
  return payload?.code === 40002 || payload?.code === 40003
    || payload?.biz_code === 40002 || payload?.biz_code === 40003;
}

function parsePlatformPayload(amountPayload, costPayload, currency) {
  const amountBiz = amountPayload?.data?.biz_data;
  const costBiz = Array.isArray(costPayload?.data?.biz_data) ? costPayload.data.biz_data[0] : undefined;
  if (!amountBiz) throw new Error('platform usage: missing amount biz_data');
  if (isPlatformAuthError(amountPayload?.data)) throw new Error('platform usage: authentication failed');
  if (isPlatformAuthError(costPayload?.data)) throw new Error('platform usage: authentication failed');

  const resolvedCurrency = costBiz?.currency ?? currency ?? 'CNY';

  /** day rows: { date, requests, cacheHit, cacheMiss, output, cost, byModel } */
  const rows = new Map();
  const mergeUsage = (date, model, type, amount) => {
    let row = rows.get(date);
    if (!row) {
      row = { date, requests: 0, cacheHit: 0, cacheMiss: 0, output: 0, cost: 0, byModel: new Map() };
      rows.set(date, row);
    }
    let modelRow = row.byModel.get(model);
    if (!modelRow) {
      modelRow = { requests: 0, cacheHit: 0, cacheMiss: 0, output: 0, cost: 0 };
      row.byModel.set(model, modelRow);
    }
    const typeUpper = String(type ?? '').toUpperCase();
    if (typeUpper === 'REQUEST') {
      row.requests += amount;
      modelRow.requests += amount;
    } else if (typeUpper === 'PROMPT_CACHE_HIT_TOKEN') {
      row.cacheHit += amount;
      modelRow.cacheHit += amount;
    } else if (typeUpper === 'PROMPT_CACHE_MISS_TOKEN') {
      row.cacheMiss += amount;
      modelRow.cacheMiss += amount;
    } else if (typeUpper === 'RESPONSE_TOKEN') {
      row.output += amount;
      modelRow.output += amount;
    }
  };

  const consumeUsageList = (usage, date, model, isCost) => {
    if (!Array.isArray(usage)) return;
    for (const item of usage) {
      const amount = normalizePlatformNumber(item?.amount);
      if (isCost) {
        // cost rows: same type vocabulary, amounts are currency units.
        const typeUpper = String(item?.type ?? '').toUpperCase();
        const row = rows.get(date);
        const modelRow = row?.byModel.get(model);
        if (!row || !modelRow) continue;
        if (typeUpper === 'PROMPT_CACHE_HIT_TOKEN') {
          row.cost += amount;
          modelRow.cost += amount;
        } else if (typeUpper === 'PROMPT_CACHE_MISS_TOKEN') {
          row.cost += amount;
          modelRow.cost += amount;
        } else if (typeUpper === 'RESPONSE_TOKEN') {
          row.cost += amount;
          modelRow.cost += amount;
        }
      } else {
        mergeUsage(date, model, item?.type, amount);
      }
    }
  };

  const consumeDayData = (day, isCost) => {
    const date = day?.date;
    if (typeof date !== 'string') return;
    const data = Array.isArray(day?.data) ? day.data : [];
    for (const modelEntry of data) {
      const model = modelEntry?.model ?? 'unknown';
      consumeUsageList(modelEntry?.usage, date, model, isCost);
    }
  };

  // amount: biz_data.total[{model, usage}], biz_data.days[{date, data}]
  const totals = Array.isArray(amountBiz.total) ? amountBiz.total : [];
  for (const entry of totals) {
    const model = entry?.model ?? 'unknown';
    consumeUsageList(entry?.usage, 'TOTAL', model, false);
  }
  for (const day of Array.isArray(amountBiz.days) ? amountBiz.days : []) consumeDayData(day, false);

  // cost: biz_data[0].total / .days with the same shape; amounts are cost.
  const costTotals = Array.isArray(costBiz?.total) ? costBiz.total : [];
  for (const entry of costTotals) {
    const model = entry?.model ?? 'unknown';
    consumeUsageList(entry?.usage, 'TOTAL', model, true);
  }
  for (const day of Array.isArray(costBiz?.days) ? costBiz.days : []) consumeDayData(day, true);

  return { currency: resolvedCurrency, rows, totals: rows.get('TOTAL') };
}

async function fetchPlatformMonth(token, year, month) {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  };
  const [amountResponse, costResponse] = await Promise.all([
    fetch(`${PLATFORM_USAGE_AMOUNT_URL}?month=${month}&year=${year}`, {
      headers,
      signal: AbortSignal.timeout(15_000),
    }),
    fetch(`${PLATFORM_USAGE_COST_URL}?month=${month}&year=${year}`, {
      headers,
      signal: AbortSignal.timeout(15_000),
    }),
  ]);
  if (amountResponse.status !== 200 || costResponse.status !== 200) {
    throw new Error(`platform usage returned HTTP ${amountResponse.status}/${costResponse.status}`);
  }
  const amountPayload = await amountResponse.json();
  const costPayload = await costResponse.json();
  return parsePlatformPayload(amountPayload, costPayload);
}

// ---------------------------------------------------------------------------
// Aggregation into the wire overview shape
// ---------------------------------------------------------------------------
function aggregate(records, from, to, bucket, pricing) {
  const totals = { requests: 0, cost: 0, input: 0, cacheRead: 0, output: 0, reasoning: 0, tokens: 0 };
  const perModel = new Map();
  const buckets = new Map();

  const touchModel = (model) => {
    let m = perModel.get(model);
    if (!m) {
      m = { model, requests: 0, cost: 0, input: 0, cacheRead: 0, output: 0, reasoning: 0, tokens: 0 };
      perModel.set(model, m);
    }
    return m;
  };

  const note = (bucketKey, record) => {
    let b = buckets.get(bucketKey);
    if (!b) {
      b = { key: bucketKey, ts: 0, requests: 0, cost: 0, tokens: 0 };
      buckets.set(bucketKey, b);
    }
    b.requests += 1;
    b.cost += record.cost;
    b.tokens += record.input + record.cacheRead + record.output;
  };

  for (const record of records) {
    totals.requests += 1;
    totals.cost += record.cost;
    totals.input += record.input;
    totals.cacheRead += record.cacheRead;
    totals.output += record.output;
    totals.reasoning += record.reasoning;
    totals.tokens += record.input + record.cacheRead + record.output;

    const m = touchModel(record.model);
    m.requests += 1;
    m.cost += record.cost;
    m.input += record.input;
    m.cacheRead += record.cacheRead;
    m.output += record.output;
    m.reasoning += record.reasoning;
    m.tokens += record.input + record.cacheRead + record.output;

    note(bucketKeyLocal(record.ts, bucket), record);
  }

  const series = [...buckets.values()]
    .map((b) => ({ ...b, ts: bucketTs(b.key, bucket) }))
    .sort((a, b) => a.ts - b.ts);
  if (series.length === 0 && from && to) {
    // Always emit at least one point so the chart has an x-axis.
    const anchor = from;
    const key = bucketKeyLocal(anchor, bucket);
    series.push({ key, ts: bucketTs(key, bucket), requests: 0, cost: 0, tokens: 0 });
  }

  return {
    totals: {
      requests: totals.requests,
      cost: totals.cost,
      input: totals.input,
      cacheRead: totals.cacheRead,
      output: totals.output,
      reasoning: totals.reasoning,
      tokens: totals.tokens,
    },
    perModel: [...perModel.values()].sort((a, b) => b.cost - a.cost),
    series,
  };
}

function bucketTs(key, bucket) {
  if (bucket === 'hour') {
    const d = new Date(`${key.slice(0, 10)}T${key.slice(11, 13)}:00:00`);
    return d.getTime();
  }
  const d = new Date(`${key}T00:00:00`);
  return d.getTime();
}

function deltas(previous, current) {
  const pct = (prev, cur) => {
    if (prev === 0) return cur === 0 ? 0 : null; // null = undefined baseline
    return ((cur - prev) / prev) * 100;
  };
  return {
    requests: { previous: previous.requests, value: current.requests - previous.requests, pct: pct(previous.requests, current.requests) },
    cost: { previous: previous.cost, value: current.cost - previous.cost, pct: pct(previous.cost, current.cost) },
    tokens: { previous: previous.tokens, value: current.tokens - previous.tokens, pct: pct(previous.tokens, current.tokens) },
  };
}

// ---------------------------------------------------------------------------
// Overview assembly (local source)
// ---------------------------------------------------------------------------
async function buildLocalOverview(ctx, pricing, from, to, bucket) {
  const records = await collectLocalRequests(ctx, pricing, from, to);
  const current = aggregate(records, from, to, bucket, pricing);

  const windowLen = to - from;
  const prevFrom = from - windowLen;
  const prevTo = from;
  const prevRecords = await collectLocalRequests(ctx, pricing, prevFrom, prevTo);
  const previous = aggregate(prevRecords, prevFrom, prevTo, bucket, pricing);

  return {
    source: 'local',
    window: { from, to },
    totals: current.totals,
    perModel: current.perModel,
    series: current.series,
    deltas: deltas(previous.totals, current.totals),
    previous: previous.totals,
  };
}

// ---------------------------------------------------------------------------
// Calendar aggregation: per local day, per model, plus all-time totals. Feeds
// the month heatmap, the recent-days list, and the day drill-down.
// ---------------------------------------------------------------------------
function aggregateCalendar(records) {
  const total = { requests: 0, tokens: 0, cost: 0 };
  const days = new Map();
  for (const record of records) {
    total.requests += 1;
    total.tokens += record.input + record.cacheRead + record.output;
    total.cost += record.cost;
    const day = dayKeyLocal(record.ts);
    let entry = days.get(day);
    if (!entry) {
      entry = { date: day, requests: 0, tokens: 0, input: 0, output: 0, cacheRead: 0, cost: 0, models: new Map() };
      days.set(day, entry);
    }
    entry.requests += 1;
    entry.tokens += record.input + record.cacheRead + record.output;
    entry.input += record.input;
    entry.output += record.output;
    entry.cacheRead += record.cacheRead;
    entry.cost += record.cost;
    let modelEntry = entry.models.get(record.model);
    if (!modelEntry) {
      modelEntry = { model: record.model, requests: 0, tokens: 0, input: 0, output: 0, cacheRead: 0 };
      entry.models.set(record.model, modelEntry);
    }
    modelEntry.requests += 1;
    modelEntry.tokens += record.input + record.cacheRead + record.output;
    modelEntry.input += record.input;
    modelEntry.output += record.output;
    modelEntry.cacheRead += record.cacheRead;
  }
  const dayRows = [...days.values()]
    .map((entry) => ({
      date: entry.date,
      requests: entry.requests,
      tokens: entry.tokens,
      input: entry.input,
      output: entry.output,
      cacheRead: entry.cacheRead,
      cacheHitRate: cacheHitRateOf(entry.input, entry.cacheRead),
      cost: entry.cost,
      models: [...entry.models.values()]
        .map((m) => ({
          model: m.model,
          requests: m.requests,
          tokens: m.tokens,
          input: m.input,
          output: m.output,
          cacheRead: m.cacheRead,
          cacheHitRate: cacheHitRateOf(m.input, m.cacheRead),
        }))
        .sort((a, b) => b.tokens - a.tokens),
    }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  return { total, days: dayRows };
}

// ---------------------------------------------------------------------------
// Overview assembly (platform source) — daily granularity
// ---------------------------------------------------------------------------
async function buildPlatformOverview(ctx, token, from, to, currency) {
  const dayFrom = dayKeyLocal(from);
  const dayTo = dayKeyLocal(to);
  const days = new Map();
  let resolvedCurrency = currency;

  // Fetch every month intersecting [prev window start, to] so deltas work.
  // The platform endpoints are monthly; clamp the scan horizon so an "all
  // time" window cannot fan out over hundreds of months.
  const MS_DAY = 24 * 3600 * 1000;
  const windowLen = to - from;
  const prevFrom = from - windowLen;
  const scanStart = Math.max(prevFrom, Date.now() - 36 * 30 * MS_DAY);
  for (const { year, month } of monthsInRange(scanStart, to)) {
    let parsed;
    try {
      parsed = await fetchPlatformMonth(token, year, month);
    } catch (error) {
      throw error;
    }
    resolvedCurrency = parsed.currency ?? resolvedCurrency;
    for (const [date, row] of parsed.rows) {
      if (date === 'TOTAL') continue;
      const existing = days.get(date);
      if (existing) {
        existing.requests += row.requests;
        existing.cacheHit += row.cacheHit;
        existing.cacheMiss += row.cacheMiss;
        existing.output += row.output;
        existing.cost += row.cost;
        for (const [model, mr] of row.byModel) {
          const em = existing.byModel.get(model) ?? { requests: 0, cacheHit: 0, cacheMiss: 0, output: 0, cost: 0 };
          em.requests += mr.requests;
          em.cacheHit += mr.cacheHit;
          em.cacheMiss += mr.cacheMiss;
          em.output += mr.output;
          em.cost += mr.cost;
          existing.byModel.set(model, em);
        }
      } else {
        days.set(date, { date, requests: row.requests, cacheHit: row.cacheHit, cacheMiss: row.cacheMiss, output: row.output, cost: row.cost, byModel: row.byModel });
      }
    }
  }

  const inWindow = (date) => date >= dayFrom && date <= dayTo;
  const inPrev = (date) => date >= dayKeyLocal(prevFrom) && date < dayFrom;

  const aggregateDays = (predicate) => {
    const totals = { requests: 0, cost: 0, input: 0, cacheRead: 0, output: 0, reasoning: 0, tokens: 0 };
    const perModel = new Map();
    const rows = [];
    for (const [date, row] of days) {
      if (!predicate(date)) continue;
      totals.requests += row.requests;
      totals.cost += row.cost;
      totals.input += row.cacheMiss;
      totals.cacheRead += row.cacheHit;
      totals.output += row.output;
      totals.tokens += row.cacheHit + row.cacheMiss + row.output;
      rows.push({ key: date, ts: platformDateMs(date), requests: row.requests, cost: row.cost, tokens: row.cacheHit + row.cacheMiss + row.output });
      for (const [model, mr] of row.byModel) {
        const m = perModel.get(model) ?? { model, requests: 0, cost: 0, input: 0, cacheRead: 0, output: 0, reasoning: 0, tokens: 0 };
        m.requests += mr.requests;
        m.cost += mr.cost;
        m.input += mr.cacheMiss;
        m.cacheRead += mr.cacheHit;
        m.output += mr.output;
        m.tokens += mr.cacheHit + mr.cacheMiss + mr.output;
        perModel.set(model, m);
      }
    }
    rows.sort((a, b) => a.ts - b.ts);
    return {
      totals,
      perModel: [...perModel.values()].sort((a, b) => b.cost - a.cost),
      series: rows,
    };
  };

  const current = aggregateDays(inWindow);
  const previous = aggregateDays(inPrev);

  return {
    source: 'platform',
    currency: resolvedCurrency,
    window: { from, to },
    totals: current.totals,
    perModel: current.perModel,
    series: current.series,
    deltas: deltas(previous.totals, current.totals),
    previous: previous.totals,
  };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
function parseRoute(req, prefix) {
  const url = new URL(req.url ?? '/', 'http://dsh.local');
  const pathname = decodeURIComponent(url.pathname);
  const rest = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname;
  return { path: rest || '/', query: url.searchParams };
}

export const inject = ['webServer', 'credentials'];

export function apply(ctx, config = {}) {
  const pricing = mergePricing(config.pricing);
  const apiKeyEnv = config.apiKeyEnv ?? 'DEEPSEEK_API_KEY';
  const platformTokenEnv = config.platformTokenEnv ?? 'DEEPSEEK_PLATFORM_TOKEN';
  const currency = config.currency ?? 'CNY';

  let balanceCache = { at: 0, promise: null };
  let overviewCache = { at: 0, key: '', payload: null };
  let calendarCache = { at: 0, payload: null };
  const CALENDAR_CACHE_MS = 15_000;

  const handler = async (req, res) => {
    try {
      const { path, query } = parseRoute(req, '/deepseek-usage');
      if (path === '/api/state') {
        const [apiKey, platformToken] = await Promise.all([
          resolveSecret(ctx, apiKeyEnv),
          resolveSecret(ctx, platformTokenEnv),
        ]);
        sendJson(res, 200, {
          ok: true,
          apiKeyConfigured: Boolean(apiKey),
          platformTokenConfigured: Boolean(platformToken),
          currency,
          usageAvailable: Boolean(ctx.get('sessionPersistence')),
          now: Date.now(),
        });
        return;
      }

      if (path === '/api/balance') {
        const apiKey = await resolveSecret(ctx, apiKeyEnv);
        if (!apiKey) {
          sendJson(res, 200, { ok: true, configured: false, error: 'DEEPSEEK_API_KEY 未配置' });
          return;
        }
        const now = Date.now();
        if (!balanceCache.promise || now - balanceCache.at > BALANCE_CACHE_MS) {
          balanceCache = { at: now, promise: fetchBalance(apiKey) };
        }
        let balance;
        try {
          balance = await balanceCache.promise;
        } catch (error) {
          sendJson(res, 200, { ok: false, configured: true, error: error instanceof Error ? error.message : String(error) });
          return;
        }
        sendJson(res, 200, { ok: true, configured: true, ...balance, fetchedAt: Date.now() });
        return;
      }

      if (path === '/api/overview') {
        const from = Number(query.get('from'));
        const to = Number(query.get('to'));
        if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) {
          sendJson(res, 400, { ok: false, error: 'from/to epoch ms required (to > from)' });
          return;
        }
        const requestedBucket = query.get('bucket') ?? 'auto';
        const windowLen = to - from;
        const bucket = requestedBucket === 'hour' ? 'hour'
          : requestedBucket === 'day' ? 'day'
          : windowLen <= 3 * 24 * 3600 * 1000 ? 'hour' : 'day';
        const source = query.get('source') ?? 'auto';

        const cacheKey = `${from}|${to}|${bucket}|${source}`;
        const now = Date.now();
        if (overviewCache.key === cacheKey && now - overviewCache.at < OVERVIEW_CACHE_MS) {
          sendJson(res, 200, { ok: true, generatedAt: overviewCache.at, ...overviewCache.payload });
          return;
        }

        let payload;
        let platformToken;
        if (source !== 'local') {
          platformToken = await resolveSecret(ctx, platformTokenEnv);
        }
        if (source === 'platform' && !platformToken) {
          sendJson(res, 400, { ok: false, error: 'platform source requested but DEEPSEEK_PLATFORM_TOKEN 未配置' });
          return;
        }
        if (platformToken) {
          try {
            payload = await buildPlatformOverview(ctx, platformToken, from, to, currency);
          } catch (error) {
            if (source === 'platform') {
              sendJson(res, 200, {
                ok: false,
                error: error instanceof Error ? error.message : String(error),
                platformTokenConfigured: true,
              });
              return;
            }
            payload = await buildLocalOverview(ctx, pricing, from, to, bucket);
            payload.platformError = error instanceof Error ? error.message : String(error);
          }
        } else {
          payload = await buildLocalOverview(ctx, pricing, from, to, bucket);
        }

        payload.currency = currency;
        payload.costEstimated = payload.source === 'local';
        overviewCache = { at: Date.now(), key: cacheKey, payload };
        sendJson(res, 200, { ok: true, generatedAt: overviewCache.at, ...payload });
        return;
      }

      if (path === '/api/calendar') {
        const now = Date.now();
        if (calendarCache.payload && now - calendarCache.at < CALENDAR_CACHE_MS) {
          sendJson(res, 200, { ok: true, generatedAt: calendarCache.at, ...calendarCache.payload });
          return;
        }
        const records = await collectLocalRequests(ctx, pricing, 0, now);
        const calendar = aggregateCalendar(records);
        calendarCache = { at: now, payload: calendar };
        sendJson(res, 200, { ok: true, generatedAt: now, ...calendar });
        return;
      }

      if (path === '/api/echo') {
        const body = await readBodyJson(req);
        sendJson(res, 200, { ok: true, echo: body });
        return;
      }

      sendJson(res, 404, { ok: false, error: `unknown route ${path}` });
    } catch (error) {
      ctx.logger.warn(`deepseek-usage route failed: ${error instanceof Error ? error.stack : String(error)}`);
      sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  };

  const disposer = ctx.webServer.register({
    kind: 'prefix',
    path: '/deepseek-usage',
    handler,
  });

  return () => {
    disposer();
  };
}

export default { apply, inject };
