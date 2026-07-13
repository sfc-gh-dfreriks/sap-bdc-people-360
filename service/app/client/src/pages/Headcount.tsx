import { useFilters } from '@/hooks/useFilters';
import { useQuery } from '@/hooks/useQuery';
import { fetchHeadcount } from '@/lib/api';
import { formatNumber } from '@/lib/utils';
import ChartCard from '@/components/ChartCard';
import ReactECharts from 'echarts-for-react';

const PALETTE = ['#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#ec4899'];
const bar = (rows: any[], horizontal = true) => ({
  tooltip: { trigger: 'axis' },
  grid: { left: horizontal ? 120 : 50, right: 20, bottom: 30, top: 10 },
  xAxis: horizontal ? { type: 'value' } : { type: 'category', data: rows.map((d) => d.name) },
  yAxis: horizontal ? { type: 'category', data: rows.map((d) => d.name), axisLabel: { fontSize: 11 } } : { type: 'value' },
  series: [{ type: 'bar', data: rows.map((d: any, i: number) => ({ value: d.headcount, itemStyle: { borderRadius: horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0], color: PALETTE[i % PALETTE.length] } })), barMaxWidth: 24 }],
});

export default function Headcount() {
  const { selectedDepartments, selectedCompanies } = useFilters();
  const has = selectedDepartments.length > 0 && selectedCompanies.length > 0;
  const { data, loading, error } = useQuery(
    () => has ? fetchHeadcount(selectedDepartments, selectedCompanies) : Promise.resolve(null),
    [selectedDepartments.join(','), selectedCompanies.join(',')]);
  if (!has) return <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">Select at least one department and company.</div>;
  if (loading) return <div className="h-64 animate-pulse rounded-xl bg-gray-200" />;
  if (error) return <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">Error: {error}</div>;
  if (!data) return null;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <ChartCard title="Headcount & FTE by Department" className="lg:col-span-2">
        <ReactECharts option={{
          tooltip: { trigger: 'axis' }, legend: { data: ['Headcount', 'FTE'], top: 0 },
          grid: { left: 50, right: 20, bottom: 60, top: 35 },
          xAxis: { type: 'category', data: (data.byDept ?? []).map((d: any) => d.name), axisLabel: { rotate: 30, fontSize: 10 } },
          yAxis: { type: 'value' },
          series: [
            { name: 'Headcount', type: 'bar', data: (data.byDept ?? []).map((d: any) => d.headcount), itemStyle: { color: '#06b6d4', borderRadius: [4, 4, 0, 0] }, barMaxWidth: 26 },
            { name: 'FTE', type: 'line', smooth: true, data: (data.byDept ?? []).map((d: any) => d.fte), itemStyle: { color: '#8b5cf6' }, lineStyle: { width: 3 } },
          ],
        }} style={{ height: 340 }} />
      </ChartCard>
      <ChartCard title="Headcount by Division"><ReactECharts option={bar(data.byDivision ?? [])} style={{ height: 300 }} /></ChartCard>
      <ChartCard title="Headcount by Location"><ReactECharts option={bar(data.byLocation ?? [])} style={{ height: 300 }} /></ChartCard>
      <ChartCard title="Employment Type">
        <ReactECharts option={{ tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
          series: [{ type: 'pie', radius: ['40%', '70%'], center: ['50%', '55%'],
            data: (data.byType ?? []).map((d: any, i: number) => ({ name: d.name, value: d.headcount, itemStyle: { color: PALETTE[i % PALETTE.length] } })),
            itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 }, label: { formatter: '{b}\n{d}%', fontSize: 11 } }] }} style={{ height: 300 }} />
      </ChartCard>
      <ChartCard title="Headcount by Tenure Band"><ReactECharts option={bar(data.byTenure ?? [], false)} style={{ height: 300 }} /></ChartCard>
    </div>
  );
}
