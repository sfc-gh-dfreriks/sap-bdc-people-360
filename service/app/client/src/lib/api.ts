const BASE = '/api';

function buildParams(departments: string[], companies: string[]): string {
  const params = new URLSearchParams();
  if (departments.length) params.set('departments', departments.join(','));
  if (companies.length) params.set('companies', companies.join(','));
  return params.toString();
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

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return camelizeKeys(await res.json()) as T;
}

export function fetchFilters(): Promise<{ departments: string[]; companies: string[] }> {
  return get('/filters');
}

const q = (d: string[], c: string[]) => buildParams(d, c);
export const fetchOverview = (d: string[], c: string[]) => get<any>(`/overview?${q(d, c)}`);
export const fetchHeadcount = (d: string[], c: string[]) => get<any>(`/headcount?${q(d, c)}`);
export const fetchDiversity = (d: string[], c: string[]) => get<any>(`/diversity?${q(d, c)}`);
export const fetchCompensation = (d: string[], c: string[]) => get<any>(`/compensation?${q(d, c)}`);
export const fetchAttrition = (d: string[], c: string[]) => get<any>(`/attrition?${q(d, c)}`);
export const fetchOrg = (d: string[], c: string[]) => get<any>(`/org?${q(d, c)}`);
export const fetchEmployees = (d: string[], c: string[]) => get<any>(`/employees?${q(d, c)}`);
export const fetchPerformance = (d: string[], c: string[]) => get<any>(`/performance?${q(d, c)}`);
export const fetchLearning = (d: string[], c: string[]) => get<any>(`/learning?${q(d, c)}`);
export const fetchRecruiting = (d: string[], c: string[]) => get<any>(`/recruiting?${q(d, c)}`);
export const fetchLineage = () => get<any>(`/lineage`);

export async function fetchAnalyst(messages: { role: string; content: string }[]) {
  const res = await fetch(`${BASE}/analyst`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function runAnalystSql(sql: string) {
  const res = await fetch(`${BASE}/analyst/run-sql`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
