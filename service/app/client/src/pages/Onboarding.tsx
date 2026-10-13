import { useEffect, useMemo, useState } from 'react';
import {
  UserPlus, Package, Search, Send, AlertTriangle, CheckCircle2, ExternalLink, Loader2, Laptop, ArrowRight,
} from 'lucide-react';
import ChartCard from '@/components/ChartCard';
import MetricCard from '@/components/MetricCard';
import ReactECharts from '@/components/Chart';
import { cn, formatNumber } from '@/lib/utils';
import {
  ONBOARDING_LIVE_ONLY, ONBOARDING_REPLAY, fetchOnboardingReplayMeta, fetchOnboardingOptions, fetchOnboardingTemplate, fetchOnboardingKit,
  searchOnboardingAlternatives, submitOnboarding, fetchOnboardingHistory,
} from '@/lib/api';

const STEPS = [
  { n: 1, label: 'New hire (SuccessFactors)', icon: UserPlus },
  { n: 2, label: 'Equipment check', icon: Package },
  { n: 3, label: 'Alternative sourcing', icon: Search },
  { n: 4, label: 'Substitute & write back', icon: Send },
];

function money(v: number | null | undefined, ccy: string) {
  if (v == null || Number.isNaN(v)) return '—';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: ccy || 'USD', maximumFractionDigits: 0 }).format(v);
}
function defaultStart() { const d = new Date(); d.setDate(d.getDate() + 17); return d.toISOString().slice(0, 10); }

const card = 'rounded-xl border border-gray-200 bg-white p-5 shadow-sm';
const input = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sf-primary focus:outline-none';
const btn = 'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50';

