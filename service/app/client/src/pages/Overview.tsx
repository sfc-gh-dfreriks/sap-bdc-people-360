import { useFilters } from '@/hooks/useFilters';
import { useQuery } from '@/hooks/useQuery';
import { fetchOverview } from '@/lib/api';
import { formatDollar, formatPct, formatNumber } from '@/lib/utils';
import MetricCard, { Users, TrendingUp, TrendingDown, DollarSign } from '@/components/MetricCard';
import ChartCard from '@/components/ChartCard';
import ReactECharts from 'echarts-for-react';

const PALETTE = ['#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#ec4899'];

export default function Overview() {
  const { selectedDepartments, selectedCompanies } = useFilters();
  const has = selectedDepartments.length > 0 && selectedCompanies.length > 0;
  const { data, loading, error } = useQuery(
    () => has ? fetchOverview(selectedDepartments, selectedCompanies) : Promise.resolve(null),
    [selectedDepartments.join(','), selectedCompanies.join(',')]
  );

  if (!has) return <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">Select at least one department and company.</div>;
  if (loading) return <div className="grid grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-gray-200" />)}</div>;
  if (error) return <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">Error: {error}</div>;
  if (!data?.kpis) return null;

  const k = data.kpis;
  const byDept = data.byDept ?? [];
  const gender = data.gender ?? [];
  const generation = data.generation ?? [];
  const trend = data.trend ?? [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Active Headcount" value={formatNumber(k.activeHeadcount)} icon={Users}
          accent="border-cyan-300/50 bg-gradient-to-br from-cyan-50 to-sky-50" delta={`${formatNumber(k.externalHires)} hires (LTM)`} deltaType="positive" />
        <MetricCard title="Attrition" value={formatPct(k.attritionPct)} icon={TrendingDown}
          accent="border-red-300/50 bg-gradient-to-br from-red-50 to-orange-50" delta={`${formatNumber(k.terminations)} terminations`} deltaType={k.attritionPct > 15 ? 'negative' : 'neutral'} />
        <MetricCard title="Avg Salary (Active)" value={formatDollar(k.avgSalary)} icon={DollarSign}
          accent="border-emerald-300/50 bg-gradient-to-br from-emerald-50 to-green-50" delta="Base annual" deltaType="neutral" />
        <MetricCard title="% Female" value={formatPct(k.pctFemale)} icon={TrendingUp}
          accent="border-purple-300/50 bg-gradient-to-br from-purple-50 to-indigo-50" delta={`${formatPct(k.pctManagers)} are managers`} deltaType="neutral" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Headcount by Department">
          <ReactECharts option={{
            tooltip: { trigger: 'axis' }, grid: { left: 120, right: 20, bottom: 20, top: 10 },
            xAxis: { type: 'value' },
            yAxis: { type: 'category', data: byDept.map((d: any) => d.name), axisLabel: { fontSize: 11 } },
            series: [{ type: 'bar', data: byDept.map((d: any, i: number) => ({ value: d.headcount, itemStyle: { borderRadius: [0, 4, 4, 0], color: PALETTE[i % PALETTE.length] } })), barMaxWidth: 20 }],
          }} style={{ height: 320 }} />
        </ChartCard>

        <ChartCard title="Gender Distribution">
          <ReactECharts option={{
            tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
            series: [{ type: 'pie', radius: ['40%', '70%'], center: ['50%', '55%'],
              data: gender.map((d: any, i: number) => ({ name: d.name, value: d.headcount, itemStyle: { color: PALETTE[i % PALETTE.length] } })),
              itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 }, label: { formatter: '{b}\n{d}%', fontSize: 11 } }],
          }} style={{ height: 320 }} />
        </ChartCard>

        <ChartCard title="Hires vs Terminations by Year" className="lg:col-span-2">
          <ReactECharts option={{
            tooltip: { trigger: 'axis' }, legend: { data: ['Hires', 'Terminations'], top: 0 },
            grid: { left: 50, right: 20, bottom: 30, top: 35 },
            xAxis: { type: 'category', data: trend.map((d: any) => d.year) },
            yAxis: { type: 'value' },
            series: [
              { name: 'Hires', type: 'bar', data: trend.map((d: any) => d.hires), itemStyle: { color: '#10b981', borderRadius: [4, 4, 0, 0] }, barMaxWidth: 22 },
              { name: 'Terminations', type: 'bar', data: trend.map((d: any) => d.terminations), itemStyle: { color: '#ef4444', borderRadius: [4, 4, 0, 0] }, barMaxWidth: 22 },
            ],
          }} style={{ height: 300 }} />
        </ChartCard>

        <ChartCard title="Generation Mix">
          <ReactECharts option={{
            tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
            series: [{ type: 'pie', roseType: 'area', radius: ['20%', '70%'], center: ['50%', '55%'],
              data: generation.map((d: any, i: number) => ({ name: d.name, value: d.headcount, itemStyle: { color: PALETTE[i % PALETTE.length] } })),
              itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 }, label: { fontSize: 10 } }],
          }} style={{ height: 300 }} />
        </ChartCard>
      </div>
    </div>
  );
}
