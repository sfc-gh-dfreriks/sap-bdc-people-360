import { useFilters } from '@/hooks/useFilters';
import { useQuery } from '@/hooks/useQuery';
import { fetchAttrition } from '@/lib/api';
import ChartCard from '@/components/ChartCard';
import ReactECharts from 'echarts-for-react';

const PALETTE = ['#ef4444', '#f59e0b', '#8b5cf6', '#06b6d4', '#10b981', '#3b82f6', '#ec4899'];

export default function Attrition() {
  const { selectedDepartments, selectedCompanies } = useFilters();
  const has = selectedDepartments.length > 0 && selectedCompanies.length > 0;
  const { data, loading, error } = useQuery(
    () => has ? fetchAttrition(selectedDepartments, selectedCompanies) : Promise.resolve(null),
    [selectedDepartments.join(','), selectedCompanies.join(',')]);
  if (!has) return <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">Select at least one department and company.</div>;
  if (loading) return <div className="h-64 animate-pulse rounded-xl bg-gray-200" />;
  if (error) return <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">Error: {error}</div>;
  if (!data) return null;

  const byDept = data.byDept ?? [];
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <ChartCard title="Attrition Rate by Department" className="lg:col-span-2">
        <ReactECharts option={{ tooltip: { trigger: 'axis', formatter: (p: any) => `${p[0].name}: ${p[0].value}% (${byDept[p[0].dataIndex]?.terminations} terms)` },
          grid: { left: 50, right: 20, bottom: 60, top: 10 },
          xAxis: { type: 'category', data: byDept.map((d: any) => d.name), axisLabel: { rotate: 30, fontSize: 10 } },
          yAxis: { type: 'value', axisLabel: { formatter: '{value}%' } },
          series: [{ type: 'bar', data: byDept.map((d: any) => d.attritionPct), itemStyle: { color: '#ef4444', borderRadius: [4, 4, 0, 0] }, barMaxWidth: 28,
            markLine: { silent: true, lineStyle: { type: 'dashed', color: '#94a3b8' }, data: [{ type: 'average', label: { formatter: 'Avg' } }] } }] }} style={{ height: 320 }} />
      </ChartCard>
      <ChartCard title="Termination Reasons">
        <ReactECharts option={{ tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
          series: [{ type: 'pie', radius: ['35%', '68%'], center: ['50%', '55%'],
            data: (data.reasons ?? []).map((d: any, i: number) => ({ name: d.name, value: d.n, itemStyle: { color: PALETTE[i % PALETTE.length] } })),
            itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 }, label: { fontSize: 10 } }] }} style={{ height: 320 }} />
      </ChartCard>
      <ChartCard title="Terminations by Tenure Band">
        <ReactECharts option={{ tooltip: { trigger: 'axis' }, grid: { left: 40, right: 20, bottom: 20, top: 10 },
          xAxis: { type: 'category', data: (data.byTenure ?? []).map((d: any) => d.name) }, yAxis: { type: 'value' },
          series: [{ type: 'bar', data: (data.byTenure ?? []).map((d: any) => d.terminations), itemStyle: { color: '#f59e0b', borderRadius: [4, 4, 0, 0] }, barMaxWidth: 40 }] }} style={{ height: 320 }} />
      </ChartCard>
      <ChartCard title="Terminations by Division" className="lg:col-span-2">
        <ReactECharts option={{ tooltip: { trigger: 'axis' }, grid: { left: 120, right: 20, bottom: 20, top: 10 },
          xAxis: { type: 'value' }, yAxis: { type: 'category', data: (data.byDivision ?? []).map((d: any) => d.name) },
          series: [{ type: 'bar', data: (data.byDivision ?? []).map((d: any) => d.terminations), itemStyle: { color: '#8b5cf6', borderRadius: [0, 4, 4, 0] }, barMaxWidth: 26 }] }} style={{ height: 260 }} />
      </ChartCard>
    </div>
  );
}
