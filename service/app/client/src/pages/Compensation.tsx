import { useFilters } from '@/hooks/useFilters';
import { useQuery } from '@/hooks/useQuery';
import { fetchCompensation } from '@/lib/api';
import { formatDollar } from '@/lib/utils';
import ChartCard from '@/components/ChartCard';
import DataTable from '@/components/DataTable';
import ReactECharts from 'echarts-for-react';

export default function Compensation() {
  const { selectedDepartments, selectedCompanies } = useFilters();
  const has = selectedDepartments.length > 0 && selectedCompanies.length > 0;
  const { data, loading, error } = useQuery(
    () => has ? fetchCompensation(selectedDepartments, selectedCompanies) : Promise.resolve(null),
    [selectedDepartments.join(','), selectedCompanies.join(',')]);
  if (!has) return <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">Select at least one department and company.</div>;
  if (loading) return <div className="h-64 animate-pulse rounded-xl bg-gray-200" />;
  if (error) return <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">Error: {error}</div>;
  if (!data) return null;

  const byDept = data.byDept ?? [];
  const byGrade = data.byGrade ?? [];
  const equity = data.payEquity ?? [];
  const top = data.topEarners ?? [];
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <ChartCard title="Average Salary by Department" className="lg:col-span-2">
        <ReactECharts option={{ tooltip: { trigger: 'axis', formatter: (p: any) => `${p[0].name}: ${formatDollar(p[0].value)}` },
          grid: { left: 70, right: 20, bottom: 60, top: 10 },
          xAxis: { type: 'category', data: byDept.map((d: any) => d.name), axisLabel: { rotate: 30, fontSize: 10 } },
          yAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatDollar(v) } },
          series: [{ type: 'bar', data: byDept.map((d: any) => d.avgSalary), itemStyle: { color: '#10b981', borderRadius: [4, 4, 0, 0] }, barMaxWidth: 28 }] }} style={{ height: 320 }} />
      </ChartCard>
      <ChartCard title="Salary & Compa-Ratio by Pay Grade">
        <ReactECharts option={{ tooltip: { trigger: 'axis' }, legend: { data: ['Avg Salary', 'Compa-Ratio'], top: 0 },
          grid: { left: 70, right: 50, bottom: 30, top: 35 },
          xAxis: { type: 'category', data: byGrade.map((d: any) => `G${d.grade}`) },
          yAxis: [{ type: 'value', axisLabel: { formatter: (v: number) => formatDollar(v) } }, { type: 'value', min: 0.8, max: 1.2, splitLine: { show: false } }],
          series: [
            { name: 'Avg Salary', type: 'bar', data: byGrade.map((d: any) => d.avgSalary), itemStyle: { color: '#06b6d4', borderRadius: [4, 4, 0, 0] }, barMaxWidth: 24 },
            { name: 'Compa-Ratio', type: 'line', yAxisIndex: 1, smooth: true, data: byGrade.map((d: any) => d.avgCompa), itemStyle: { color: '#f59e0b' }, lineStyle: { width: 3 } },
          ] }} style={{ height: 320 }} />
      </ChartCard>
      <ChartCard title="Pay Equity — Avg Salary by Gender">
        <ReactECharts option={{ tooltip: { trigger: 'axis', formatter: (p: any) => `${p[0].name}: ${formatDollar(p[0].value)}` },
          grid: { left: 80, right: 20, bottom: 20, top: 10 },
          xAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatDollar(v) } },
          yAxis: { type: 'category', data: equity.map((d: any) => d.name) },
          series: [{ type: 'bar', data: equity.map((d: any) => d.avgSalary), itemStyle: { color: '#8b5cf6', borderRadius: [0, 4, 4, 0] }, barMaxWidth: 30, label: { show: true, position: 'right', formatter: (p: any) => formatDollar(p.value), fontSize: 10 } }] }} style={{ height: 320 }} />
      </ChartCard>
      <ChartCard title="Top Earners" className="lg:col-span-2">
        <DataTable columns={[
          { key: 'employeeId', label: 'Employee' }, { key: 'jobTitle', label: 'Title' },
          { key: 'department', label: 'Department' },
          { key: 'annualSalary', label: 'Salary', format: (v: any) => formatDollar(v) },
          { key: 'compaRatio', label: 'Compa-Ratio' },
        ]} data={top} />
      </ChartCard>
    </div>
  );
}
