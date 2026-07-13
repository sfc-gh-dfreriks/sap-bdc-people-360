import { useQuery } from '@/hooks/useQuery';
import { fetchRecruiting } from '@/lib/api';
import { formatNumber } from '@/lib/utils';
import MetricCard from '@/components/MetricCard';
import { UserPlus, Clock as ClockIcon, FileText } from 'lucide-react';
import ChartCard from '@/components/ChartCard';
import ReactECharts from 'echarts-for-react';

const PALETTE = ['#06b6d4', '#10b981', '#ef4444'];

export default function Recruiting() {
  const { data, loading, error } = useQuery(() => fetchRecruiting([], []), []);
  if (loading) return <div className="h-64 animate-pulse rounded-xl bg-gray-200" />;
  if (error) return <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">Error: {error}</div>;
  if (!data) return null;
  const k = data.kpis ?? {}; const f = data.funnel ?? {};

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard title="Open Requisitions" value={formatNumber(k.openReqs)} icon={UserPlus} accent="border-cyan-300/50 bg-gradient-to-br from-cyan-50 to-sky-50" delta={`${formatNumber(k.totalReqs)} total`} deltaType="neutral" />
        <MetricCard title="Total Applications" value={formatNumber(k.applications)} icon={FileText} accent="border-purple-300/50 bg-gradient-to-br from-purple-50 to-indigo-50" />
        <MetricCard title="Avg Time to Fill" value={`${formatNumber(k.avgTimeToFill)} days`} icon={ClockIcon} accent="border-amber-300/50 bg-gradient-to-br from-amber-50 to-orange-50" delta={k.avgTimeToFill > 60 ? 'Above target' : 'On target'} deltaType={k.avgTimeToFill > 60 ? 'negative' : 'positive'} />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Requisition Status">
          <ReactECharts option={{ tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
            series: [{ type: 'pie', radius: ['40%', '70%'], center: ['50%', '55%'],
              data: (data.byStatus ?? []).map((d: any, i: number) => ({ name: d.name, value: d.n, itemStyle: { color: PALETTE[i % PALETTE.length] } })),
              itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 }, label: { formatter: '{b}\n{d}%', fontSize: 11 } }] }} style={{ height: 320 }} />
        </ChartCard>
        <ChartCard title="Recruiting Funnel">
          <ReactECharts option={{ tooltip: { trigger: 'item', formatter: '{b}: {c}' },
            series: [{ type: 'funnel', left: '10%', width: '80%', label: { formatter: '{b}: {c}' },
              data: [
                { name: 'Applications', value: f.applications ?? 0, itemStyle: { color: '#06b6d4' } },
                { name: 'Interviews', value: f.interviews ?? 0, itemStyle: { color: '#8b5cf6' } },
                { name: 'Offers', value: f.offers ?? 0, itemStyle: { color: '#10b981' } },
              ] }] }} style={{ height: 320 }} />
        </ChartCard>
        <ChartCard title="Open Requisitions by Department" className="lg:col-span-2">
          <ReactECharts option={{ tooltip: { trigger: 'axis' }, grid: { left: 120, right: 20, bottom: 20, top: 10 },
            xAxis: { type: 'value' }, yAxis: { type: 'category', data: (data.byDept ?? []).map((d: any) => d.name).reverse(), axisLabel: { fontSize: 11 } },
            series: [{ type: 'bar', data: (data.byDept ?? []).map((d: any) => d.openReqs).reverse(), itemStyle: { color: '#06b6d4', borderRadius: [0, 4, 4, 0] }, barMaxWidth: 22 }] }} style={{ height: 340 }} />
        </ChartCard>
      </div>
    </div>
  );
}
