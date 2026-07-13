import { useFilters } from '@/hooks/useFilters';
import { useQuery } from '@/hooks/useQuery';
import { fetchPerformance } from '@/lib/api';
import { formatNumber } from '@/lib/utils';
import ChartCard from '@/components/ChartCard';
import ReactECharts from 'echarts-for-react';

const PALETTE = ['#ef4444', '#f59e0b', '#facc15', '#10b981', '#06b6d4'];

export default function Performance() {
  const { selectedDepartments, selectedCompanies } = useFilters();
  const has = selectedDepartments.length > 0 && selectedCompanies.length > 0;
  const { data, loading, error } = useQuery(
    () => has ? fetchPerformance(selectedDepartments, selectedCompanies) : Promise.resolve(null),
    [selectedDepartments.join(','), selectedCompanies.join(',')]);
  if (!has) return <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">Select at least one department and company.</div>;
  if (loading) return <div className="h-64 animate-pulse rounded-xl bg-gray-200" />;
  if (error) return <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">Error: {error}</div>;
  if (!data) return null;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <ChartCard title="Rating Distribution (2025 reviews)">
        <ReactECharts option={{ tooltip: { trigger: 'axis' }, grid: { left: 100, right: 20, bottom: 20, top: 10 },
          xAxis: { type: 'value' }, yAxis: { type: 'category', data: (data.dist ?? []).map((d: any) => d.name) },
          series: [{ type: 'bar', data: (data.dist ?? []).map((d: any, i: number) => ({ value: d.n, itemStyle: { color: PALETTE[i % PALETTE.length], borderRadius: [0, 4, 4, 0] } })), barMaxWidth: 24 }] }} style={{ height: 320 }} />
      </ChartCard>
      <ChartCard title="9-Box Potential Split">
        <ReactECharts option={{ tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
          series: [{ type: 'pie', radius: ['40%', '70%'], center: ['50%', '55%'],
            data: (data.potential ?? []).map((d: any, i: number) => ({ name: d.name, value: d.n, itemStyle: { color: PALETTE[(i + 1) % PALETTE.length] } })),
            itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 }, label: { formatter: '{b}\n{d}%', fontSize: 11 } }] }} style={{ height: 320 }} />
      </ChartCard>
      <ChartCard title="Average Rating by Department" className="lg:col-span-2">
        <ReactECharts option={{ tooltip: { trigger: 'axis' }, grid: { left: 50, right: 20, bottom: 60, top: 10 },
          xAxis: { type: 'category', data: (data.byDept ?? []).map((d: any) => d.name), axisLabel: { rotate: 30, fontSize: 10 } },
          yAxis: { type: 'value', min: 0, max: 5 },
          series: [{ type: 'bar', data: (data.byDept ?? []).map((d: any) => d.avgRating), itemStyle: { color: '#10b981', borderRadius: [4, 4, 0, 0] }, barMaxWidth: 30,
            markLine: { silent: true, lineStyle: { type: 'dashed', color: '#94a3b8' }, data: [{ type: 'average', label: { formatter: 'Avg' } }] } }] }} style={{ height: 320 }} />
      </ChartCard>
      <div className="lg:col-span-2 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">High-Potential Employees (2025)</p>
        <p className="mt-1 text-3xl font-extrabold text-emerald-900">{formatNumber(data.hipo?.highPotentials ?? 0)}</p>
        <p className="mt-1 text-xs text-emerald-700">Rated Exceeds/Exceptional and flagged high potential — key succession pipeline.</p>
      </div>
    </div>
  );
}
