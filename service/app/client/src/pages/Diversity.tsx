import { useFilters } from '@/hooks/useFilters';
import { useQuery } from '@/hooks/useQuery';
import { fetchDiversity } from '@/lib/api';
import ChartCard from '@/components/ChartCard';
import ReactECharts from 'echarts-for-react';

const PALETTE = ['#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#ec4899'];

export default function Diversity() {
  const { selectedDepartments, selectedCompanies } = useFilters();
  const has = selectedDepartments.length > 0 && selectedCompanies.length > 0;
  const { data, loading, error } = useQuery(
    () => has ? fetchDiversity(selectedDepartments, selectedCompanies) : Promise.resolve(null),
    [selectedDepartments.join(','), selectedCompanies.join(',')]);
  if (!has) return <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">Select at least one department and company.</div>;
  if (loading) return <div className="h-64 animate-pulse rounded-xl bg-gray-200" />;
  if (error) return <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">Error: {error}</div>;
  if (!data) return null;

  const g = data.genderByDept ?? [];
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <ChartCard title="Gender by Department (stacked)" className="lg:col-span-2">
        <ReactECharts option={{
          tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } }, legend: { data: ['Female', 'Male', 'Non-binary'], top: 0 },
          grid: { left: 50, right: 20, bottom: 60, top: 35 },
          xAxis: { type: 'category', data: g.map((d: any) => d.name), axisLabel: { rotate: 30, fontSize: 10 } },
          yAxis: { type: 'value' },
          series: [
            { name: 'Female', type: 'bar', stack: 't', data: g.map((d: any) => d.female), itemStyle: { color: '#ec4899' } },
            { name: 'Male', type: 'bar', stack: 't', data: g.map((d: any) => d.male), itemStyle: { color: '#06b6d4' } },
            { name: 'Non-binary', type: 'bar', stack: 't', data: g.map((d: any) => d.nonbinary), itemStyle: { color: '#f59e0b' } },
          ],
        }} style={{ height: 340 }} />
      </ChartCard>
      <ChartCard title="Generation Mix">
        <ReactECharts option={{ tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
          series: [{ type: 'pie', radius: ['40%', '70%'], center: ['50%', '55%'],
            data: (data.generation ?? []).map((d: any, i: number) => ({ name: d.name, value: d.headcount, itemStyle: { color: PALETTE[i % PALETTE.length] } })),
            itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 }, label: { formatter: '{b}\n{d}%', fontSize: 10 } }] }} style={{ height: 300 }} />
      </ChartCard>
      <ChartCard title="Age Band Distribution">
        <ReactECharts option={{ tooltip: { trigger: 'axis' }, grid: { left: 40, right: 20, bottom: 20, top: 10 },
          xAxis: { type: 'category', data: (data.ageBand ?? []).map((d: any) => d.name) }, yAxis: { type: 'value' },
          series: [{ type: 'bar', data: (data.ageBand ?? []).map((d: any) => d.headcount), itemStyle: { color: '#8b5cf6', borderRadius: [4, 4, 0, 0] }, barMaxWidth: 40 }] }} style={{ height: 300 }} />
      </ChartCard>
      <ChartCard title="% Female by Pay Grade" subtitle="Representation across levels" className="lg:col-span-2">
        <ReactECharts option={{ tooltip: { trigger: 'axis', formatter: (p: any) => `Grade ${p[0].name}: ${p[0].value}% female` },
          grid: { left: 50, right: 20, bottom: 30, top: 10 },
          xAxis: { type: 'category', data: (data.femaleByGrade ?? []).map((d: any) => `G${d.grade}`) },
          yAxis: { type: 'value', max: 100, axisLabel: { formatter: '{value}%' } },
          series: [{ type: 'line', smooth: true, symbol: 'circle', symbolSize: 8, data: (data.femaleByGrade ?? []).map((d: any) => d.pctFemale),
            lineStyle: { color: '#ec4899', width: 3 }, itemStyle: { color: '#ec4899' },
            markLine: { silent: true, lineStyle: { type: 'dashed', color: '#94a3b8' }, data: [{ yAxis: 50, label: { formatter: 'Parity 50%' } }] } }] }} style={{ height: 300 }} />
      </ChartCard>
    </div>
  );
}
