import { useFilters } from '@/hooks/useFilters';
import { useQuery } from '@/hooks/useQuery';
import { fetchEmployees } from '@/lib/api';
import { formatDollar } from '@/lib/utils';
import ChartCard from '@/components/ChartCard';
import DataTable from '@/components/DataTable';

export default function Employees() {
  const { selectedDepartments, selectedCompanies } = useFilters();
  const has = selectedDepartments.length > 0 && selectedCompanies.length > 0;
  const { data, loading, error } = useQuery(
    () => has ? fetchEmployees(selectedDepartments, selectedCompanies) : Promise.resolve(null),
    [selectedDepartments.join(','), selectedCompanies.join(',')]);
  if (!has) return <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">Select at least one department and company.</div>;
  if (loading) return <div className="h-64 animate-pulse rounded-xl bg-gray-200" />;
  if (error) return <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">Error: {error}</div>;
  if (!data) return null;

  return (
    <ChartCard title="Employee Directory" subtitle="Top 200 by salary (filtered)">
      <DataTable columns={[
        { key: 'employeeId', label: 'ID' },
        { key: 'jobTitle', label: 'Title' },
        { key: 'department', label: 'Department' },
        { key: 'division', label: 'Division' },
        { key: 'location', label: 'Location' },
        { key: 'gender', label: 'Gender' },
        { key: 'generation', label: 'Generation' },
        { key: 'employmentStatus', label: 'Status' },
        { key: 'payGrade', label: 'Grade' },
        { key: 'annualSalary', label: 'Salary', format: (v: any) => formatDollar(v) },
        { key: 'tenureYears', label: 'Tenure (yrs)' },
        { key: 'isManager', label: 'Manager', format: (v: any) => (v ? 'Yes' : '') },
      ]} data={data.rows ?? []} />
    </ChartCard>
  );
}
