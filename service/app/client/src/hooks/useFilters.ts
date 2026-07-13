import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { fetchFilters } from '@/lib/api';

interface FilterContextType {
  departments: string[];
  selectedDepartments: string[];
  setSelectedDepartments: (v: string[]) => void;
  companies: string[];
  selectedCompanies: string[];
  setSelectedCompanies: (v: string[]) => void;
  loading: boolean;
}

const FilterContext = createContext<FilterContextType>({
  departments: [], selectedDepartments: [], setSelectedDepartments: () => {},
  companies: [], selectedCompanies: [], setSelectedCompanies: () => {},
  loading: true,
});

export function FilterProvider({ children }: { children: ReactNode }) {
  const [departments, setDepartments] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [companies, setCompanies] = useState<string[]>([]);
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFilters()
      .then((data) => {
        setDepartments(data.departments);
        setSelectedDepartments(data.departments);
        setCompanies(data.companies);
        setSelectedCompanies(data.companies);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return React.createElement(
    FilterContext.Provider,
    { value: { departments, selectedDepartments, setSelectedDepartments, companies, selectedCompanies, setSelectedCompanies, loading } },
    children
  );
}

export function useFilters() {
  return useContext(FilterContext);
}
