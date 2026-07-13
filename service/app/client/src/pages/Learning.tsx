import { useFilters } from '@/hooks/useFilters';
import { useQuery } from '@/hooks/useQuery';
import { fetchLearning } from '@/lib/api';
import { formatNumber } from '@/lib/utils';
import ChartCard from '@/components/ChartCard';
import DataTable from '@/components/DataTable';
import ReactECharts from 'echarts-for-react';

const PALETTE = ['#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#ec4899'];

export default function Learning() {
  const { selectedDepartments, selectedCompanies } = useFilters();
  const has = selectedDepartments.length > 0 && selectedCompanies.length > 0;
  const { data, loading, error } = useQuery(
    () => has ? fetchLearning(selectedDepartments, selectedCompanies) : Promise.resolve(null),
    [selectedDepartments.join(','), selectedCompanies.join(',')]);
  if (!has) return <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">Select at least one department and company.</div>;
  if (loading) return <div className="h-64 animate-pulse rounded-xl bg-gray-200" />;
  if (error) return <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">Error: {error}</div>;
  if (!data) return null;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <ChartCard title="Enrollment Status">
        <ReactECharts option={{ tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
          series: [{ type: 'pie', radius: ['40%', '70%'], center: ['50%', '55%'],
            data: (data.byStatus ?? []).map((d: any, i: number) => ({ name: d.name, value: d.n, itemStyle: { color: PALETTE[i % PALETTE.length] } })),
            itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 }, label: { formatter: '{b}\n{d}%', fontSize: 11 } }] }} style={{ height: 320 }} />
      </ChartCard>
      <ChartCard title="Learning Hours by Category">
        <ReactECharts option={{ tooltip: { trigger: 'axis' }, grid: { left: 130, right: 20, bottom: 20, top: 10 },
          xAxis: { type: 'value' }, yAxis: { type: 'category', data: (data.byCategory ?? []).map((d: any) => d.name).reverse(), axisLabel: { fontSize: 10 } },
          series: [{ type: 'bar', data: (data.byCategory ?? []).map((d: any) => d.hours).reverse(), itemStyle: { color: '#8b5cf6', borderRadius: [0, 4, 4, 0] }, barMaxWidth: 20 }] }} style={{ height: 320 }} />
      </ChartCard>
      <ChartCard title="Training Hours by Department" className="lg:col-span-2">
        <ReactECharts option={{ tooltip: { trigger: 'axis' }, grid: { left: 50, right: 20, bottom: 60, top: 10 },
          xAxis: { type: 'category', data: (data.hoursByDept ?? []).map((d: any) => d.name), axisLabel: { rotate: 30, fontSize: 10 } },
          yAxis: { type: 'value' },
          series: [{ type: 'bar', data: (data.hoursByDept ?? []).map((d: any) => d.hours), itemStyle: { color: '#06b6d4', borderRadius: [4, 4, 0, 0] }, barMaxWidth: 30 }] }} style={{ height: 300 }} />
      </ChartCard>
      <ChartCard title="Top Courses" className="lg:col-span-2">
        <DataTable columns={[
          { key: 'name', label: 'Course' },
          { key: 'enrollments', label: 'Enrollments', format: (v: any) => formatNumber(v) },
          { key: 'completionPct', label: 'Completion %', format: (v: any) => `${v}%` },
        ]} data={data.topCourses ?? []} />
      </ChartCard>
    </div>
  );
}