function ErrorBox({ msg }: { msg: string }) {
  return <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{msg}</div>;
}

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [opts, setOpts] = useState<{ titles: string[]; departments: string[]; companies: string[] } | null>(null);
  const [form, setForm] = useState({ candidateName: 'Jordan Lee', title: 'Senior Engineer', department: 'Engineering', company: 'US Operations', startDate: defaultStart() });
  const [tpl, setTpl] = useState<any>(null);
  const [salary, setSalary] = useState<number>(0);
  const [kit, setKit] = useState<any[] | null>(null);
  const [search, setSearch] = useState<any>(null);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<{ msg: string; code?: string } | null>(null);

  const [replayAt, setReplayAt] = useState<string | null>(null);
  useEffect(() => {
    if (ONBOARDING_REPLAY) fetchOnboardingReplayMeta().then((m) => { setForm(m.form); setReplayAt(m.recordedAt); }).catch((e) => setErr({ msg: e.message }));
    fetchOnboardingOptions().then(setOpts).catch((e) => setErr({ msg: e.message })); refreshHistory();
  }, []);
  function refreshHistory() { fetchOnboardingHistory().then(setHistory).catch(() => {}); }

  // Re-derive the SuccessFactors template whenever the position changes.
  useEffect(() => {
    if (!form.title || !form.company) return;
    setBusy('template'); setErr(null);
    fetchOnboardingTemplate(form.title, form.company, form.department)
      .then((t) => { setTpl(t); setSalary(Number(t.salary)); })
      .catch((e) => { setTpl(null); setErr({ msg: e.message }); })
      .finally(() => setBusy(null));
  }, [form.title, form.company, form.department]);

  const ccy: string = tpl?.currency ?? 'USD';
  const load = Number(tpl?.benefits?.benefits_load_pct ?? 25);
  const dailyLoaded = Math.round((salary * (1 + load / 100)) / 260);
  const blocked = (kit ?? []).filter((k) => k.blocking);
  const blockedItem = blocked.find((k) => /^LAP-/.test(k.item_code)) ?? blocked[0];
  const chosen = search?.alternatives?.find((a: any) => a.id === chosenId) ?? null;

  async function checkKit() {
    setBusy('kit'); setErr(null); setSearch(null); setChosenId(null); setResult(null);
    try { setKit((await fetchOnboardingKit(tpl.roleFamily, form.company, form.startDate)).items); setStep(2); }
    catch (e: any) { setErr({ msg: e.message }); } finally { setBusy(null); }
  }

  async function runSearch() {
    setBusy('search'); setErr(null);
    try {
      const r = await searchOnboardingAlternatives({ itemCode: blockedItem.item_code, roleFamily: tpl.roleFamily, company: form.company, startDate: form.startDate, dailyLoadedCost: dailyLoaded });
      setSearch(r); setChosenId(r.recommendedId); setStep(3);
    } catch (e: any) { setErr({ msg: e.message, code: e.code }); } finally { setBusy(null); }
  }

  async function writeBack() {
    setBusy('submit'); setErr(null);
    try {
      const lines = (kit ?? []).map((k) => {
        const sub = chosen && k.item_code === blockedItem?.item_code;
        return {
          itemCode: k.item_code, itemName: sub ? `${chosen.vendor} ${chosen.model}` : k.item_name, quantity: Number(k.quantity),
          fulfillment: sub ? 'SUBSTITUTE' : k.fulfillment, supplier: sub ? chosen.vendor : k.fulfillment === 'STOCK' ? k.site : k.supplier_name,
          unitCost: sub ? chosen.unitCost : Number(k.unit_cost), currency: ccy, expectedDate: sub ? chosen.readyDate : k.readyDate,
        };
      });
      const r = await submitOnboarding({
        hire: { ...form, payGrade: tpl.pay_grade, flsaStatus: tpl.flsa_status, salary, currency: ccy },
        kit: lines,
        substitution: chosen ? {
          itemCode: blockedItem.item_code, preferred: search.preferred, alternatives: search.alternatives, chosen,
          rationale: `Net benefit ${money(chosen.netBenefit, ccy)}; ${chosen.daysSaved} workdays saved vs preferred channel.`,
        } : null,
      });
      setResult(r); setStep(4); refreshHistory();
    } catch (e: any) { setErr({ msg: e.message }); } finally { setBusy(null); }
  }

  const scatter = useMemo(() => {
    if (!search) return null;
    const pts = [
      { name: `Preferred: ${search.preferred.vendor}`, value: [search.preferred.leadDays, search.preferred.totalCost], itemStyle: { color: '#ef4444' }, symbolSize: 18 },
      ...search.alternatives.filter((a: any) => a.totalCost != null).map((a: any) => ({
        name: `${a.vendor} ${a.model}`, value: [a.leadDays, a.totalCost],
        itemStyle: { color: a.id === chosenId ? '#10b981' : '#06b6d4' }, symbolSize: a.id === chosenId ? 18 : 12,
      })),
    ];
    return {
      tooltip: { formatter: (p: any) => `${p.name}<br/>Lead: ${p.value[0]} days<br/>Cost: ${money(p.value[1], ccy)}` },
      grid: { left: 70, right: 20, top: 20, bottom: 40 },
      xAxis: { type: 'value', name: 'Lead time (days)', nameLocation: 'middle', nameGap: 26 },
      yAxis: { type: 'value', name: `Cost (${ccy})`, axisLabel: { formatter: (v: number) => formatNumber(v) } },
      series: [{ type: 'scatter', data: pts }],
    };
  }, [search, chosenId, ccy]);

  if (ONBOARDING_LIVE_ONLY) {
    return <div className={card}>This scenario writes back to Snowflake and runs live web searches, so it is only available when the app runs against the live server.</div>;
  }

  return (
    <div className="space-y-6">
      {/* Stepper */}
      <div className="flex flex-wrap items-center gap-2">
        {STEPS.map((s, i) => {
          const Icon = s.icon; const done = step > s.n; const active = step === s.n;
          return (
            <div key={s.n} className="flex items-center gap-2">
              <div className={cn('flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold',
                active ? 'bg-sf-primary text-white' : done ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500')}>
                {done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}{s.n}. {s.label}
              </div>
              {i < STEPS.length - 1 && <ArrowRight className="h-4 w-4 text-gray-300" />}
            </div>
          );
        })}
      </div>

      {ONBOARDING_REPLAY && (
        <div className="rounded-lg border border-sky-300 bg-sky-50 p-4 text-sm text-sky-900">
          <b>Recorded run.</b> This public build replays one real run of the scenario{replayAt ? ` recorded ${new Date(replayAt).toLocaleDateString()}` : ''}: the
          live web search results, their cited sources and the simulated SuccessFactors write-back are exactly what the live app returned. Inputs are fixed to that run;
          the live app and the Snowflake Native App run new searches and write back to Snowflake.
        </div>
      )}

      {err && err.code === 'SEARCH_NOT_CONFIGURED' ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <b>Live web search is unavailable.</b> The keyless search could not be reached from the server; check network access, or add <code>TAVILY_API_KEY=&lt;key&gt;</code> to <code>people_360_react/.env</code> and restart. No alternatives are shown without a real search.
        </div>
      ) : err ? <ErrorBox msg={err.msg} /> : null}

      {/* Step 1 — new hire */}
      <div className={card}>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-sf-deeper"><UserPlus className="h-5 w-5" /> 1. New hire from SuccessFactors</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          <label className="text-xs font-medium text-gray-600">Candidate name
            <input className={input} disabled={ONBOARDING_REPLAY} value={form.candidateName} onChange={(e) => setForm({ ...form, candidateName: e.target.value })} /></label>
          {(['title', 'department', 'company'] as const).map((f) => (
            <label key={f} className="text-xs font-medium capitalize text-gray-600">{f === 'company' ? 'Company / region' : f}
              <select className={input} disabled={ONBOARDING_REPLAY} value={form[f]} onChange={(e) => setForm({ ...form, [f]: e.target.value })}>
                {(opts?.[f === 'title' ? 'titles' : f === 'department' ? 'departments' : 'companies'] ?? []).map((o) => <option key={o}>{o}</option>)}
              </select></label>
          ))}
          <label className="text-xs font-medium text-gray-600">Start date
            <input type="date" className={input} disabled={ONBOARDING_REPLAY} value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></label>
        </div>

        {busy === 'template' && <div className="mt-4 h-24 animate-pulse rounded-lg bg-gray-100" />}
        {tpl && busy !== 'template' && (
          <>
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-4">
              <MetricCard title="Annual base salary" value={money(salary, ccy)} delta={`Band ${money(tpl.salary_min, ccy)} – ${money(tpl.salary_max, ccy)}`} deltaType="neutral" />
              <MetricCard title="Pay grade / FLSA" value={`G${tpl.pay_grade} · ${tpl.flsa_status}`} delta={`${tpl.employment_type} · ${tpl.region}`} deltaType="neutral" />
              <MetricCard title="Loaded annual cost" value={money(Math.round(salary * (1 + load / 100)), ccy)} delta={`+${load}% benefits on-cost`} deltaType="neutral" />
              <MetricCard title="Cost of an idle day" value={money(dailyLoaded, ccy)} delta="Loaded cost / 260 workdays" deltaType="neutral" />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <label className="text-xs font-medium text-gray-600">Offer salary ({ccy}) — editable
                <input type="number" className={input} disabled={ONBOARDING_REPLAY} value={salary} onChange={(e) => setSalary(Number(e.target.value))} /></label>
              {tpl.benefits && (
                <div className="lg:col-span-2 rounded-lg bg-gray-50 p-3 text-xs text-gray-700">
                  <b>Benefits ({tpl.region}):</b> {tpl.benefits.medical_plan} (employer {money(tpl.benefits.employer_medical_annual, ccy)}/yr) ·
                  {' '}{tpl.benefits.retirement_plan} {tpl.benefits.retirement_match_pct}% match · {tpl.benefits.pto_days} PTO days ·
                  {' '}bonus target {tpl.benefits.bonus_target_pct}% · equity {tpl.benefits.equity_eligible ? 'eligible' : 'not eligible'}
                </div>
              )}
            </div>
            <p className="mt-3 text-[11px] text-gray-500">Derived from {tpl.peers} active {tpl.title} records in {tpl.company}. Source: {tpl.source}. Kit profile: <b>{tpl.roleFamily}</b>.</p>
            <button className={cn(btn, 'mt-4 bg-sf-primary text-white')} disabled={busy !== null} onClick={checkKit}>
              {busy === 'kit' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />} Check onboarding equipment
            </button>
          </>
        )}
      </div>

      {/* Step 2 — equipment */}
      {kit && (
        <div className={card}>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-sf-deeper"><Package className="h-5 w-5" /> 2. Equipment availability for {form.startDate}</h2>
          {blockedItem && (
            <div className="mb-4 flex gap-3 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <div><b>Supply-chain disruption: {blockedItem.item_name}.</b> 0 available at {blockedItem.site}; preferred channel {blockedItem.supplier_name} ({blockedItem.supplier_id}) is <b>{blockedItem.supply_status}</b> with a {blockedItem.current_lead_days}-day lead time.
                {' '}{blockedItem.disruption_note} Ready {blockedItem.readyDate}: <b>{blockedItem.lostWorkdays} workdays</b> without a laptop ≈ <b>{money(blockedItem.lostWorkdays * dailyLoaded, ccy)}</b> of idle loaded cost.</div>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs uppercase text-gray-500"><tr>
                <th className="py-2">Item</th><th>Spec</th><th className="text-right">Qty</th><th className="text-right">Available</th>
                <th>Fulfilment</th><th className="text-right">Unit cost</th><th>Ready</th><th>Status</th></tr></thead>
              <tbody>{kit.map((k) => (
                <tr key={k.item_code} className="border-b last:border-0">
                  <td className="py-2 font-medium">{k.item_name}{k.is_critical && <span className="ml-1 text-[10px] text-red-600">critical</span>}</td>
                  <td className="text-xs text-gray-600">{k.item_spec}</td>
                  <td className="text-right">{k.quantity}</td><td className="text-right">{k.available}</td>
                  <td className="text-xs">{k.fulfillment === 'STOCK' ? `Stock · ${k.site}` : `${k.supplier_name} (${k.supplier_id})`}</td>
                  <td className="text-right">{money(Number(k.unit_cost), ccy)}</td><td>{k.readyDate}</td>
                  <td>{k.blocking
                    ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">Late +{k.lostWorkdays}d</span>
                    : <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">On time</span>}</td>
                </tr>))}</tbody>
            </table>
          </div>
          {blockedItem ? (
            <button className={cn(btn, 'mt-4 bg-sf-primary text-white')} disabled={busy !== null} onClick={runSearch}>
              {busy === 'search' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {busy === 'search' ? 'Searching the web & extracting offers…' : `Search the web for alternatives to ${blockedItem.item_name}`}
            </button>
          ) : (
            <button className={cn(btn, 'mt-4 bg-sf-primary text-white')} disabled={busy !== null} onClick={writeBack}><Send className="h-4 w-4" /> All on time — write back to SuccessFactors</button>
          )}
        </div>
      )}

      {/* Step 3 — alternatives */}
      {search && (
        <div className={card}>
          <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-sf-deeper"><Laptop className="h-5 w-5" /> 3. Cost / time analysis — {search.item.item_name}</h2>
          <p className="mb-4 text-xs text-gray-500">Live web search ({search.sources.length} pages) → offers extracted by Cortex AI_COMPLETE. Only offers with a price on the cited page are shown. Total impact = hardware cost + idle workdays × {money(dailyLoaded, ccy)}.</p>
          {search.alternatives.length === 0 ? (
            <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">The search returned no priced offers that match. Try a later start date or search again.</div>
          ) : (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
              <div className="overflow-x-auto xl:col-span-2">
                <table className="w-full text-sm">
                  <thead className="border-b text-left text-xs uppercase text-gray-500"><tr>
                    <th /><th className="py-2">Option</th><th>Channel</th><th>Spec</th><th className="text-right">Cost</th>
                    <th className="text-right">Lead</th><th className="text-right">Idle days</th><th className="text-right">Total impact</th><th className="text-right">Net benefit</th></tr></thead>
                  <tbody>
                    <tr className="border-b bg-red-50/50">
                      <td /><td className="py-2 font-medium">{search.preferred.vendor}<div className="text-[11px] text-gray-500">Preferred (current)</div></td>
                      <td className="text-xs">{search.preferred.channel}</td><td className="text-xs">full</td>
                      <td className="text-right">{money(search.preferred.totalCost, ccy)}</td><td className="text-right">{search.preferred.leadDays}d</td>
                      <td className="text-right">{search.preferred.lostWorkdays}</td><td className="text-right font-semibold">{money(search.preferred.totalImpact, ccy)}</td><td className="text-right">—</td>
                    </tr>
                    {search.alternatives.map((a: any) => (
                      <tr key={a.id} onClick={() => setChosenId(a.id)} className={cn('cursor-pointer border-b last:border-0 hover:bg-gray-50', chosenId === a.id && 'bg-emerald-50')}>
                        <td><input type="radio" checked={chosenId === a.id} readOnly /></td>
                        <td className="py-2 font-medium">{a.vendor} {a.model}
                          {a.id === search.recommendedId && <span className="ml-1 rounded bg-emerald-600 px-1.5 text-[10px] text-white">Recommended</span>}
                          <a href={a.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[11px] text-sf-primary" onClick={(e) => e.stopPropagation()}>source <ExternalLink className="h-3 w-3" /></a></td>
                        <td className="text-xs">{a.channel}</td>
                        <td className="text-xs" title={a.specNotes}><span className={cn('rounded px-1.5', a.specMatch === 'partial' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800')}>{a.specMatch}</span></td>
                        <td className="text-right">{money(a.totalCost, ccy)}{a.convertedFrom && <div className="text-[10px] text-gray-500">from {a.convertedFrom}</div>}</td>
                        <td className="text-right">{a.leadDays}d{a.leadAssumed && <div className="text-[10px] text-amber-700">assumed</div>}</td>
                        <td className="text-right">{a.lostWorkdays}</td>
                        <td className="text-right font-semibold">{money(a.totalImpact, ccy)}</td>
                        <td className={cn('text-right font-semibold', (a.netBenefit ?? 0) > 0 ? 'text-emerald-700' : 'text-red-700')}>{money(a.netBenefit, ccy)}</td>
                      </tr>))}
                  </tbody>
                </table>
              </div>
              {scatter && <ChartCard title="Cost vs lead time" subtitle="Red = preferred, green = selected"><ReactECharts option={scatter} style={{ height: 300 }} /></ChartCard>}
            </div>
          )}
          <details className="mt-3 text-xs text-gray-500"><summary className="cursor-pointer">Search queries and sources</summary>
            <ul className="mt-2 list-disc pl-5">{search.queries.map((q: string) => <li key={q}>{q}</li>)}</ul>
            <ul className="mt-2 list-disc pl-5">{search.sources.map((s: any) => <li key={s.url}><a className="text-sf-primary" href={s.url} target="_blank" rel="noreferrer">{s.title}</a></li>)}</ul>
          </details>
          <div className="mt-4 flex gap-3">
            <button className={cn(btn, 'bg-emerald-600 text-white')} disabled={!chosen || busy !== null} onClick={writeBack}>
              {busy === 'submit' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Substitute & write back to SuccessFactors
            </button>
            <button className={cn(btn, 'border border-gray-300 text-gray-700')} disabled={busy !== null} onClick={() => { setChosenId(null); writeBack(); }}>Keep preferred channel</button>
          </div>
        </div>
      )}

      {/* Step 4 — write-back result */}
      {result && (
        <div className={card}>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-sf-deeper"><CheckCircle2 className="h-5 w-5 text-emerald-600" /> 4. Written back to SuccessFactors (simulated)</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <MetricCard title="Request ID" value={result.requestId} />
            <MetricCard title="Person ID (external)" value={result.personIdExternal} />
            <MetricCard title="Status" value={result.status.replace('_', ' ')} delta={result.status === 'PENDING_SOURCING' ? 'Substitute sourcing initiated' : 'Equipment reserved'} deltaType="positive" />
          </div>
          <ol className="mt-4 flex flex-wrap gap-2 text-xs">
            {['Hire created (EmpJob / EmpCompensation)', 'Equipment request posted', result.status === 'PENDING_SOURCING' ? 'Substitute sourcing requested' : 'Kit reserved from stock', 'Awaiting procurement PO'].map((s, i) => (
              <li key={s} className={cn('rounded-full px-3 py-1', i < 3 ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500')}>{s}</li>))}
          </ol>
          <details className="mt-4"><summary className="cursor-pointer text-sm font-medium text-sf-primary">OData payload sent</summary>
            <pre className="mt-2 max-h-80 overflow-auto rounded-lg bg-gray-900 p-3 text-[11px] text-gray-100">{JSON.stringify(result.payload, null, 2)}</pre></details>
          <p className="mt-3 text-[11px] text-gray-500">Stored in SAP_PEOPLE_360.ONBOARDING.SF_WRITEBACK_EMPHIRE, SF_WRITEBACK_EQUIPMENT_REQUEST and SOURCING_DECISION. No live SuccessFactors tenant is called.</p>
        </div>
      )}

      {history.length > 0 && (
        <ChartCard title="Write-back history">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs uppercase text-gray-500"><tr><th className="py-2">Request</th><th>Candidate</th><th>Title</th><th>Company</th><th>Start</th><th>Substitute</th><th>Status</th></tr></thead>
            <tbody>{history.map((h) => (
              <tr key={h.request_id} className="border-b last:border-0"><td className="py-2 font-mono text-xs">{h.request_id}</td><td>{h.candidate_name}</td>
                <td>{h.job_title}</td><td>{h.company}</td><td>{String(h.start_date).slice(0, 10)}</td>
                <td className="text-xs">{h.substitute_vendor ? `${h.substitute_vendor} ${h.substitute_model ?? ''}` : '—'}</td><td className="text-xs">{h.status}</td></tr>))}</tbody>
          </table>
        </ChartCard>
      )}
    </div>
  );
}
