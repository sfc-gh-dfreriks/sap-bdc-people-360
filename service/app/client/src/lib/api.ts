// Data access layer. Two modes:
//   - Live (default): fetch from the Express server at /api/*
//   - Static (VITE_STATIC=1): read pre-baked JSON snapshots from <base>/data/*
//     and route the Cortex agent to VITE_AGENT_URL (a serverless function).
const STATIC = import.meta.env.VITE_STATIC === '1';
const AGENT_BASE = (import.meta.env.VITE_AGENT_URL ?? '').replace(/\/$/, '');
const DATA_BASE = `${import.meta.env.BASE_URL}data`;
const BASE = '/api';

function buildParams(departments: string[], companies: string[]): string {
  const params = new URLSearchParams();
  if (departments.length) params.set('departments', departments.join(','));
  if (companies.length) params.set('companies', companies.join(','));
  return params.toString();
}

/** Canonical snapshot key — MUST match makeKey() in scripts/export-static.mjs.
 *  Departments are baked only as "all" or a single value, so multi-department
 *  selections normalize to "all departments" (company filtering stays exact). */
function filterKey(departments: string[], companies: string[]): string {
  const dept = departments.length === 1 ? departments[0] : '';
  return `${dept}||${[...companies].sort().join(',')}`;
}

function camelizeKey(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
}
function camelizeKeys(obj: any): any {
  if (Array.isArray(obj)) return obj.map(camelizeKeys);
  if (obj !== null && typeof obj === 'object') {
    const out: any = {};
    for (const [k, v] of Object.entries(obj)) out[camelizeKey(k)] = camelizeKeys(v);
    return out;
  }
  return obj;
}

async function liveGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return camelizeKeys(await res.json()) as T;
}

const fileCache = new Map<string, Promise<any>>();
function loadStaticFile(file: string): Promise<any> {
  let p = fileCache.get(file);
  if (!p) {
    p = fetch(`${DATA_BASE}/${file}.json`).then((res) => {
      if (!res.ok) throw new Error(`Static data error: ${res.status} ${file}`);
      return res.json();
    });
    fileCache.set(file, p);
  }
  return p;
}

async function getKeyed<T>(name: string, d: string[], c: string[]): Promise<T> {
  if (STATIC) {
    const map = await loadStaticFile(name);
    return camelizeKeys(map[filterKey(d, c)] ?? {}) as T;
  }
  return liveGet<T>(`/${name}?${buildParams(d, c)}`);
}

async function getSingle<T>(name: string): Promise<T> {
  if (STATIC) return camelizeKeys(await loadStaticFile(name)) as T;
  return liveGet<T>(`/${name}`);
}

export function fetchFilters(): Promise<{ departments: string[]; companies: string[] }> {
  if (STATIC) return loadStaticFile('filters');
  return liveGet('/filters');
}

export const fetchOverview = (d: string[], c: string[]) => getKeyed<any>('overview', d, c);
export const fetchHeadcount = (d: string[], c: string[]) => getKeyed<any>('headcount', d, c);
export const fetchDiversity = (d: string[], c: string[]) => getKeyed<any>('diversity', d, c);
export const fetchCompensation = (d: string[], c: string[]) => getKeyed<any>('compensation', d, c);
export const fetchAttrition = (d: string[], c: string[]) => getKeyed<any>('attrition', d, c);
export const fetchOrg = (d: string[], c: string[]) => getKeyed<any>('org', d, c);
export const fetchEmployees = (d: string[], c: string[]) => getKeyed<any>('employees', d, c);
export const fetchPerformance = (d: string[], c: string[]) => getKeyed<any>('performance', d, c);
export const fetchLearning = (d: string[], c: string[]) => getKeyed<any>('learning', d, c);
export const fetchRecruiting = (d: string[], c: string[]) => getKeyed<any>('recruiting', d, c);
export const fetchLineage = () => getSingle<any>('lineage');

export async function fetchAnalyst(messages: { role: string; content: string }[]) {
  const base = STATIC ? AGENT_BASE : BASE;
  const res = await fetch(`${base}/analyst`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function runAnalystSql(sql: string) {
  const base = STATIC ? AGENT_BASE : BASE;
  const res = await fetch(`${base}/analyst/run-sql`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// --------------------------------------------------------------------------
// Onboarding scenario. Live: the Express server (web search + write-back).
// Static/public build: replays one recorded real run (data/onboarding_replay.json,
// written by scripts/record-onboarding.mjs) - inputs are fixed to that run.
// --------------------------------------------------------------------------
export const ONBOARDING_REPLAY = STATIC;
export const ONBOARDING_LIVE_ONLY = false;
const replay = () => loadStaticFile('onboarding_replay');
export const fetchOnboardingReplayMeta = () =>
  replay().then((r: any) => ({ recordedAt: r.recordedAt as string, form: r.form, chosenId: r.chosenId as string }));

async function onbGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}/onboarding${path}`);
  const body = await res.json();
  if (!res.ok) throw Object.assign(new Error(body.error ?? `API error: ${res.status}`), { code: body.code });
  return body;
}
async function onbPost<T>(path: string, payload: unknown): Promise<T> {
  const res = await fetch(`${BASE}/onboarding${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  const body = await res.json();
  if (!res.ok) throw Object.assign(new Error(body.error ?? `API error: ${res.status}`), { code: body.code });
  return body;
}

export const fetchOnboardingOptions = () => STATIC ? replay().then((r: any) => r.options)
  : onbGet<{ titles: string[]; departments: string[]; companies: string[] }>('/options');
export const fetchOnboardingTemplate = (title: string, company: string, department: string) => STATIC ? replay().then((r: any) => r.template)
  : onbGet<any>(`/template?${new URLSearchParams({ title, company, department })}`);
export const fetchOnboardingKit = (roleFamily: string, company: string, startDate: string) => STATIC ? replay().then((r: any) => r.kit)
  : onbGet<{ items: any[]; blocked: string[] }>(`/kit?${new URLSearchParams({ roleFamily, company, startDate })}`);
export const searchOnboardingAlternatives = (p: { itemCode: string; roleFamily: string; company: string; startDate: string; dailyLoadedCost: number }) =>
  STATIC ? replay().then((r: any) => ({ ...r.search, recommendedId: r.search.recommendedId ?? r.chosenId })) : onbPost<any>('/alternatives', p);
export const submitOnboarding = (p: unknown) => STATIC ? replay().then((r: any) => r.result) : onbPost<any>('/submit', p);
export const fetchOnboardingHistory = () => STATIC ? replay().then((r: any) => r.history ?? []) : onbGet<any[]>('/history');
