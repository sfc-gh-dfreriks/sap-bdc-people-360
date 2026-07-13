import { useFilters } from '@/hooks/useFilters';
import { useQuery } from '@/hooks/useQuery';
import { fetchOrg } from '@/lib/api';
import ChartCard from '@/components/ChartCard';
import ReactECharts from 'echarts-for-react';

const PALETTE = ['#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#ec4899'];

export default function Org() {
  const { selectedDepartments, selectedCompanies } = useFilters();
  const has = selectedDepartments.length > 0 && selectedCompanies.length > 0;
  const { data, loading, error } = useQuery(
    () => has ? fetchOrg(selectedDepartments, selectedCompanies) : Promise.resolve(null),
    [selectedDepartments.join(','), selectedCompanies.join(',')]);
  if (!has) return <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">Select at least one department and company.</div>;
  if (loading) return <div className="h-64 animate-pulse rounded-xl bg-gray-200" />;
  if (error) return <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">Error: {error}</div>;
  if (!data) return null;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <ChartCard title="Managers vs Individual Contributors">
        <ReactECharts option={{ tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
          series: [{ type: 'pie', radius: ['40%', '70%'], center: ['50%', '55%'],
            data: (data.managers ?? []).map((d: any, i: number) => ({ name: d.name, value: d.headcount, itemStyle: { color: PALETTE[i % PALETTE.length] } })),
            itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 }, label: { formatter: '{b}\n{d}%', fontSize: 11 } }] }} style={{ height: 320 }} />
      </ChartCard>
      <ChartCard title="Avg Span of Control by Department" subtitle="Direct reports per manager">
        <ReactECharts option={{ tooltip: { trigger: 'axis' }, grid: { left: 120, right: 20, bottom: 20, top: 10 },
          xAxis: { type: 'value' }, yAxis: { type: 'category', data: (data.spanOfControl ?? []).map((d: any) => d.name), axisLabel: { fontSize: 11 } },
          series: [{ type: 'bar', data: (data.spanOfControl ?? []).map((d: any) => d.avgSpan), itemStyle: { color: '#06b6d4', borderRadius: [0, 4, 4, 0] }, barMaxWidth: 22 }] }} style={{ height: 320 }} />
      </ChartCard>
      <ChartCard title="Headcount by Division & Company" className="lg:col-span-2">
        <ReactECharts option={{ tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
          grid: { left: 50, right: 20, bottom: 40, top: 10 },
          xAxis: { type: 'category', data: Array.from(new Set((data.byDivision ?? []).map((d: any) => d.name))) },
          yAxis: { type: 'value' },
          series: [{ type: 'bar', data: (data.byDivision ?? []).map((d: any) => d.headcount), itemStyle: { color: '#8b5cf6', borderRadius: [4, 4, 0, 0] }, barMaxWidth: 40 }] }} style={{ height: 300 }} />
      </ChartCard>
      <ChartCard title="Critical Positions by Department" className="lg:col-span-2">
        <ReactECharts option={{ tooltip: { trigger: 'axis' }, grid: { left: 120, right: 20, bottom: 20, top: 10 },
          xAxis: { type: 'value' }, yAxis: { type: 'category', data: (data.critical ?? []).map((d: any) => d.name), axisLabel: { fontSize: 11 } },
          series: [{ type: 'bar', data: (data.critical ?? []).map((d: any) => d.criticalPositions), itemStyle: { color: '#ef4444', borderRadius: [0, 4, 4, 0] }, barMaxWidth: 22 }] }} style={{ height: 280 }} />
      </ChartCard>
    </div>
  );
}
